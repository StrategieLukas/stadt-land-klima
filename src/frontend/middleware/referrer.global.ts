export default defineNuxtRouteMiddleware((to, from) => {
  // Only on the client, when there is a real previous route (not the initial load),
  // and when actually navigating to a different page (not a same-page query param replace).
  if (import.meta.client && from.name && from.path !== to.path) {
    useState<string | null>("slk_referrer", () => null).value =
      from.path.startsWith("/elections/thesen") ||
      from.query.blokkliPreview ||
      from.query.preview ||
      from.query.preview_token
        ? null
        : from.fullPath;
  }
});
