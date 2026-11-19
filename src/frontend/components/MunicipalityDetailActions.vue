<template>
  <nav
    :aria-label="$t('municipality.hero.actions')"
    class="space-y-3 rounded-xs border border-(--slk-border) bg-(--slk-surface) p-4 shadow-list"
    data-testid="municipality-sidebar-actions"
  >
    <CanonicalButton
      :href="municipality.ars ? `/data/${municipality.ars}` : '/data'"
      :label="$t('stats.title')"
      icon-slug="icon_evaluation_criteria"
      icon-size="lg"
      variant="outline"
      color="dark"
      class="w-full"
    />
    <CanonicalButton
      :href="`/elections/${municipality.slug}`"
      :label="$t('local_elections.title', { ':year': municipalElectionYear ?? '' })"
      icon-slug="icon_politics"
      icon-size="lg"
      variant="outline"
      color="dark-green"
      class="w-full"
    />
    <CanonicalButton
      v-if="complete"
      :href="historyHref"
      :label="$t('municipality.updates.title')"
      icon-slug="icon_history"
      icon-size="lg"
      variant="outline"
      color="dark-green"
      class="w-full"
    />
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
