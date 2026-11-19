<template>
  <dialog
    ref="dialog"
    class="municipality-dialog modal modal-bottom sm:modal-middle"
    :aria-labelledby="titleId"
    @close="closed"
    @cancel="emit('update:open', false)"
    @click="backdrop"
  >
    <div
      class="modal-box flex max-h-[75dvh] w-full max-w-2xl flex-col bg-(--slk-surface) p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-(--slk-text)"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 :id="titleId" class="font-heading text-2xl font-bold">{{ $t("data.dashboard.municipalities") }}</h2>
          <p class="mt-1 text-sm">{{ label }}</p>
        </div>
        <button
          type="button"
          class="btn btn-circle shrink-0 btn-ghost btn-sm"
          :aria-label="$t('generic.close')"
          @click="emit('update:open', false)"
        >
          <Icon icon="mdi:close" class="h-5 w-5" />
        </button>
      </div>
      <label class="mt-4 mb-1 text-sm" :for="inputId">{{ $t("data.dashboard.search_list") }}</label>
      <input :id="inputId" v-model="query" type="search" maxlength="200" class="input w-full shrink-0" />
      <p class="my-3 text-sm" aria-live="polite">
        {{ $t("data.dashboard.result_count", { ":count": count.toLocaleString($locale) }) }}
      </p>
      <div class="min-h-0 overflow-y-auto" :aria-busy="loading">
        <p v-if="failed" class="py-4" role="alert">
          {{ $t(stale ? "data.dashboard.snapshot_updated" : "generic.loading_error") }}
        </p>
        <ul class="divide-y divide-(--slk-border)">
          <li v-for="row in rows" :key="row.ars">
            <NuxtLink
              :to="municipalityProductRoute(collectionId, row)"
              class="flex items-center justify-between gap-4 py-3 hover:underline"
            >
              <span class="min-w-0"
                ><span class="block font-semibold">{{ row.name }}</span
                ><span class="block text-xs text-(--slk-text-subtle)">{{
                  [row.prefix, row.district_name, row.state_name].filter(Boolean).join(" · ")
                }}</span></span
              >
              <span class="shrink-0 text-right text-sm tabular-nums"
                >{{ formatOverviewValue(row.value, metric, $locale) ?? $t("generic.no_data")
                }}<span v-if="row.value !== null && metric?.percentage_representation === 'none'" class="ml-1">{{
                  t(metric.unit)
                }}</span></span
              >
            </NuxtLink>
          </li>
        </ul>
        <p v-if="!loading && !failed && !rows.length" class="py-4">
          {{ $t("administrative_areas.search.no_results") }}
        </p>
        <div v-if="loading" class="flex justify-center py-4"><SlkFlowerSpinner :size="24" /></div>
        <button v-if="failed && !stale" type="button" class="btn mt-3 btn-outline btn-sm" @click="retry">
          {{ $t("data.dashboard.retry") }}
        </button>
        <button
          v-if="hasMore && !failed"
          type="button"
          class="btn mt-3 w-full btn-outline btn-sm"
          :disabled="loading"
          @click="loadMore"
        >
          {{ $t("data.dashboard.load_more") }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import type { OverviewMetric } from "~/shared/contracts/municipalityOverview";
import { municipalityProductRoute, formatOverviewValue } from "~/utils/municipalityOverview";
const props = defineProps<{
  open: boolean;
  collectionId: string;
  membersUrl: string;
  snapshot: string;
  binIndex: number;
  label: string;
  metric?: OverviewMetric | null | undefined;
}>();
const emit = defineEmits<{ "update:open": [value: boolean]; stale: [] }>();
const { $t, $locale } = useNuxtApp();
const { t } = useSlzLocale();
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
const inputId = useId();
const query = ref("");
let returnFocus: HTMLElement | null = null;
const { rows, count, loading, failed, stale, hasMore, loadMore, retry } = useOverviewMunicipalities(() => ({
  collection: props.collectionId,
  url: props.membersUrl,
  snapshot: props.snapshot,
  bin: props.binIndex,
  query: query.value,
  enabled: props.open,
}));
watch(stale, (value) => {
  if (value) emit("stale");
});
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open && dialog.value && !dialog.value.open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.value.showModal();
    } else if (!open && dialog.value?.open) dialog.value.close();
  },
  { immediate: true },
);
watch(
  () => [props.snapshot, props.binIndex],
  () => {
    query.value = "";
  },
);
function closed() {
  emit("update:open", false);
  returnFocus?.focus();
}
function backdrop(event: MouseEvent) {
  if (event.target === dialog.value) emit("update:open", false);
}
onBeforeUnmount(() => {
  dialog.value?.close();
  returnFocus?.focus();
});
</script>

<style scoped>
.municipality-dialog::backdrop {
  background: rgb(0 0 0 / 35%);
}
@media (prefers-reduced-motion: reduce) {
  .municipality-dialog,
  .modal-box {
    transition: none;
    animation: none;
  }
}
</style>
