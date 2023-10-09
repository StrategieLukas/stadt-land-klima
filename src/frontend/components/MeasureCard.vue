<template>
  <article
    :id="`measure-${measure.slug}`"
    class="card card-compact shadow"
  >
    <div class="card-body">
      <h2 class="font-heading text-gray text-h2 font-bold">
        {{ measure.name }}
      </h2>

      <div class="divide-y-2 divide-light-blue">
        <div
          v-if="measure.description_evaluation_criteria"
          class="py-4"
        >
          <h3 class="font-heading text-light-blue text-h3 mb-2">
            {{ $t('measure.evaluation_criteria_heading') }}
          </h3>

          <div class="mb-2 flex flex-col xs:flex-row items-start gap-4">
            <figure class="flex flex-col mt-0">
              <img src="~/assets/icons/icon_evaluation_criteria.svg" alt="" class="h-auto w-18 opacity-50" />
              <figcaption class="text-center mt-0">
                {{ $t('measure.evaluation_criteria_icon_caption') }}
              </figcaption>
            </figure>

            <div
              class="prose"
              v-html="measure.description_evaluation_criteria"
            />
          </div>
        </div>

        <div class="py-4">
          <h3 class="font-heading text-light-blue text-h3 mb-2">
            {{ $t('measure.feasibility_heading') }}
          </h3>

          <div class="grid grid-cols-2 xs:grid-cols-3 justify-between gap-4">
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

        <!-- Accordion -->
        <div class="py-4">
          <!-- Description about -->
          <div
            v-if="measure.description_about"
            class="collapse collapse-plus"
          >
            <input type="radio" :name="`measure-${measure.slug}-descriptions-accordion`" />

            <div class="collapse-title pl-0">
              <h3 class="font-heading text-h2 text-black mt-0">
                {{ $t("measure.description_about_heading") }}
              </h3>
            </div>

            <div class="collapse-content pl-0">
              <div class="prose" v-html="measure.description_about" />
            </div>
          </div>

          <!-- Description benefit -->
          <div
            v-if="measure.description_benefit"
            class="collapse collapse-plus"
          >
            <input type="radio" :name="`measure-${measure.slug}-descriptions-accordion`" />

            <div class="collapse-title pl-0">
              <h3 class="font-heading text-h2 text-black mt-0">
                {{ $t("measure.description_benefit_heading") }}
              </h3>
            </div>

            <div class="collapse-content pl-0">
              <div class="prose" v-html="measure.description_benefit" />
            </div>
          </div>

          <!-- Description verification -->
          <div
            v-if="measure.description_verification"
            class="collapse collapse-plus"
          >
            <input type="radio" :name="`measure-${measure.slug}-descriptions-accordion`" />

            <div class="collapse-title pl-0">
              <h3 class="font-heading text-h2 text-black mt-0">
                {{ $t("measure.description_verification_heading") }}
              </h3>
            </div>

            <div class="collapse-content pl-0">
              <div class="prose" v-html="measure.description_verification" />
            </div>
          </div>

          <!-- Description contribution -->
          <div
            v-if="measure.description_contribution"
            class="collapse collapse-plus"
          >
            <input type="radio" :name="`measure-${measure.slug}-descriptions-accordion`" />

            <div class="collapse-title pl-0">
              <h3 class="font-heading text-h2 text-black mt-0">
                {{ $t("measure.description_contribution_heading") }}
              </h3>
            </div>

            <div class="collapse-content pl-0">
              <div class="prose" v-html="measure.description_contribution" />
            </div>
          </div>

          <!-- Description implementation -->
          <div
            v-if="measure.description_implementation"
            class="collapse collapse-plus"
          >
            <input type="radio" :name="`measure-${measure.slug}-descriptions-accordion`" />

            <div class="collapse-title pl-0">
              <h3 class="font-heading text-h2 text-black mt-0">
                {{ $t("measure.description_implementation_heading") }}
              </h3>
            </div>

            <div class="collapse-content pl-0">
              <div class="prose" v-html="measure.description_implementation" />
            </div>
          </div>

          <!-- Description legal -->
          <div
            v-if="measure.description_legal"
            class="collapse collapse-plus"
          >
            <input type="radio" :name="`measure-${measure.slug}-descriptions-accordion`" />

            <div class="collapse-title pl-0">
              <h3 class="font-heading text-h2 text-black mt-0">
                {{ $t("measure.description_legal_heading") }}
              </h3>
            </div>

            <div class="collapse-content pl-0">
              <div class="prose" v-html="measure.description_legal" />
            </div>
          </div>

          <!-- Description funding -->
          <div
            v-if="measure.description_funding"
            class="collapse collapse-plus"
          >
            <input type="radio" :name="`measure-${measure.slug}-descriptions-accordion`" />

            <div class="collapse-title pl-0">
              <h3 class="font-heading text-h2 text-black mt-0">
                {{ $t("measure.description_funding_heading") }}
              </h3>
            </div>

            <div class="collapse-content pl-0">
              <div class="prose" v-html="measure.description_funding" />
            </div>
          </div>

          <!-- Description tutorial -->
          <div
            v-if="measure.description_tutorial"
            class="collapse collapse-plus"
          >
            <input type="radio" :name="`measure-${measure.slug}-descriptions-accordion`" />

            <div class="collapse-title pl-0">
              <h3 class="font-heading text-h2 text-black mt-0">
                {{ $t("measure.description_tutorial_heading") }}
              </h3>
            </div>

            <div class="collapse-content pl-0">
              <div class="prose" v-html="measure.description_tutorial" />
            </div>
          </div>
        </div>
      </div>
      <p class="text-center">
        {{ $t("last_updated_at", { ":updated_at": lastUpdatedAtStr }) }}
      </p>
    </div>
  </article>
</template>
<script setup>
import { defineProps, computed } from 'vue';
const { $t, $locale } = useNuxtApp();
const props = defineProps({
  measure:{
    type: Object,
    required: true
  },
});
const lastUpdatedAtStr = computed(() => {
  const lastUpdatedAt = new Date(props.measure.date_updated);
  return (
    lastUpdatedAt.toLocaleDateString($locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString($locale)
  );
});

</script>
