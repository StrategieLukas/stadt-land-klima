<template>
  <NuxtLink
    :to="`/jobs/${job.slug}`"
    class="group flex h-full flex-col gap-6 border border-(--slk-border) bg-(--slk-surface) p-6 text-(--slk-text) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--slk-text-strong)"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h3
          class="text-xl leading-snug font-bold break-words text-(--slk-text-strong) group-hover:underline group-focus-visible:underline"
        >
          {{ job.role_title }}
        </h3>
        <p v-if="organisationName" class="mt-2 text-base break-words text-(--slk-text-muted)">{{ organisationName }}</p>
      </div>
      <OrganisationLogo :logo="organisation?.logo" :dark-logo="organisation?.logo_dark" />
    </div>
    <div
      class="mt-auto space-y-1 border-t border-(--slk-border) pt-4 text-sm leading-relaxed break-words text-(--slk-text-muted)"
    >
      <p v-if="job.type !== 'volunteer'">{{ typeLabel(job.type) }}</p>
      <p>{{ formatDateRange(job.start_date, job.end_date) }}</p>
      <p v-if="weeklyHours || compensation" class="flex flex-wrap items-baseline gap-x-2">
        <span v-if="weeklyHours" class="min-w-0">{{ weeklyHours }}</span>
        <span v-if="weeklyHours && compensation" aria-hidden="true">·</span>
        <span v-if="compensation" class="min-w-0" :aria-label="`${$t(compensation.label)}: ${compensation.value}`">
          {{ compensation.value }}
        </span>
      </p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { JobType, PublicJobList } from "~/shared/contracts/jobs";
import { jobCompensation } from "~/shared/jobCompensation";

const props = defineProps<{
  job: PublicJobList;
  typeLabel: (type: JobType) => string;
  flexibleDateLabel: string;
}>();

const organisation = computed(() => props.job.organisation);

const organisationName = computed(() => organisation.value?.name || "");
const weeklyHours = computed(() => props.job.weekly_hours?.trim() || "");
const compensation = computed(() => jobCompensation(props.job));
function formatDateRange(startIso?: string | null, endIso?: string | null) {
  if (!startIso) return props.flexibleDateLabel;
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;

  if (!end || end.toDateString() === start.toDateString()) {
    return start.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  }

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${String(start.getDate())}. - ${end.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString("de-DE", { day: "2-digit", month: "long" })} - ${end.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`;
  }

  return `${start.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })} - ${end.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`;
}
</script>
