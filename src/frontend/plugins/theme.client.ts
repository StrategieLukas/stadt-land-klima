export default defineNuxtPlugin(() => {
  const { initializeTheme } = useTheme();
  initializeTheme();
});
