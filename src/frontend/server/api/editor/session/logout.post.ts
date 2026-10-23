import {createError, defineEventHandler, setResponseHeader} from 'h3';
import {readEditorSession, revokeEditorSession} from '../../../utils/editorSession';
import {rateLimit} from '../../../utils/rateLimit';
import {logoutEditor} from '../../../utils/editorUpstream';
export default defineEventHandler(async event => {
  if (!await rateLimit(event, 'editor-logout')) throw createError({statusCode: 429});
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const state = await readEditorSession(event, true);
  await revokeEditorSession(state.sid);
  await state.cookie.clear();
  try {await logoutEditor(state.session.refreshToken);} catch { /* Local revocation is authoritative even when the CMS is offline. */ }
  return {success: true};
});
