<template>
  <div v-if="measure.description_about" class="py-4">
    <h3 class="mb-2 font-heading text-h3 text-light-blue">
      {{ $t("measure.description_about_heading") }}
    </h3>

    <div class="mb-2 flex flex-row items-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_info.svg" alt="" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
        <figcaption class="mt-0 text-center">
          {{ $t("measure.description_about_icon_caption") }}
        </figcaption>
      </figure>

      <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_about)" />
    </div>
  </div>

  <div v-if="measure.description_evaluation_criteria" class="py-4">
    <h3 class="mb-2 font-heading text-h3 text-light-blue">
      {{ $t("measure.evaluation_criteria_heading") }}
    </h3>

    <div class="mb-2 flex flex-row items-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_evaluation_criteria.svg" alt="" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
        <figcaption class="mt-0 text-center">
          {{ $t("measure.evaluation_criteria_icon_caption") }}
        </figcaption>
      </figure>

      <div class="has-long-links prose" v-html="measure.description_evaluation_criteria" />
    </div>
  </div>

  <div class="py-4">
    <h3 class="mb-2 font-heading text-h3 text-light-blue">
      {{ $t("measure.feasibility_heading") }}
    </h3>

    <div class="grid max-w-md grid-cols-3 justify-between gap-4">
      <FeasibilityBarChart
        key="impact"
        class="xs:mr-auto"
        icon="/assets/icons/icon_impact.svg"
        :label="$t('measure.impact_label')"
        :value="Number(measure.impact)"
      />

      <FeasibilityBarChart
        key="politics"
        class="xs:mx-auto"
        icon="/assets/icons/icon_politics.svg"
        :label="$t('measure.feasibility_political_label')"
        :value="Number(measure.feasibility_political)"
      />

      <FeasibilityBarChart
        key="invest"
        class="xs:ml-auto"
        icon="/assets/icons/icon_invest.svg"
        :label="$t('measure.feasibility_economical_label')"
        :value="Number(measure.feasibility_economical)"
      />
    </div>
  </div>
</template>
<script setup>
import { defineProps } from "vue";
import sanitizeHtml from "sanitize-html";
const { $t, $locale } = useNuxtApp();
const props = defineProps({
  measure: {
    type: Object,
    required: true,
  },
});
</script>
