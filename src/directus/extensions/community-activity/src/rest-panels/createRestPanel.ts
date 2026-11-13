import { definePanel, useApi, useExtensions, useStores } from "@directus/extensions-sdk";
import { computed, defineComponent, h, onMounted, onUpdated, onBeforeUnmount, ref, resolveComponent } from "vue";

// Keep native renderers, configuration and resolved dashboard variables. Only
// the transport changes: native Insights queries use GraphQL, blocked by Caddy.
// Serialize reads with a small gap to stay within the gateway's request budget.
let queue = Promise.resolve();
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 100));
type RefreshAction = { name: string; args: unknown[]; after: (callback: () => void) => void };
type InsightsStore = { $onAction: (callback: (action: RefreshAction) => void) => () => void };

export function createRestPanel(type: "metric" | "pie-chart") {
  return definePanel({
    id: `slk-rest-${type}`,
    name: type === "metric" ? "Kennzahl (REST)" : "Kreisdiagramm (REST)",
    icon: type === "metric" ? "functions" : "pie_chart",
    description: "Native Darstellung mit berechtigungsgeprüften REST-Abfragen.",
    minWidth: 6,
    minHeight: 2,
    options: (context) => {
      const { panels } = useExtensions();
      const native = panels.value.find((panel) => panel.id === type);
      const options = native?.options;
      return typeof options === "function" ? options(context) : (options ?? []);
    },
    component: defineComponent({
      inheritAttrs: false,
      setup(_props, { attrs }) {
        const { panels } = useExtensions();
        const api = useApi();
        const native = computed(() => panels.value.find((panel) => panel.id === type));
        const data = ref<unknown>();
        const loading = ref(false);
        const failed = ref(false);
        let signature = "";
        let controller: AbortController | undefined;

        async function load(force = false) {
          const query = native.value?.query?.(attrs);
          const next = JSON.stringify(query);
          if (!query || (!force && signature === next)) return;
          signature = next;
          controller?.abort();
          const request = new AbortController();
          controller = request;
          loading.value = true;
          failed.value = false;
          try {
            const queries = Array.isArray(query) ? query : [query];
            const results = await Promise.all(
              queries.map((item) => {
                const task = queue.then(async () => {
                  if (request.signal.aborted) throw new Error("Cancelled panel query");
                  await pause();
                  if (request.signal.aborted) throw new Error("Cancelled panel query");
                  const collection = item.collection;
                  const endpoint = collection.startsWith("directus_")
                    ? `/${collection.slice(9)}`
                    : `/items/${encodeURIComponent(collection)}`;
                  const response = await api.get<{ data: unknown }>(endpoint, {
                    params: item.query,
                    signal: request.signal,
                  });
                  if (!Array.isArray(response.data.data)) throw new Error("Invalid panel response");
                  return response.data.data;
                });
                queue = task.then(
                  () => undefined,
                  () => undefined,
                );
                return task;
              }),
            );
            if (!request.signal.aborted) data.value = Array.isArray(query) ? results : results[0];
          } catch {
            // A failed read must never silently turn into a misleading zero.
            if (!request.signal.aborted) failed.value = true;
          } finally {
            if (!request.signal.aborted) loading.value = false;
          }
        }

        onMounted(() => void load());
        // Directus resolves variable placeholders before passing panel attrs.
        onUpdated(() => void load());
        const insights = useStores().useInsightsStore() as InsightsStore;
        const unsubscribe = insights.$onAction(({ name, args, after }) => {
          if (name === "refresh" && args[0] === attrs.dashboard) after(() => void load(true));
        });
        onBeforeUnmount(() => {
          unsubscribe();
          controller?.abort();
        });
        return () =>
          h("div", { class: "slk-rest-panel", style: { height: "100%", position: "relative" } }, [
            failed.value
              ? h(resolveComponent("v-notice"), { type: "danger" }, () => "Daten konnten nicht geladen werden.")
              : data.value === undefined
                ? h(resolveComponent("v-progress-circular"), { indeterminate: true })
                : native.value && h(native.value.component, { ...attrs, data: data.value }),
            h(
              resolveComponent("v-button"),
              {
                icon: true,
                xSmall: true,
                secondary: true,
                loading: loading.value,
                title: "Aktualisieren",
                "aria-label": "Aktualisieren",
                style: { position: "absolute", right: "4px", bottom: "4px" },
                onClick: () => void load(true),
              },
              () => [
                h(resolveComponent("v-icon"), { name: "refresh" }),
                h(
                  "span",
                  {
                    style: {
                      position: "absolute",
                      width: "1px",
                      height: "1px",
                      overflow: "hidden",
                      clipPath: "inset(50%)",
                      whiteSpace: "nowrap",
                    },
                  },
                  "Aktualisieren",
                ),
              ],
            ),
          ]);
      },
    }),
  });
}
