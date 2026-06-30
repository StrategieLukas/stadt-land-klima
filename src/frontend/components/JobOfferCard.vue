<template>
  <NuxtLink
    :to="`/jobs/${job.slug}`"
    class="group block h-full rounded-lg border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-light-green hover:shadow-md"
  >
    <div class="flex h-full flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <span
            class="mb-2 inline-flex rounded-full bg-solid-light-green-10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-olive-green"
          >
            {{ typeLabel(job.type) }}
          </span>
          <h3 class="line-clamp-3 text-lg font-bold leading-snug text-gray-900 group-hover:text-olive-green">
            {{ job.role_title }}
          </h3>
        </div>

        <div
          v-if="hasOrganisationIdentity"
          class="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100 bg-mild-white"
          :aria-label="organisationName"
        >
          <SmartImg
            v-if="organisationLogo"
            :assetId="organisationLogoAssetId"
            :isRaster="organisationLogoIsRaster"
            :alt="organisationName"
            :width="96"
            :height="96"
            fit="contain"
            img-class="h-full w-full object-contain p-1"
          />
          <span v-else class="px-2 text-center text-sm font-bold text-gray-400">
            {{ organisationInitials }}
          </span>
        </div>
      </div>

      <div class="mt-auto space-y-2 text-sm text-gray-500">
        <div class="flex items-center gap-2">
          <svg class="h-4 w-4 flex-shrink-0 text-stats-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{{ formatDateRange(job.start_date, job.end_date) }}</span>
        </div>

        <div class="flex items-center gap-2">
          <svg class="h-4 w-4 flex-shrink-0 text-stats-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V7a2 2 0 00-2-2h-3V3H8v2H5a2 2 0 00-2 2v14h16zM9 9h6M9 13h6M9 17h6" />
          </svg>
          <span class="truncate">{{ organisationName }}</span>
        </div>

        <div v-if="job.weekly_hours" class="flex items-center gap-2">
          <svg class="h-4 w-4 flex-shrink-0 text-stats-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2M12 22a10 10 0 110-20 10 10 0 010 20z" />
          </svg>
          <span class="truncate">{{ job.weekly_hours }}</span>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isRaster } from '~/shared/utils'

type OrganisationLogo = {
  id?: string
  type?: string
}

type Organisation = {
  id?: number
  name?: string
  logo?: OrganisationLogo | string | null
}

type JobOffer = {
  role_title: string
  slug: string
  type: string
  start_date?: string | null
  end_date?: string | null
  weekly_hours?: string | null
  organisation?: Organisation | number | null
}

const props = defineProps<{
  job: JobOffer
  typeLabel: (type: string) => string
  flexibleDateLabel: string
}>()

const organisation = computed<Organisation | null>(() => {
  return typeof props.job.organisation === 'object' ? props.job.organisation : null
})

const organisationName = computed(() => organisation.value?.name || '')
const organisationLogo = computed(() => organisation.value?.logo || null)
const organisationLogoAssetId = computed(() => {
  const logo = organisationLogo.value
  return typeof logo === 'string' ? logo : logo?.id || ''
})
const organisationLogoIsRaster = computed(() => {
  const logo = organisationLogo.value
  return typeof logo === 'string' || !logo?.type ? true : isRaster(logo.type)
})
const organisationInitials = computed(() => {
  return organisationName.value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
})
const hasOrganisationIdentity = computed(() => !!organisationLogoAssetId.value || !!organisationInitials.value)

function formatDateRange(startIso?: string | null, endIso?: string | null) {
  if (!startIso) return props.flexibleDateLabel
  const start = new Date(startIso)
  const end = endIso ? new Date(endIso) : null

  if (!end || end.toDateString() === start.toDateString()) {
    return start.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}. - ${end.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })} - ${end.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`
  }

  return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })} - ${end.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`
}
</script>
