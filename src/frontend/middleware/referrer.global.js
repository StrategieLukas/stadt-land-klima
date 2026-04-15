export default defineNuxtRouteMiddleware((to, from) => {
  // Only on the client, when there is a real previous route (not the initial load),
  // and when actually navigating to a different page (not a same-page query param replace).
  if (process.client && from.name && from.path !== to.path) {
    useState('slk_referrer', () => null).value = from.fullPath
  }
})
