<template>
  <div class="py-8">
    <header class="mb-8">
      <h1 class="mb-4 font-heading text-4xl font-black text-orange sm:text-6xl">{{ $t("jobs.title") }}</h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("jobs.description") }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <CanonicalButton
          :label="$t('stats.participate')"
          href="/mitmachen"
          icon-slug="mdi:account-group-outline"
          color="orange"
          text-color="white"
        />
        <CanonicalButton
          :label="$t('organisation.title')"
          href="/organisation"
          icon-slug="mdi:information-outline"
          color="orange"
          text-color="white"
        />
      </div>
    </header>

    <div v-if="hasJobs" class="space-y-12">
      <section v-if="employmentJobs.length" id="festanstellung">
        <h2
          class="mb-4 border-b border-solid-light-green-40 pb-2 text-base font-semibold uppercase tracking-wide text-olive-green"
        >
          {{ $t("jobs.heading.employment") }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <JobOfferCard
            v-for="job in employmentJobs"
            :key="job.id"
            :job="job"
            :type-label="typeLabel"
            :flexible-date-label="$t('jobs.date.flexible')"
          />
        </div>
      </section>

      <section v-if="internshipStudentJobs.length" id="praktika-werkstudi">
        <h2
          class="mb-4 border-b border-stats-light pb-2 text-base font-semibold uppercase tracking-wide text-stats-dark"
        >
          {{ $t("jobs.heading.internship_student") }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <JobOfferCard
            v-for="job in internshipStudentJobs"
            :key="job.id"
            :job="job"
            :type-label="typeLabel"
            :flexible-date-label="$t('jobs.date.flexible')"
          />
        </div>
      </section>

      <section v-if="volunteerJobs.length" id="ehrenamt">
        <h2
          class="mb-4 border-b border-rating-3-light pb-2 text-base font-semibold uppercase tracking-wide text-olive-green"
        >
          {{ $t("jobs.heading.volunteer") }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <JobOfferCard
            v-for="job in volunteerJobs"
            :key="job.id"
            :job="job"
            :type-label="typeLabel"
            :flexible-date-label="$t('jobs.date.flexible')"
          />
        </div>
      </section>
    </div>

    <div v-else class="border-gray-100 text-gray-500 rounded-lg border bg-white p-6 shadow-sm">
      {{ $t("jobs.empty") }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { JobType } from "~/shared/contracts/jobs";

const { $t } = useNuxtApp();

useHead({ title: $t("jobs.title") });

const { data: jobsData } = await useAsyncData("jobs-list", () => $fetch("/api/public/jobs"));

const jobs = computed(() => jobsData.value?.jobs ?? []);

function typeLabel(type: JobType) {
  return $t(`jobs.type.${type}`) || type || "";
}

function byType(types: JobType[]) {
  return jobs.value.filter((job) => types.includes(job.type));
}

const employmentJobs = computed(() => byType(["full_time", "part_time"]));
const internshipStudentJobs = computed(() => byType(["internship", "working_student"]));
const volunteerJobs = computed(() => byType(["volunteer"]));
const hasJobs = computed(
  () => employmentJobs.value.length || internshipStudentJobs.value.length || volunteerJobs.value.length,
);
</script>
