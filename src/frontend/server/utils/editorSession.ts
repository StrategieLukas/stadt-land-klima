import { setLogActor } from "./securityLogging";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createError, getHeader, useSession, type H3Event } from "h3";
import { z } from "zod";
import { abuseProtection } from "./abuseProtection";
import { withProtectionRedis } from "./protectionRedis";
import { AuthUserSchema } from "~/shared/contracts/auth";

const Session = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  user: AuthUserSchema,
});
export type EditorSession = z.output<typeof Session>;
const lifetime = 7 * 24 * 3600;
const key = (sid: string) => `${process.env.RATE_LIMIT_NAMESPACE || "slk"}:editor-session:${sid}`;

export function editorMutationOrigin(event: H3Event) {
  const origin = getHeader(event, "origin");
  const site = getHeader(event, "sec-fetch-site");
  if (getHeader(event, "x-slk-editor") !== "1" || (site && !["same-origin", "none"].includes(site)))
    throw createError({ statusCode: 403 });
  if (origin) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw createError({ statusCode: 403 });
    }
    const configured = useRuntimeConfig().appPublicUrl;
    if (configured ? url.origin !== new URL(configured).origin : url.host !== getHeader(event, "host"))
      throw createError({ statusCode: 403 });
  }
}
export async function editorCookie(event: H3Event) {
  const { hmacKey, devMode } = abuseProtection();
  const configured = useRuntimeConfig().editorSessionSecret;
  if (configured && configured.length < 32)
    throw createError({ statusCode: 503, statusMessage: "Invalid editor session configuration" });
  return useSession<{ sid: string; csrf: string }>(event, {
    name: "slk-editor",
    sessionHeader: false,
    maxAge: lifetime,
    password: configured || createHmac("sha256", hmacKey).update("slk:editor-session:v1").digest("hex"),
    cookie: { httpOnly: true, secure: !devMode, sameSite: "strict", path: "/api/editor" },
  });
}
export async function saveEditorSession(sid: string, session: EditorSession, existing = false) {
  const result = await withProtectionRedis((redis) =>
    redis.set(key(sid), JSON.stringify(Session.parse(session)), { EX: lifetime, ...(existing ? { XX: true } : {}) }),
  );
  if (result !== "OK") throw createError({ statusCode: 401 });
}
export async function revokeEditorSession(sid: string) {
  await withProtectionRedis((redis) => redis.del(key(sid)));
}
export async function readEditorSession(event: H3Event, mutation = false) {
  const cookie = await editorCookie(event);
  const { sid, csrf } = cookie.data;
  if (!sid || !/^[a-f0-9]{64}$/.test(sid)) throw createError({ statusCode: 401 });
  if (mutation) {
    editorMutationOrigin(event);
    const provided = getHeader(event, "x-csrf-token");
    if (
      !provided ||
      !csrf ||
      !/^[a-f0-9]{64}$/.test(provided) ||
      !/^[a-f0-9]{64}$/.test(csrf) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(csrf))
    )
      throw createError({ statusCode: 403 });
  }
  let raw: string | null;
  try {
    raw = await withProtectionRedis((redis) => redis.get(key(sid)));
  } catch {
    throw createError({ statusCode: 503, statusMessage: "Session service unavailable" });
  }
  let value: unknown;
  try {
    value = raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    value = null;
  }
  const parsed = Session.safeParse(value);
  if (!parsed.success) throw createError({ statusCode: 401 });
  setLogActor(event, parsed.data.user.id);
  return { cookie, sid, session: parsed.data };
}
export async function openEditorSession(event: H3Event, session: EditorSession) {
  setLogActor(event, session.user.id);
  const cookie = await editorCookie(event);
  if (cookie.data.sid) await revokeEditorSession(cookie.data.sid);
  const sid = randomBytes(32).toString("hex"),
    csrf = randomBytes(32).toString("hex");
  await saveEditorSession(sid, session);
  await cookie.update({ sid, csrf });
  return { user: session.user, csrf };
}
