import { extensionDiagnostic } from "../../shared/securityLogger.ts";
import jwt from "jsonwebtoken";
import type { Request, Response, Router } from "express";
import type { ApiExtensionContext } from "@directus/types";

type Database = ApiExtensionContext["database"];

interface ExtensionContext {
  env: {
    SECRET: string;
    PUBLIC_URL?: string;
  };
  database: Database;
}

interface AuthenticatedRequest extends Request {
  accountability?: { admin: boolean };
}

interface DirectusUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Replicates Directus's internal getSimpleHash() used for password-reset tokens.
 * Forces 32-bit integer arithmetic via |0 to match the original behaviour.
 */
function getSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (31 * hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

export default {
  id: "generate-reset-link",
  handler: (router: Router, { env, database }: ExtensionContext) => {
    router.post("/", async (req: AuthenticatedRequest, res: Response) => {
      if (!req.accountability?.admin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { email } = req.body ?? {};
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: 'Missing or invalid "email" field' });
      }

      if (!env.SECRET) {
        return res.status(503).json({ error: "Server misconfiguration: SECRET is not set" });
      }

      if (!env.PUBLIC_URL) {
        return res.status(503).json({ error: "Server misconfiguration: PUBLIC_URL is not set" });
      }

      let user: DirectusUser | null;
      try {
        user =
          (await database("directus_users")
            .select("id", "email", "password")
            .where({ email: email.trim().toLowerCase(), status: "active" })
            .first()) ?? null;
      } catch {
        extensionDiagnostic("error", "app.endpoint-generate-reset-link.index.failed");
        return res.status(500).json({ error: "Internal server error" });
      }

      if (!user) {
        return res.status(404).json({ error: "User not found or not active" });
      }

      const token = jwt.sign(
        {
          email: user.email,
          scope: "password-reset",
          hash: getSimpleHash(String(user.password)),
        },
        env.SECRET,
        { expiresIn: "1d", issuer: "directus" },
      );

      extensionDiagnostic("info", "directus.auth.reset_link_issued", {
        resource: "directus_users",
        resourceId: user.id,
        outcome: "success",
      });
      const base = env.PUBLIC_URL.replace(/\/$/, "");
      return res.json({ url: `${base}/admin/reset-password?token=${token}` });
    });
  },
};
