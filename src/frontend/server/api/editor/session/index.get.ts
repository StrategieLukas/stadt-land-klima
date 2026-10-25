import { createError, defineEventHandler, setResponseHeader, setResponseStatus } from "h3";
import { editorAccess, editorIdentity } from "../../../utils/editorUpstream";
import { rateLimit } from "../../../utils/rateLimit";
import { editorCookie, saveEditorSession } from "../../../utils/editorSession";
export default defineEventHandler(async (event) => {
  if (!(await rateLimit(event, "editor-session"))) throw createError({ statusCode: 429 });
  setResponseHeader(event, "Cache-Control", "private, no-store");
  const cookie = await editorCookie(event);
  if (!cookie.data.sid) {
    setResponseStatus(event, 204);
    return null;
  }
  const state = await editorAccess(event, false);
  const user = await editorIdentity(state.session.accessToken);
  await saveEditorSession(state.sid, { ...state.session, user }, true);
  return { user, csrf: state.cookie.data.csrf };
});
