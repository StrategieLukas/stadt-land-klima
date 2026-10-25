export default defineNuxtRouteMiddleware(async () => {
  const { data } = await useDataPageConfig();
  if (data.value?.under_construction) {
    return navigateTo("/data", { redirectCode: 302, replace: true });
  }
});
