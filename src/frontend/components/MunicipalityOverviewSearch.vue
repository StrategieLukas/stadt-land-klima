<template>
  <div class="relative">
    <label :for="inputId" class="mb-1 block text-sm font-semibold">{{ $t("data.dashboard.search") }}</label>
    <input
      :id="inputId"
      v-model="query"
      type="search"
      maxlength="200"
      class="input w-full"
      :placeholder="$t('data.dashboard.search_placeholder')"
      :aria-controls="resultsId"
    />
    <div
      v-if="query.trim().length >= 2"
      :id="resultsId"
      class="mt-2 max-h-72 overflow-auto rounded-lg border border-(--slk-border) bg-(--slk-surface) p-2"
      :aria-busy="loading"
    >
      <p v-if="loading" role="status" class="p-2">{{ $t("generic.loading") }}</p>
      <p v-else-if="failed" role="alert" class="p-2">
        {{ $t(stale ? "data.dashboard.snapshot_updated" : "generic.loading_error") }}
      </p>
      <ul>
        <li v-for="row in rows" :key="row.ars">
          <NuxtLink
            :to="municipalityProductRoute(collectionId, row)"
            class="block rounded-sm p-2 hover:bg-(--slk-surface-subdued) focus-visible:outline-2 focus-visible:outline-stats-dark"
          >
            <span class="flex flex-wrap justify-between gap-2"
              ><strong>{{ row.name }}</strong
              ><span
                >{{ formatOverviewValue(row.value, metric, $locale) ?? $t("generic.no_data") }}
                <span v-if="row.value !== null && metric.percentage_representation === 'none'">{{
                  t(metric.unit)
                }}</span></span
              ></span
            >
            <span class="text-xs text-(--slk-text-subtle)">{{
              [row.prefix, row.district_name, row.state_name].filter(Boolean).join(" · ")
            }}</span>
            <span v-if="row.data_status === 'excluded'" class="block text-xs text-(--slk-text-subtle)">{{
              $t("data.dashboard.excluded_count")
            }}</span>
          </NuxtLink>
        </li>
      </ul>
      <p v-if="!loading && !failed && !rows.length" class="p-2">{{ $t("administrative_areas.search.no_results") }}</p>
      <button
        v-if="hasMore"
        type="button"
        class="btn mt-2 w-full btn-ghost btn-sm"
        :disabled="loading"
        @click="loadMore"
      >
        {{ $t("data.dashboard.load_more") }}
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, useId, watch } from "vue";
import type { OverviewMetric } from "~/shared/contracts/municipalityOverview";
import { municipalityProductRoute, formatOverviewValue } from "~/utils/municipalityOverview";
const props = defineProps<{ collectionId: string; url: string; snapshot: string; metric: OverviewMetric }>();
const emit = defineEmits<{ stale: [] }>();
const { $t, $locale } = useNuxtApp();
const { t } = useSlzLocale();
const query = ref("");
const inputId = useId();
const resultsId = useId();
const { rows, loading, failed, stale, hasMore, loadMore } = useOverviewMunicipalities(() => ({
  collection: props.collectionId,
  url: props.url,
  snapshot: props.snapshot,
  query: query.value,
  enabled: query.value.trim().length >= 2,
}));
watch(stale, (value) => {
  if (value) emit("stale");
});
watch(
  () => props.snapshot,
  () => {
    query.value = "";
  },
);
</script>
