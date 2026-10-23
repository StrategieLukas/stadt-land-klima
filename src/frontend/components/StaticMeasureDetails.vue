<template>
  <div v-if="!hideAbout" id="section-about" class="py-6" style="scroll-margin-top: var(--section-scroll-mt, 9rem)">
    <h2 class="mb-4 font-heading text-h3 font-bold text-gray">
      {{ $t("measure.description_about_heading") }}
    </h2>

    <div v-if="measure.description_about" class="measure_ratings-start mb-2 flex flex-row gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img
          src="~/assets/icons/icon_info.svg"
          alt=""
          class="slk-sector-detail-icon slk-theme-icon--light h-auto w-10 opacity-50"
        />
        <img
          src="~/assets/icons/icon_info-dark.svg"
          alt=""
          class="slk-sector-detail-icon slk-theme-icon--dark h-auto w-10 opacity-50"
        />
      </figure>
      <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_about)" />
    </div>
  </div>

  <div
    v-if="measure.description_evaluation_criteria"
    id="section-criteria"
    class="border-t-2 border-light-blue py-6"
    style="scroll-margin-top: var(--section-scroll-mt, 9rem)"
  >
    <h2 class="mb-4 font-heading text-h3 font-bold text-gray">
      {{ $t("measure.evaluation_criteria_heading") }}
    </h2>

    <div class="measure_ratings-start mb-2 flex flex-row gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img
          src="~/assets/icons/icon_evaluation_criteria.svg"
          alt=""
          class="slk-sector-detail-icon slk-theme-icon--light h-auto w-10 opacity-50"
        />
        <img
          src="~/assets/icons/icon_evaluation_criteria-dark.svg"
          alt=""
          class="slk-sector-detail-icon slk-theme-icon--dark h-auto w-10 opacity-50"
        />
      </figure>

      <div
        class="has-long-links prose whitespace-pre-line"
        v-html="sanitizeHtml(measure.description_evaluation_criteria)"
      />
    </div>
  </div>

  <div
    id="section-feasibility"
    class="border-t-2 border-light-blue py-6"
    style="scroll-margin-top: var(--section-scroll-mt, 9rem)"
  >
    <h2 class="mb-4 font-heading text-h3 font-bold text-gray">
      {{ $t("measure.feasibility_heading") }}
    </h2>

    <div class="width-full flex flex-row justify-around">
      <FeasibilityBarChart
        key="impact"
        :icon="iconImpact"
        :dark-icon="iconImpactDark"
        :label="$t('measure.impact_label')"
        :value="Number(measure.impact)"
      />

      <FeasibilityBarChart
        key="politics"
        :icon="iconPolitics"
        :dark-icon="iconPoliticsDark"
        :label="$t('measure.feasibility_political_label')"
        :value="Number(measure.feasibility_political)"
      />

      <FeasibilityBarChart
        key="invest"
        :icon="iconInvest"
        :dark-icon="iconInvestDark"
        :label="$t('measure.feasibility_economical_label')"
        :value="Number(measure.feasibility_economical)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { Measure } from "~/types/components/municipality";

import sanitizeHtml from "sanitize-html";
const iconImpact = "/icons/icon_impact.svg";
const iconImpactDark = "/icons/icon_impact-dark.svg";
const iconPolitics = "/icons/icon_politics.svg";
const iconPoliticsDark = "/icons/icon_politics-dark.svg";
const iconInvest = "/icons/icon_invest.svg";
const iconInvestDark = "/icons/icon_invest-dark.svg";

const _props = defineProps({
  measure: {
    type: Object as PropType<Measure>,
    required: true,
  },
  hideAbout: {
    type: Boolean as PropType<boolean | undefined>,
    default: false,
  },
});
</script>
