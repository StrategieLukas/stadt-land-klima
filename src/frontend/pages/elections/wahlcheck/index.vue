<template>
  <div class="min-h-screen bg-mild-white">
    <!-- Header -->
    <div class="border-b border-solid-gray-10 bg-white shadow-sm">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <NuxtLink to="/" class="flex items-center gap-3">
          <img
            src="~/assets/images/Stadt-Land-Klima-Logo.svg"
            :alt="$t('logo.alt')"
            class="h-10 w-auto dark:hidden"
          />
          <img
            src="~/assets/images/Stadt-Land-Klima-Logo-dark.svg"
            :alt="$t('logo.alt')"
            class="hidden h-10 w-auto dark:block"
          />
        </NuxtLink>
        <div class="flex-1 text-center">
          <h1 class="text-xl font-bold text-stats-dark">{{ $t("elections.wahlcheck.header_title") }}</h1>
          <p class="text-sm text-mid-gray">{{ $t("elections.wahlcheck.subtitle") }}</p>
        </div>
        <div class="w-10"></div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-4xl px-4 py-12">
      <!-- Loading State -->
      <div v-if="pending && !error" class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <SlkFlowerSpinner class="h-20 w-20 text-ff-green" />
          <p class="text-mid-gray">{{ $t("elections.loading_available") }}</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="my-12 rounded-xl border border-red bg-solid-red-10 p-8 text-center text-red">
        <h2 class="mb-4 text-2xl font-bold">{{ $t("generic.loading_error") }}</h2>
        <p class="mb-4">{{ errorMessage }}</p>
        <button @click="loadElections" class="btn btn-primary">{{ $t("generic.try_again") }}</button>
      </div>

      <!-- No Public Elections -->
      <div
        v-else-if="publicElections.length === 0"
        class="text-orange-800 my-12 rounded-xl border border-orange bg-solid-orange-10 p-8 text-center"
      >
        <div class="mb-6">
          <img
            src="~/assets/images/Stadt-Land-Klima-Blume.svg"
            :alt="$t('logo.alt')"
            class="mx-auto h-24 w-auto opacity-60"
          />
        </div>
        <h2 class="mb-4 text-2xl font-bold">{{ $t("elections.no_public_elections.title") }}</h2>
        <p class="text-mid-gray">
          {{ $t("elections.no_public_elections.description") }}
        </p>
      </div>

      <!-- Elections List -->
      <div v-else class="space-y-8">
        <!-- Hero Section -->
        <div class="rounded-xl border border-solid-gray-10 bg-white p-8 text-center shadow-list">
          <div class="mb-6">
            <img
              src="~/assets/images/Stadt-Land-Klima-Blume.svg"
              :alt="$t('logo.alt')"
              class="mx-auto h-24 w-auto opacity-80"
            />
          </div>
          <h2 class="mb-4 text-2xl font-bold text-stats-dark">
            {{ $t("elections.wahlcheck.intro.title") }}
          </h2>
          <p class="mx-auto max-w-2xl text-lg text-mid-gray">
            {{ $t("elections.wahlcheck.intro.description") }}
          </p>
        </div>

        <!-- Elections Grid -->
        <h3 class="mb-6 text-xl font-bold text-stats-dark">
          {{ $t("elections.wahlcheck.available_elections") }}
        </h3>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="election in publicElections"
            :key="election.id"
            :to="`/elections/wahlcheck/${election.localteam?.municipality_id?.[0]?.slug || election.localteam?.municipality_id?.[0]?.name || election.id}`"
            class="group rounded-xl border border-solid-gray-10 bg-white p-6 shadow-list transition-all duration-300 hover:border-solid-ff-green-30 hover:shadow-xl"
          >
            <div class="mb-4 flex items-start justify-between">
              <div>
                <h4 class="text-lg font-bold text-black transition-colors group-hover:text-ff-green">
                  {{ election.descriptor }}
                </h4>
                <p v-if="election.localteam" class="mt-1 text-sm text-mid-gray">
                  {{ election.localteam.municipality_name || election.localteam.name }}
                </p>
              </div>
              <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-solid-ff-green-10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-ff-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>

            <div class="flex items-center gap-4 text-sm text-mid-gray">
              <div class="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{{ $t("elections.candidates_count", { ":count": election.candidateCount }) }}</span>
              </div>
              <div class="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span>{{ $t("elections.theses_count", { ":count": election.questionCount }) }}</span>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between border-t border-solid-gray-10 pt-4">
              <span class="text-sm text-mid-gray">
                {{ $t("generic.created_at", { ":date": formatDate(election.date_created) }) }}
              </span>
              <span class="rounded-full bg-solid-ff-green-10 px-2 py-1 text-xs font-medium text-ff-green">
                {{ $t("generic.public") }}
              </span>
            </div>
          </NuxtLink>
        </div>

        <!-- How it works section -->
        <div class="mt-12 rounded-xl border border-solid-ff-green-20 bg-solid-ff-green-05 p-8">
          <h3 class="mb-6 text-center text-lg font-bold text-stats-dark">
            {{ $t("elections.wahlcheck.how_it_works.title") }}
          </h3>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div class="text-center">
              <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-solid-ff-green-20">
                <span class="text-2xl font-bold text-ff-green">1</span>
              </div>
              <h4 class="mb-2 font-bold text-stats-dark">{{ $t("elections.wahlcheck.how_it_works.step1.title") }}</h4>
              <p class="text-sm text-mid-gray">
                {{ $t("elections.wahlcheck.how_it_works.step1.description") }}
              </p>
            </div>
            <div class="text-center">
              <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-solid-ff-green-20">
                <span class="text-2xl font-bold text-ff-green">2</span>
              </div>
              <h4 class="mb-2 font-bold text-stats-dark">{{ $t("elections.wahlcheck.how_it_works.step2.title") }}</h4>
              <p class="text-sm text-mid-gray">
                {{ $t("elections.wahlcheck.how_it_works.step2.description") }}
              </p>
            </div>
            <div class="text-center">
              <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-solid-ff-green-20">
                <span class="text-2xl font-bold text-ff-green">3</span>
              </div>
              <h4 class="mb-2 font-bold text-stats-dark">{{ $t("elections.wahlcheck.how_it_works.step3.title") }}</h4>
              <p class="text-sm text-mid-gray">
                {{ $t("elections.wahlcheck.how_it_works.step3.description") }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-20">
      <TheFooterDesktop />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";

const { $directus, $readItems, $t, $locale } = useNuxtApp();

const publicElections = ref([]);
const pending = ref(true);
const error = ref(false);
const errorMessage = ref("");

// Format date
function formatDate(dateString) {
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

// Load all public elections
async function loadElections() {
  pending.value = true;
  error.value = false;
  errorMessage.value = "";

  try {
    // Load elections that are public
    const elections = await $directus.request(
      $readItems("elections", {
        filter: {
          is_public: { _eq: true },
        },
        sort: ["-date_created"],
        fields: [
          "*",
          "localteam.id",
          "localteam.name",
          "localteam.slug",
          "localteam.municipality_name",
          "localteam.municipality_id.slug",
          "localteam.municipality_id.name",
        ],
      }),
    );

    if (!elections || elections.length === 0) {
      publicElections.value = [];
      pending.value = false;
      return;
    }

    // For each election, count candidates and questions
    const electionsWithCounts = [];
    for (const election of elections) {
      try {
        // Count candidates who have answered
        const candidates = await $directus.request(
          $readItems("candidate", {
            filter: {
              election: { _eq: election.id },
              has_answered: { _eq: true },
            },
            limit: -1,
          }),
        );

        // Count published questions
        const questions = await $directus.request(
          $readItems("questions", {
            filter: {
              election: { _eq: election.id },
              status: { _eq: "published" },
            },
            limit: -1,
          }),
        );

        electionsWithCounts.push({
          ...election,
          candidateCount: candidates?.length || 0,
          questionCount: questions?.length || 0,
        });
      } catch (err) {
        // Still add the election with 0 counts
        electionsWithCounts.push({
          ...election,
          candidateCount: 0,
          questionCount: 0,
        });
      }
    }

    publicElections.value = electionsWithCounts.filter((e) => e.candidateCount > 0);
  } catch (err) {
    error.value = true;
    errorMessage.value = $t("elections.loading_error.description");
  } finally {
    pending.value = false;
  }
}

// Load data on mount
onMounted(() => {
  loadElections();
});

// Sort elections by date (newest first) or by candidate count
const sortedElections = computed(() => {
  return [...publicElections.value].sort((a, b) => {
    // Sort by date_created descending (newest first)
    return new Date(b.date_created) - new Date(a.date_created);
  });
});

useHead({
  title: $t("elections.wahlcheck.title"),
  meta: [
    {
      name: "description",
      content: $t("elections.wahlcheck.meta_description"),
    },
  ],
});
</script>

<style scoped>
/* Custom animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Grid item animation */
.grid > * {
  animation: fadeIn 0.5s ease-out forwards;
}

.grid > *:nth-child(1) {
  animation-delay: 0.1s;
}
.grid > *:nth-child(2) {
  animation-delay: 0.2s;
}
.grid > *:nth-child(3) {
  animation-delay: 0.3s;
}
.grid > *:nth-child(4) {
  animation-delay: 0.4s;
}
.grid > *:nth-child(5) {
  animation-delay: 0.5s;
}
.grid > *:nth-child(6) {
  animation-delay: 0.6s;
}
</style>
