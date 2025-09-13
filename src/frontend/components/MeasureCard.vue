<template>
  <article :id="`measure-${measure.slug}`" class="card card-compact shadow">
    <div class="card-body">
      <h2 class="font-heading text-h2 font-bold text-gray">
        {{ measure.translations[0].name }}
      </h2>

      <div>
        ID: {{ measure.measure_id }}
      </div>

      <div class="divide-y-2 divide-light-blue md:px-1 lg:px-2">
        <MeasureDetails :measure_rating="{'measure': measure}" />

        <MeasureDescriptions :measure="measure" />
      </div>
      <p class="text-center">
        {{ t("last_updated_at") + lastUpdatedAtStr }}
      </p>
    </div>
  </article>
</template>
<script setup>
import { defineProps } from "vue";
import MeasureDetails from "./MeasureDetails.vue";
import MeasureDescriptions from "./MeasureDescriptions.vue";

const { t, locale } = useI18n();
const props = defineProps({
  measure: {
    type: Object,
    required: true,
  },
});
let lastUpdatedAtStr = ref("");
onMounted(() => {
  const lastUpdatedAt = new Date(props.measure.date_updated);
  lastUpdatedAtStr.value =
    lastUpdatedAt.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString(locale);
});
</script>
