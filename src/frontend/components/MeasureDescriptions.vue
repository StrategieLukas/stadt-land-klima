<template>
  <!-- Accordion -->
  <div class="grid grid-cols-1 gap-8 py-4 lg:grid-cols-2">
    <!-- Description benefit -->
    <div v-if="measure.description_benefit" class="collapse-plus collapse">
      <input type="checkbox" :name="`measure-${measure.slug}-descriptions-accordion`" autocomplete="off" />

      <div class="collapse-title px-2 pl-0 md:px-4">
        <h3 class="mt-0 font-heading text-h2 leading-none text-black">
          {{ $t("measure.description_benefit_heading") }}
        </h3>
      </div>

      <div class="collapse-content pl-0">
        <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_benefit)" />
      </div>
    </div>

    <!-- Description verification -->
    <div v-if="measure.description_verification" class="collapse-plus collapse">
      <input type="checkbox" :name="`measure-${measure.slug}-descriptions-accordion`" autocomplete="off" />

      <div class="collapse-title px-2 pl-0 md:px-4">
        <h3 class="mt-0 font-heading text-h2 leading-none text-black">
          {{ $t("measure.description_verification_heading") }}
        </h3>
      </div>

      <div class="collapse-content pl-0">
        <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_verification)" />
      </div>
    </div>

    <!-- Description contribution -->
    <div v-if="measure.description_contribution" class="collapse-plus collapse">
      <input type="checkbox" :name="`measure-${measure.slug}-descriptions-accordion`" autocomplete="off" />

      <div class="collapse-title px-2 pl-0 md:px-4">
        <h3 class="mt-0 font-heading text-h2 leading-none text-black">
          {{ $t("measure.description_contribution_heading") }}
        </h3>
      </div>

      <div class="collapse-content pl-0">
        <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_contribution)" />
      </div>
    </div>

    <!-- Description implementation -->
    <div v-if="measure.description_implementation" class="collapse-plus collapse">
      <input type="checkbox" :name="`measure-${measure.slug}-descriptions-accordion`" autocomplete="off" />

      <div class="collapse-title px-2 pl-0 md:px-4">
        <h3 class="mt-0 font-heading text-h2 leading-none text-black">
          {{ $t("measure.description_implementation_heading") }}
        </h3>
      </div>

      <div class="collapse-content pl-0">
        <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_implementation)" />
      </div>
    </div>

    <!-- Description legal -->
    <div v-if="measure.description_legal" class="collapse-plus collapse">
      <input type="checkbox" :name="`measure-${measure.slug}-descriptions-accordion`" autocomplete="off" />

      <div class="collapse-title px-2 pl-0 md:px-4">
        <h3 class="mt-0 font-heading text-h2 leading-none text-black">
          {{ $t("measure.description_legal_heading") }}
        </h3>
      </div>

      <div class="collapse-content pl-0">
        <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_legal)" />
      </div>
    </div>

    <!-- Description funding -->
    <div v-if="measure.description_funding" class="collapse-plus collapse">
      <input type="checkbox" :name="`measure-${measure.slug}-descriptions-accordion`" autocomplete="off" />

      <div class="collapse-title px-2 pl-0 md:px-4">
        <h3 class="mt-0 font-heading text-h2 leading-none text-black">
          {{ $t("measure.description_funding_heading") }}
        </h3>
      </div>

      <div class="collapse-content pl-0">
        <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_funding)" />
      </div>
    </div>

    <!-- Description tutorial -->
    <div v-if="measure.description_tutorial" class="collapse-plus collapse">
      <input type="checkbox" :name="`measure-${measure.slug}-descriptions-accordion`" autocomplete="off" />

      <div class="collapse-title px-2 pl-0 md:px-4">
        <h3 class="mt-0 font-heading text-h2 leading-none text-black">
          {{ $t("measure.description_tutorial_heading") }}
        </h3>
      </div>

      <div class="collapse-content pl-0">
        <div class="has-long-links prose" v-html="sanitizeHtml(measure.description_tutorial)" />
      </div>
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
