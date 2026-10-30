<template>
  <header class="mb-8 pt-2 sm:pt-4">
    <p class="mb-3 text-sm font-semibold text-gray">
      <template v-if="municipality.state">{{ municipality.state }} <span aria-hidden="true">·</span> </template
      >{{ score.catalog_version.name }}
      <span v-if="!complete" class="ml-2 badge badge-outline">{{ $t("municipality.hero.preview") }}</span>
    </p>
    <h1 class="mb-4 font-heading text-4xl leading-tight font-black break-words text-light-green sm:text-6xl">
      {{ municipality.name }}
    </h1>
    <p class="max-w-3xl text-lg leading-relaxed text-gray">
      {{ $t("municipality.hero.description", { ":municipality": municipality.name }) }}
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <CanonicalButton
        href="#assessment"
        :label="$t('municipality.hero.explore')"
        icon-slug="icon_evaluation_criteria"
        color="bright-green"
      />
      <CanonicalButton
        :href="contactHref"
        :label="$t('municipality.hero.participate')"
        icon-slug="icon_team"
        color="bright-green"
      />
    </div>
    <div class="my-6 max-w-xl rounded-sm border border-base-300 bg-base-100 p-4">
      <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>{{ $t("municipality.hero.score") }}</span>
        <span v-if="complete && score.rank" class="font-semibold">{{
          $t("municipality.hero.rank", { ":rank": score.rank })
        }}</span>
      </div>
      <ProgressBar :score-total="Number(score.score_total)" />
    </div>
    <nav
      :aria-label="$t('municipality.hero.actions')"
      class="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-semibold text-gray"
    >
      <NuxtLink
        v-if="complete"
        :to="historyHref"
        class="underline decoration-gray/40 underline-offset-4 hover:decoration-current"
      >
        {{ $t("municipality.updates.title") }}
      </NuxtLink>
      <PdfExportForm
        v-if="complete"
        :action="`/api/pdf/municipality/${municipality.slug}`"
        :request="{ slug: municipality.slug, catalogVersion: score.catalog_version.name }"
      >
        <button
          type="submit"
          class="cursor-pointer underline decoration-gray/40 underline-offset-4 hover:decoration-current"
        >
          {{ $t("municipality.hero.pdf") }}
        </button>
      </PdfExportForm>
      <NuxtLink
        v-if="municipality.ars"
        :to="`/data/${municipality.ars}`"
        class="underline decoration-gray/40 underline-offset-4 hover:decoration-current"
        >{{ $t("municipality.hero.data") }}</NuxtLink
      >
      <NuxtLink
        :to="`/stats?v=${encodeURIComponent(score.catalog_version.name)}`"
        class="underline decoration-gray/40 underline-offset-4 hover:decoration-current"
        >{{ $t("stats.title") }}</NuxtLink
      >
      <NuxtLink
        v-if="electionYear"
        :to="`/elections/${municipality.slug}`"
        class="underline decoration-gray/40 underline-offset-4 hover:decoration-current"
        >{{ $t("local_elections.title", { ":year": electionYear }) }}</NuxtLink
      >
      <NuxtLink :to="feedbackHref" class="underline decoration-gray/40 underline-offset-4 hover:decoration-current">{{
        $t("feedback.link.feedback_on_rating")
      }}</NuxtLink>
    </nav>
  </header>
</template>
<script setup lang="ts">
import type { MunicipalityScore } from "~/types/components/municipality";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";
import { getStateMunicipalElectionYear } from "~/shared/utils";
const props = defineProps<{ score: MunicipalityScore }>();
const { $t } = useNuxtApp();
const municipality = computed(() => props.score.municipality);
const complete = computed(() => isMunicipalityScoreComplete(props.score));
const electionYear = computed(() => getStateMunicipalElectionYear(municipality.value.state));
const historyHref = computed(
  () =>
    `/municipalities/updates?${new URLSearchParams({ municipality: municipality.value.slug, v: props.score.catalog_version.name })}`,
);
const pageHref = computed(
  () => `/municipalities/${municipality.value.slug}?v=${encodeURIComponent(props.score.catalog_version.name)}`,
);
const contactHref = computed(
  () =>
    `/contact?${new URLSearchParams({ type: "cooperation", title: $t("municipality.hero.contact_title", { ":municipality": municipality.value.name }), content: $t("municipality.hero.contact_content", { ":municipality": municipality.value.name, ":link": pageHref.value }) })}`,
);
const feedbackHref = computed(
  () =>
    `/contact?${new URLSearchParams({ type: "suggestion", title: $t("municipality.hero.feedback_title", { ":municipality": municipality.value.name }), content: $t("municipality.hero.feedback_content", { ":municipality": municipality.value.name, ":link": pageHref.value }) })}`,
);
</script>
