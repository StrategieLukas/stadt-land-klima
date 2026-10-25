import { requestLog } from "../../../utils/securityLogging";
import { createError, defineEventHandler, setResponseHeader } from "h3";
import { z } from "zod";
import { editorMutationOrigin, openEditorSession } from "../../../utils/editorSession";
import { loginEditor } from "../../../utils/editorUpstream";
import { readRequestBody } from "../../../utils/readRequestBody";
import { rateLimit } from "../../../utils/rateLimit";
export default defineEventHandler(async (event) => {
  editorMutationOrigin(event);
  if (!(await rateLimit(event, "editor-login"))) throw createError({ statusCode: 429 });
  setResponseHeader(event, "Cache-Control", "private, no-store");
  const body = z
    .strictObject({ email: z.email().max(255), password: z.string().min(1).max(4096) })
    .safeParse(await readRequestBody(event, 8192));
  if (!body.success) throw createError({ statusCode: 400 });
  let session;
  try {
    session = await loginEditor(body.data.email, body.data.password);
  } catch {
    throw createError({ statusCode: 401, statusMessage: "Invalid user credentials" });
  }
  const result = await openEditorSession(event, session);
  requestLog(event, "info", "nuxt.auth.login", { outcome: "success" });
  return result;
});
