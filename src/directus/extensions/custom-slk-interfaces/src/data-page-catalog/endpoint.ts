import type { Request, Response, Router } from "express";
import { getDataPageCatalog } from "./catalog";

interface AuthenticatedRequest extends Request {
  accountability?: { user?: string };
}

interface EndpointContext {
  env: Record<string, string | undefined>;
  logger: { error: (message: string, error?: unknown) => void };
}

export default {
  id: "data-page-catalog",
  handler: (router: Router, { env, logger }: EndpointContext) => {
    router.get("/", async (req: AuthenticatedRequest, res: Response) => {
      if (!req.accountability?.user)
        return res.status(401).json({ error: "Authentication required" });

      try {
        const collections = await getDataPageCatalog(
          env.DATA_PAGE_CATALOG_BASE_URL,
        );
        return res.json({ collections });
      } catch (error) {
        logger.error("[data-page-catalog] Failed to load collections", error);
        return res
          .status(502)
          .json({ error: "Collection catalog unavailable" });
      }
    });
  },
};
