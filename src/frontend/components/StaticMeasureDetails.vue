<template>
  <div class="mt-4 py-4 p-4 mb-4">
    <h3 class="mb-3 text-h3 font-bold text-black">
      {{ $t("measure.description_about_heading") }}
    </h3>

    <div v-if="measure.description_about" class="mb-2 flex flex-row measure_ratings-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_info.svg" alt="" class="h-auto w-10 opacity-50" />
      </figure>
      <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_about)" />
    </div>
  </div>

  <div v-if="measure.description_evaluation_criteria" class="p-4 border-t-4 border-gray-300p-4 mb-4">
    <h3 class="mb-3 text-h3 font-bold text-black">
      {{ $t("measure.evaluation_criteria_heading") }}
    </h3>

    <div class="mb-2 flex flex-row measure_ratings-start gap-4">
      <figure class="mt-0 flex shrink-0 flex-col">
        <img src="~/assets/icons/icon_evaluation_criteria.svg" alt="" class="h-auto w-10 opacity-50" />
      </figure>

      <div class="has-long-links prose" v-html="measure.description_evaluation_criteria" />
    </div>
  </div>

  <div class="border-t-4 border-gray-300 p-4 mb-4">
    <h3 class="mb-3 text-h3 font-bold text-black">
      {{ $t("measure.feasibility_heading") }}
    </h3>

    <div class="flex flex-row width-full justify-around">
      <FeasibilityBarChart
        key="impact"
        icon="/assets/icons/icon_impact.svg"
        :label="$t('measure.impact_label')"
        :value="Number(measure.impact)"
      />

      <FeasibilityBarChart
        key="politics"
        icon="/assets/icons/icon_politics.svg"
        :label="$t('measure.feasibility_political_label')"
        :value="Number(measure.feasibility_political)"
      />

      <FeasibilityBarChart
        key="invest"
        icon="/assets/icons/icon_invest.svg"
        :label="$t('measure.feasibility_economical_label')"
        :value="Number(measure.feasibility_economical)"
      />
    </div>
  </div>
</template>

<script setup>
import sanitizeHtml from "sanitize-html";

  const props = defineProps({
    measure: {
      type: Object,
      required: true,
    },
  });
</script>