<template>
  <div
    :data-wahlcheck-theme="wahlcheckTheme"
    class="elections-flow min-h-screen bg-(--slk-page) text-center text-(--slk-text)"
  >
    <div class="w-full py-8">
      <header class="mb-8">
        <h1 class="mb-4 font-heading text-4xl font-black text-stats-dark sm:text-6xl">
          {{ $t("elections.wahlcheck.header_title") }}
        </h1>
        <p class="mx-auto max-w-3xl text-lg leading-relaxed text-gray">{{ $t("elections.wahlcheck.subtitle") }}</p>
      </header>

      <div v-if="pending && !error" class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <SlkFlowerSpinner class="h-20 w-20 text-light-green" />
          <p class="text-mid-gray">{{ $t("elections.loading_available") }}</p>
        </div>
      </div>

      <div v-else-if="error" class="my-8 border border-red bg-solid-red-10 p-6 text-red">
        <h2 class="mb-4 text-2xl font-bold">{{ $t("generic.loading_error") }}</h2>
        <p class="mb-4">{{ errorMessage }}</p>
        <button class="btn btn-primary" @click="loadElections">{{ $t("generic.try_again") }}</button>
      </div>

      <div v-else-if="publicElections.length === 0" class="my-8 border border-(--slk-border) bg-(--slk-surface) p-6">
        <h2 class="mb-4 text-xl font-bold text-(--slk-text-strong)">{{ $t("elections.no_public_elections.title") }}</h2>
        <p class="text-(--slk-text-muted)">{{ $t("elections.no_public_elections.description") }}</p>
      </div>

      <div v-else class="space-y-10">
        <section>
          <img
            src="~/assets/images/Mach_den-Klima-Wahlcheck.svg"
            :alt="$t('elections.wahlcheck.header_title')"
            class="mx-auto mb-6 h-24 max-w-full object-contain"
          />
          <h2 class="mb-4 font-heading text-3xl font-bold text-stats-dark">
            {{ $t("elections.wahlcheck.intro.title") }}
          </h2>
          <p class="mx-auto max-w-3xl text-lg leading-relaxed text-gray">
            {{ $t("elections.wahlcheck.intro.description") }}
          </p>
          <p
            data-testid="wahlcheck-intro-disclaimer"
            class="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-(--slk-text-muted)"
          >
            {{ $t("elections.wahlcheck.intro.disclaimer") }}
          </p>
        </section>

        <section>
          <h2 class="mb-4 border-b border-(--slk-border) pb-3 text-xl font-bold text-(--slk-text-strong)">
            {{ $t("elections.wahlcheck.available_elections") }}
          </h2>
          <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <NuxtLink
              v-for="election in publicElections"
              :key="election.id"
              :to="{
                path: `/elections/wahlcheck/${election.municipalitySlug || election.localteam?.slug || election.id}`,
                query: wahlcheckQuery,
              }"
              class="group flex h-full min-w-0 flex-col gap-6 border border-(--slk-border) bg-(--slk-surface) p-6 text-(--slk-text) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--slk-text-strong)"
            >
              <div>
                <h3
                  class="text-xl leading-snug font-bold break-words text-(--slk-text-strong) group-hover:underline group-focus-visible:underline"
                >
                  {{ election.descriptor }}
                </h3>
                <p v-if="election.localteam" class="mt-2 break-words text-(--slk-text-muted)">
                  {{ election.localteam.municipality_name || election.localteam.name }}
                </p>
              </div>
              <div
                class="mt-auto space-y-1 border-t border-(--slk-border) pt-4 text-sm leading-relaxed text-(--slk-text-muted)"
              >
                <p>
                  {{
                    $t(election.is_party_election ? "elections.parties_count" : "elections.candidates_count", {
                      ":count": election.candidateCount,
                    })
                  }}
                </p>
                <p>{{ $t("elections.theses_count", { ":count": election.questionCount }) }}</p>
                <p>{{ $t("generic.created_at", { ":date": formatDate(election.date_created) }) }}</p>
              </div>
            </NuxtLink>
          </div>
        </section>

        <section class="border-t border-(--slk-border) pt-6">
          <h2 class="mb-6 font-heading text-3xl font-bold text-stats-dark">
            {{ $t("elections.wahlcheck.how_it_works.title") }}
          </h2>
          <ol class="grid gap-6 md:grid-cols-3">
            <li v-for="step in instructionSteps" :key="step.number">
              <!-- eslint-disable vue/no-v-html -- Icons are prepared from checked-in SVG assets. -->
              <span
                aria-hidden="true"
                class="mx-auto mb-4 flex h-12 w-12 items-center justify-center text-stats-dark [&>svg]:h-full [&>svg]:w-full"
                v-html="step.icon"
              />
              <!-- eslint-enable vue/no-v-html -->
              <h3 class="mb-2 font-bold text-(--slk-text-strong)">
                <span aria-hidden="true" class="mr-1 text-stats-dark">{{ step.number }}.</span>
                {{ $t(`elections.wahlcheck.how_it_works.step${step.number}.title`) }}
              </h3>
              <p class="text-sm leading-relaxed text-(--slk-text-muted)">
                {{ $t(`elections.wahlcheck.how_it_works.step${step.number}.description`) }}
              </p>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import answerIcon from "~/assets/icons/icon_list_view.svg?raw";
import weightingIcon from "~/assets/icons/icon_evaluation_criteria.svg?raw";
import resultsIcon from "~/assets/icons/icon_impact.svg?raw";
import { prepareButtonIcons } from "~/utils/buttonIcons";

import type { z } from "zod";
import type { PublicElectionListSchema } from "~/shared/contracts/elections";
const fetchContent = useContentFetch();
const instructionIcons = prepareButtonIcons(
  { "answers.svg": answerIcon, "weighting.svg": weightingIcon, "results.svg": resultsIcon },
  "canonical",
);
const instructionSteps = [
  { number: 1, icon: instructionIcons.answers },
  { number: 2, icon: instructionIcons.weighting },
  { number: 3, icon: instructionIcons.results },
] as const;
const { wahlcheckTheme, wahlcheckQuery } = useWahlcheckTheme();

const { $t, $locale } = useNuxtApp();
const publicElections = ref<z.output<typeof PublicElectionListSchema>[]>([]);
const pending = ref(true);
const error = ref(false);
const errorMessage = ref("");

// Format date
function formatDate(dateString: string | null) {
  if (!dateString) return $t("generic.unknown");
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString($locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

// Load all public elections from server API
async function loadElections() {
  pending.value = true;
  error.value = false;
  errorMessage.value = "";

  try {
    const elections = await fetchContent("/api/public/wahlcheck");

    if (!elections || elections.length === 0) {
      publicElections.value = [];
      pending.value = false;
      return;
    }

    publicElections.value = elections;
  } catch {
    error.value = true;
    errorMessage.value = $t("elections.loading_error.description");
  } finally {
    pending.value = false;
  }
}

// Load data on mount
onMounted(() => {
  void loadElections();
});

usePageSeo({
  title: $t("elections.wahlcheck.title"),
  description: $t("elections.wahlcheck.meta_description"),
});
</script>
