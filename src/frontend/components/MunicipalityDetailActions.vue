<template>
  <nav :aria-label="$t('municipality.hero.actions')" class="space-y-4" data-testid="municipality-sidebar-actions">
    <!-- Statistics Section Link -->
    <NuxtLink
      :to="municipality.ars ? `/data/${municipality.ars}` : '/data'"
      class="slk-municipality-cta slk-municipality-cta--stats flex items-center gap-3 rounded-xs bg-blue-100 p-5 px-6 text-sm font-medium text-blue-600 shadow-list hover:bg-blue-200"
    >
      <img
        src="~/assets/icons/icon_evaluation_criteria.svg"
        alt=""
        class="slk-municipality-cta-icon slk-theme-icon--light h-6 w-6 opacity-60"
      />
      <img
        src="~/assets/icons/icon_evaluation_criteria-dark.svg"
        alt=""
        class="slk-municipality-cta-icon slk-theme-icon--dark h-6 w-6 opacity-60"
      />
      <h3 class="font-heading text-h3">{{ $t("stats.title") }} →</h3>
    </NuxtLink>

    <!-- Kommunalwahl Question Generation Link -->
    <NuxtLink
      :to="`/elections/${municipality.slug}`"
      class="slk-municipality-cta slk-municipality-cta--elections flex items-center gap-3 rounded-xs bg-rating-3-light p-5 px-6 text-sm font-medium text-green shadow-list hover:bg-rating-3/50"
    >
      <img
        src="~/assets/icons/icon_politics.svg"
        alt=""
        class="slk-municipality-cta-icon slk-theme-icon--light h-6 w-6 opacity-60"
      />
      <img
        src="~/assets/icons/icon_politics-dark.svg"
        alt=""
        class="slk-municipality-cta-icon slk-theme-icon--dark h-6 w-6 opacity-60"
      />
      <h3 class="font-heading text-h3">
        {{
          $t("local_elections.title", {
            ":year": municipalElectionYear ?? "",
          })
        }}
        →
      </h3>
    </NuxtLink>

    <NuxtLink
      v-if="complete"
      :to="historyHref"
      class="slk-municipality-cta slk-municipality-cta--history flex items-center gap-3 rounded-xs bg-rating-3-light p-5 px-6 text-sm font-medium text-green shadow-list hover:bg-rating-3/50"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" class="slk-municipality-cta-icon h-6 w-6 shrink-0 opacity-60">
        <path
          fill="currentColor"
          d="M13.5 8H12v5l4.28 2.54l.72-1.21l-3.5-2.08zM13 3a9 9 0 0 0-9 9H1l3.96 4.03L9 12H6a7 7 0 0 1 7-7a7 7 0 0 1 7 7a7 7 0 0 1-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.9 8.9 0 0 0 13 21a9 9 0 0 0 9-9a9 9 0 0 0-9-9"
        />
      </svg>
      <h3 class="font-heading text-h3">{{ $t("municipality.updates.title") }} →</h3>
    </NuxtLink>
  </nav>
</template>
<script setup lang="ts">
import type { MunicipalityScore } from "~/types/components/municipality";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";
import { getStateMunicipalElectionYear } from "~/shared/utils";
const props = defineProps<{ score: MunicipalityScore }>();
const municipality = computed(() => props.score.municipality);
const complete = computed(() => isMunicipalityScoreComplete(props.score));
const municipalElectionYear = computed(() => getStateMunicipalElectionYear(municipality.value.state));
const historyHref = computed(
  () =>
    `/municipalities/updates?${new URLSearchParams({ municipality: municipality.value.slug, v: props.score.catalog_version.name })}`,
);
</script>
