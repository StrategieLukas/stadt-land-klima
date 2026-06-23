<template>
  <div class="py-8">
    <div class="mb-8 max-w-3xl">
      <h1 class="text-3xl font-bold text-gray-900">{{ $t('jobs.title') }}</h1>
    </div>

    <div v-if="hasJobs" class="space-y-12">
      <section v-if="employmentJobs.length" id="festanstellung">
        <h2 class="mb-4 border-b border-light-green/40 pb-2 text-base font-semibold uppercase tracking-wide text-olive-green">
          {{ $t('jobs.heading.employment') }}
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
        <h2 class="mb-4 border-b border-stats-light pb-2 text-base font-semibold uppercase tracking-wide text-stats-dark">
          {{ $t('jobs.heading.internship_student') }}
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
        <h2 class="mb-4 border-b border-rating-3-light pb-2 text-base font-semibold uppercase tracking-wide text-olive-green">
          {{ $t('jobs.heading.volunteer') }}
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

    <div v-else class="rounded-lg border border-gray-100 bg-white p-6 text-gray-500 shadow-sm">
      {{ $t('jobs.empty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { $directus, $readItems, $t } = useNuxtApp()

useHead({ title: $t('jobs.title') })

const { data: jobs } = await useAsyncData('jobs-list', async () => {
  try {
    return await $directus.request($readItems('job_offers' as never, {
      filter: { status: { _eq: 'published' } },
      fields: [
        'id',
        'role_title',
        'slug',
        'type',
        'status',
        'start_date',
        'end_date',
        'weekly_hours',
        'salary',
        'hourly_wage',
        { organisation: ['id', 'name', 'link', { logo: ['id', 'type'] }] },
      ],
      sort: ['start_date', 'role_title'],
      limit: -1,
    } as never))
  } catch (e: any) {
    console.warn('[jobs] Failed to load job offers:', e?.message)
    return []
  }
})

function typeLabel(type: string) {
  return $t(`jobs.type.${type}`) || type || ''
}

function byType(types: string[]) {
  return (jobs.value || []).filter((job: any) => types.includes(job.type))
}

const employmentJobs = computed(() => byType(['full_time', 'part_time']))
const internshipStudentJobs = computed(() => byType(['internship', 'working_student']))
const volunteerJobs = computed(() => byType(['volunteer']))
const hasJobs = computed(() => employmentJobs.value.length || internshipStudentJobs.value.length || volunteerJobs.value.length)
</script>
