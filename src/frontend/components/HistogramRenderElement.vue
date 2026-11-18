<template>
  <div class="min-w-0">
    <p v-if="loading" class="sr-only" role="status">{{ $t("generic.loading") }}</p>
    <p v-else-if="failed" class="py-4" role="alert">
      {{ $t("generic.loading_error") }}
      <button type="button" class="underline" @click="load()">{{ $t("data.dashboard.retry") }}</button>
    </p>
    <div :style="{ height: `${chartHeight}px` }">
      <div
        v-if="loading"
        class="h-full w-full animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <VegaChart
        v-else-if="boundSpec"
        v-bind="$attrs"
        :spec="boundSpec"
        :height="chartHeight"
        :data-api-url="enabled ? element.data_url : undefined"
        :bin-selection="!!interaction"
        @select-bin="selectBin"
      />
    </div>
    <template v-if="response && interaction">
      <p class="mt-2 text-xs text-(--slk-text-subtle)">{{ $t("stats.histogram.click_bar_hint") }}</p>
      <details class="mt-2 text-sm">
        <summary class="cursor-pointer">{{ $t("data.dashboard.choose_bin") }}</summary>
        <div class="mt-2 flex flex-wrap gap-2" :aria-label="$t('data.dashboard.choose_bin')">
          <button
            v-for="bin in response.bins"
            :key="bin.bin_index"
            type="button"
            class="btn h-auto min-h-8 btn-outline btn-xs"
            :class="{ 'btn-active': selected?.bin_index === bin.bin_index }"
            :aria-pressed="selected?.bin_index === bin.bin_index"
            :disabled="bin.count === 0"
            @click="selectBin(bin.bin_index)"
          >
            {{ bin.display_label }} · {{ bin.count.toLocaleString($locale) }}
          </button>
        </div>
      </details>
      <div v-if="selected" class="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" class="underline" @click="dialogOpen = true">
          {{ $t("data.dashboard.show_selection", { ":count": selected.count.toLocaleString($locale) }) }}
        </button>
        <button type="button" class="underline" @click="clear">{{ $t("data.dashboard.clear_selection") }}</button>
      </div>
      <MunicipalityListDialog
        v-if="selected"
        v-model:open="dialogOpen"
        :collection-id="collectionId"
        :members-url="interaction.members_url"
        :snapshot="interaction.snapshot_id"
        :bin-index="selected.bin_index"
        :label="selected.display_label"
        :metric="response.metric"
        @stale="emit('stale')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  HistogramResponseSchema,
  SnapshotIdSchema,
  type HistogramResponse,
} from "~/shared/contracts/municipalityOverview";
import { asRecord, cloneVisualization } from "~/shared/visualization";
import type { RenderElement } from "~/types/slz-api";
import { bindHistogramData, checkedOverviewUrl } from "~/utils/municipalityOverview";
defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{
    element: RenderElement;
    collectionId: string;
    snapshot?: string | undefined;
    chartHeight?: number;
  }>(),
  { chartHeight: 240 },
);
const emit = defineEmits<{ "select-bin": [bin: number | null]; stale: [] }>();
const { $t, $locale } = useNuxtApp();
const selected = ref<HistogramResponse["bins"][number] | null>(null);
const dialogOpen = ref(false);
const enabled = computed(() => props.element.interactions?.reveal_municipalities);
const feedKey = computed(
  () =>
    `municipality-histogram:${JSON.stringify([props.collectionId, props.snapshot, props.element.data_url, enabled.value?.metric_id])}`,
);
const {
  data: feed,
  status,
  error,
  refresh: load,
} = await useAsyncData(
  feedKey,
  async (_app, { signal }) => {
    const key = feedKey.value;
    const declaration = enabled.value;
    const element = props.element;
    const collection = props.collectionId;
    if (!declaration) return { key, response: null, stale: false };
    if (!element.data_url) throw new Error("Missing histogram feed");
    const url = checkedOverviewUrl(element.data_url, collection, "histogram", props.snapshot);
    const snapshot =
      props.snapshot ?? SnapshotIdSchema.parse(new URL(url, "https://overview.invalid").searchParams.get("snapshot"));
    checkedOverviewUrl(url, collection, "histogram", snapshot);
    let raw: unknown;
    try {
      raw = await $fetch(url, { signal, timeout: 10000, retry: 0 });
    } catch (failure) {
      if ((failure as { statusCode?: number }).statusCode === 409 || (failure as { status?: number }).status === 409)
        return { key, response: null, stale: true };
      throw failure;
    }
    const response = HistogramResponseSchema.parse(raw);
    if (
      !response.interaction_context ||
      response.interaction_context.metric_id !== declaration.metric_id ||
      response.interaction_context.snapshot_id !== snapshot
    )
      throw new Error("Mismatched histogram context");
    checkedOverviewUrl(response.interaction_context.members_url, collection, "municipalities", snapshot);
    if (!element.vegalite_spec) throw new Error("Missing histogram specification");
    bindHistogramData(element.vegalite_spec, element.data_url, response);
    return { key, response, stale: false };
  },
  { dedupe: "cancel" },
);
const response = computed(() => (feed.value?.key === feedKey.value ? feed.value.response : null));
const loading = computed(() => status.value === "pending");
const failed = computed(() => !!error.value || !!feed.value?.stale);
const interaction = computed(() => response.value?.interaction_context ?? null);
const boundSpec = computed(() => {
  if (!props.element.vegalite_spec) return null;
  if (!enabled.value) return props.element.vegalite_spec;
  if (!response.value || !props.element.data_url) return null;
  const spec = bindHistogramData(props.element.vegalite_spec, props.element.data_url, response.value);
  if (selected.value) {
    const index = selected.value.bin_index;
    function highlight(value: unknown) {
      if (Array.isArray(value)) {
        value.forEach(highlight);
        return;
      }
      const node = asRecord(value);
      if (!node) return;
      if (node.name === "municipality-histogram-bars")
        node.encoding = {
          ...asRecord(node.encoding),
          opacity: { condition: { test: `datum.bin_index === ${index}`, value: 1 }, value: 0.3 },
        };
      if (Array.isArray(node.layer)) node.layer.forEach(highlight);
    }
    highlight(spec);
  }
  return cloneVisualization(spec);
});
function clear() {
  selected.value = null;
  dialogOpen.value = false;
  emit("select-bin", null);
}
function selectBin(index: number) {
  const bin = response.value?.bins.find((item) => item.bin_index === index);
  if (!bin?.count || !interaction.value) return;
  selected.value = bin;
  dialogOpen.value = true;
  emit("select-bin", index);
}
watch(feedKey, clear, { flush: "sync" });
watch(() => props.element, clear);
watch(
  () => feed.value?.stale,
  (stale) => {
    if (stale && import.meta.client) emit("stale");
  },
);
onMounted(() => {
  if (feed.value?.stale) emit("stale");
});
</script>
