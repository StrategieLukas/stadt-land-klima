export function useDataRouteFeedback() {
  const isLoading = useState("data-route-feedback-loading", () => false);
  const label = useState("data-route-feedback-label", () => "Klimadaten werden geladen...");
  const installed = useState("data-route-feedback-installed", () => false);
  const router = useRouter();

  if (process.client && !installed.value) {
    installed.value = true;
    router.beforeEach((to, from) => {
      if (to.fullPath !== from.fullPath && to.path.startsWith("/data")) {
        isLoading.value = true;
        label.value = "Klimadaten werden geladen...";
      }
    });
    router.afterEach(() => {
      window.setTimeout(() => {
        isLoading.value = false;
      }, 120);
    });
    router.onError(() => {
      isLoading.value = false;
    });
  }

  function start(nextLabel = "Klimadaten werden geladen...") {
    isLoading.value = true;
    label.value = nextLabel;
  }

  function stop() {
    isLoading.value = false;
  }

  return { isLoading, label, start, stop };
}
