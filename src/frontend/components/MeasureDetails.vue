<template>
  <div class="py-4">

    <h3 class="mb-3 text-h3 font-heading text-light-blue">
      {{ $t("measure.description_about_heading") }}
    </h3>

    <div v-if="measure_rating.measure.description_about" class="mb-2 flex flex-row measure_ratings-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_info.svg" alt="" class="h-auto w-10 opacity-50" />
      </figure>
      <div class="has-long-links prose" v-html="sanitizeHtml(measure_rating.measure.description_about)" />
    </div>
  </div>

  <div v-if="measure_rating.measure.description_evaluation_criteria" class="py-4">
    <h3 class="mb-3 text-h3 font-heading text-light-blue">
      {{ $t("measure.evaluation_criteria_heading") }}
    </h3>

    <div class="mb-2 flex flex-row measure_ratings-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_evaluation_criteria.svg" alt="" class="h-auto w-10 opacity-50" />
      </figure>

      <div class="has-long-links prose" v-html="measure_rating.measure.description_evaluation_criteria" />
    </div>
  </div>

  <div class="py-4">
    <h3 class="mb-3 text-h3 font-heading text-light-blue">
      {{ $t("measure.feasibility_heading") }}
    </h3>

    <div class="grid max-w-md grid-cols-3 justify-between gap-4">
      <FeasibilityBarChart
        key="impact"
        class="xs:mr-auto"
        icon="/assets/icons/icon_impact.svg"
        :label="$t('measure.impact_label')"
        :value="Number(measure_rating.measure.impact)"
      />

      <FeasibilityBarChart
        key="politics"
        class="xs:mx-auto"
        icon="/assets/icons/icon_politics.svg"
        :label="$t('measure.feasibility_political_label')"
        :value="Number(measure_rating.measure.feasibility_political)"
      />

      <FeasibilityBarChart
        key="invest"
        class="xs:ml-auto"
        icon="/assets/icons/icon_invest.svg"
        :label="$t('measure.feasibility_economical_label')"
        :value="Number(measure_rating.measure.feasibility_economical)"
      />
    </div>
  </div>

  <div v-if="measure_rating.applicable">
    <div v-if="measure_rating.current_progress" class="mb-4">
      <h4 class="mb-2 text-light-blue">
        {{ $t("ratings_measure.achievement_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(measure_rating.current_progress)" />
    </div>
    <div v-if="measure_rating.source">
      <h4 class="mb-2 text-light-blue">
        {{ $t("ratings_measure.source_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(measure_rating.source)" />
    </div>
    <dl v-if="measure_rating.date_updated" class="mt-2 flex flex-row gap-2 text-sm">
      <dt class="font-bold">{{ $t("ratings_measure.last_updated") }}:</dt>
      <dd>{{ formatLastUpdated(measure_rating.date_updated, $locale) }}</dd>
    </dl>
  </div>

  <div v-if="!measure_rating.applicable">
    <div v-if="measure_rating.why_not_applicable">
      <h4 class="mb-2 text-light-blue">
        {{ $t("ratings_measure.why_not_applicable_heading") }}
      </h4>

      <div class="has-long-links prose whitespace-pre-line" v-html="linkifyStr(measure_rating.why_not_applicable)" />
    </div>
  </div>

  <div class="mt-8">
    <NuxtLink
      :to="`/measures/sectors/${sector}#measure-${measure_rating.measure.slug}`"
      class="text-light-blue underline"
      target="measure"
    >
      {{ $t("municipality_rating.link_to_measure") }} ↗
    </NuxtLink>
  </div>

  <div>
    <p v-if="rating < 1">Kommunen, die diese Maßnahme besser umgesetzt haben:</p>
  </div>
</template>
<script setup>
import { defineProps } from "vue";
import sanitizeHtml from "sanitize-html";
import linkifyStr from "linkify-string";
import { formatLastUpdated } from "../shared/utils.js";

const { $t, $locale } = useNuxtApp();
const props = defineProps({
  measure_rating: {
    type: Object,
    required: true,
  },
});



</script>
