<template>
  <p v-if="refreshing" role="status">{{ $t("generic.loading") }}</p>
  <p v-else-if="failed" role="alert">
    {{ $t("data.dashboard.unavailable") }}
    <button type="button" class="underline" @click="retry">{{ $t("data.dashboard.retry") }}</button>
  </p>
  <HistogramRenderElement
    v-else-if="resolvedElement?.type === 'histogram' && resolvedElement.interactions?.reveal_municipalities"
    v-bind="$attrs"
    fullscreen
    :element="resolvedElement"
    :collection-id="collectionId"
    :chart-height="height ?? 240"
    @stale="refresh"
  />
  <VegaChart v-else v-bind="$attrs" :spec="resolvedSpec" :height="height" fullscreen />
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { RenderElement } from "~/types/slz-api";
import type { EditableSpec } from "~/shared/visualization";
import { RenderElementSchema } from "~/shared/contracts/slz";
import { overviewEndpoint } from "~/utils/municipalityOverview";
defineOptions({ inheritAttrs: false });
const props = defineProps<{
  element?: RenderElement | null | undefined;
  collectionId: string;
  spec: EditableSpec | null;
  ars?: string | undefined;
  height?: number | undefined;
}>();
const { $t, $locale } = useNuxtApp();
const replacement = ref<RenderElement | null>(null);
const refreshing = ref(false);
const failed = ref(false);
const resolvedSpec = computed(() => (replacement.value ? replacement.value.vegalite_spec : props.spec));
const resolvedElement = computed(
  () =>
    replacement.value ??
    (props.element
      ? {
          ...props.element,
          vegalite_spec: props.element.interactions?.reveal_municipalities ? props.element.vegalite_spec : props.spec,
        }
      : null),
);
let refreshed = false;
let controller: AbortController | undefined;
let generation = 0;
async function refresh() {
  if (refreshed || !props.element || !/^[a-zA-Z0-9_-]{1,160}$/.test(props.element.plot_id)) return;
  refreshed = true;
  const current = ++generation;
  controller?.abort();
  controller = new AbortController();
  refreshing.value = true;
  failed.value = false;
  try {
    const url = overviewEndpoint(props.collectionId).replace(/overview\/$/, `render/${props.element.plot_id}/`);
    const result = RenderElementSchema.parse(
      await $fetch(url, {
        query: { area: props.ars || undefined, lang: $locale === "en-GB" ? "en-US" : $locale },
        signal: controller.signal,
        timeout: 10000,
        retry: 0,
      }),
    );
    if (current !== generation) return;
    if (result.plot_id !== props.element.plot_id || result.type !== "histogram")
      throw new Error("Mismatched histogram render");
    replacement.value = result;
  } catch {
    if (current === generation && !controller.signal.aborted) failed.value = true;
  } finally {
    if (current === generation) refreshing.value = false;
  }
}
function retry() {
  refreshed = false;
  void refresh();
}
watch(
  () => [props.element, props.spec, props.collectionId, props.ars],
  () => {
    ++generation;
    controller?.abort();
    replacement.value = null;
    refreshed = false;
    failed.value = false;
    refreshing.value = false;
  },
);
onBeforeUnmount(() => {
  ++generation;
  controller?.abort();
});
</script>
