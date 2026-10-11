<template>
  <div v-if="job" class="py-8 lg:py-10">
    <article class="mx-auto w-full max-w-6xl">
      <NuxtLink :to="backHref" class="mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        {{ backLabel }}
      </NuxtLink>

      <header class="rounded-lg border border-gray-100 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
        <div class="max-w-3xl">
          <div class="mb-5 flex flex-wrap items-center gap-3">
            <span class="inline-flex rounded-full bg-rating-3-very-light px-3 py-1 text-xs font-bold uppercase tracking-wide text-olive-green ring-1 ring-solid-light-green-30">
              {{ typeLabel(job.type) }}
            </span>
          </div>
          <h1 class="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl lg:text-5xl">{{ job.role_title }}</h1>
          <div class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-gray-600">
            <span class="inline-flex items-center gap-2">
              <svg class="h-4 w-4 text-stats-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V7a2 2 0 00-2-2h-3V3H8v2H5a2 2 0 00-2 2v14h16zM9 9h6M9 13h6M9 17h6" />
              </svg>
              {{ job.organisation?.name }}
            </span>
            <span class="inline-flex items-center gap-2">
              <svg class="h-4 w-4 text-stats-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {{ formatDateRange(job.start_date, job.end_date) }}
            </span>
            <span v-if="job.weekly_hours" class="inline-flex items-center gap-2">
              <svg class="h-4 w-4 text-stats-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2M12 22a10 10 0 110-20 10 10 0 010 20z" />
              </svg>
              {{ job.weekly_hours }}
            </span>
          </div>
        </div>
      </header>

      <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div class="space-y-5">
          <JobDetailSection
            v-if="job.tasks"
            :title="$t('jobs.tasks')"
            :html="renderMarkdown(job.tasks)"
          />
          <JobDetailSection
            v-if="job.qualifications"
            :title="$t('jobs.qualifications')"
            :html="renderMarkdown(job.qualifications)"
          />
          <JobDetailSection
            v-if="job.benefits"
            :title="$t('jobs.benefits')"
            :html="renderMarkdown(job.benefits)"
          />
          <JobDetailSection
            v-if="job.contact_notes"
            :title="$t('jobs.contact_notes')"
            :html="renderMarkdown(job.contact_notes)"
          />
        </div>

        <aside class="space-y-4 lg:sticky lg:top-24">
          <div class="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <div class="mb-5 flex items-center gap-3">
              <div
                v-if="hasOrganisationIdentity"
                class="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100 bg-mild-white"
              >
                <SmartImg
                  v-if="organisationLogoAssetId"
                  :assetId="organisationLogoAssetId"
                  :isRaster="organisationLogoIsRaster"
                  :alt="job.organisation?.name || $t('jobs.organisation')"
                  :width="112"
                  :height="112"
                  fit="contain"
                  img-class="h-full w-full object-contain p-1"
                />
                <span v-else class="text-sm font-bold text-gray-400">{{ organisationInitials }}</span>
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{{ $t('jobs.organisation') }}</p>
                <a
                  v-if="job.organisation?.link"
                  :href="job.organisation.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm font-normal text-olive-green hover:underline"
                >
                  {{ job.organisation?.name }}
                </a>
                <p v-else class="text-sm font-normal text-gray-900">{{ job.organisation?.name }}</p>
              </div>
            </div>

            <dl class="space-y-4 border-t border-gray-100 pt-4 text-sm">
              <div>
                <dt class="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{{ $t('jobs.period') }}</dt>
                <dd class="text-sm font-normal text-gray-800">{{ formatDateRange(job.start_date, job.end_date) }}</dd>
              </div>
              <div v-if="compensation">
                <dt class="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{{ $t('jobs.compensation') }}</dt>
                <dd class="text-sm font-normal text-gray-800">{{ compensation }}</dd>
              </div>
              <div v-if="job.weekly_hours">
                <dt class="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{{ $t('jobs.weekly_hours') }}</dt>
                <dd class="text-sm font-normal text-gray-800">{{ job.weekly_hours }}</dd>
              </div>
              <div>
                <dt class="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{{ typeLabel(job.type) }}</dt>
                <dd class="text-sm font-normal text-gray-800">{{ isPaid(job.type) ? $t('jobs.paid') : $t('jobs.volunteer') }}</dd>
              </div>
            </dl>

            <a
              v-if="job.application_url"
              :href="job.application_url"
              target="_blank"
              rel="noopener noreferrer"
              class="btn mt-5 min-h-0 w-full rounded bg-light-green px-5 py-3 font-bold text-white hover:bg-olive-green"
            >
              {{ $t('jobs.apply') }}
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

        </aside>
      </div>
    </article>
  </div>

  <div v-else class="py-8 text-gray-500">
    {{ $t('jobs.not_found') }}
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'
import { computed } from 'vue'
import { useReferrer } from '~/composables/useReferrer'
import { isRaster } from '~/shared/utils'

const { $directus, $readItems, $t } = useNuxtApp()
const route = useRoute()
const { backHref, backLabel } = useReferrer('/jobs', $t('jobs.back_label'))

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const markdownSanitizeOptions = {
  allowedTags: [
    'a',
    'blockquote',
    'br',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'ul',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank',
    }),
  },
}

const { data: job } = await useAsyncData(`job-${route.params.slug}`, () =>
  $directus.request($readItems('job_offers' as never, {
    filter: {
      slug: { _eq: route.params.slug },
      status: { _eq: 'published' },
    },
    fields: [
      'id',
      'role_title',
      'slug',
      'type',
      'status',
      'start_date',
      'end_date',
      'weekly_hours',
      'tasks',
      'qualifications',
      'benefits',
      'salary',
      'hourly_wage',
      'application_url',
      'contact_notes',
      { organisation: ['id', 'name', 'link', { logo: ['id', 'type'] }] },
    ],
    limit: 1,
  } as never)).then((data: any) => data?.[0] ?? false)
)

if (!job.value) {
  throw createError({ statusCode: 404, statusMessage: $t('jobs.not_found'), fatal: import.meta.client })
}

useHead({ title: job.value?.role_title ?? $t('jobs.title') })

const paidTypes = new Set(['full_time', 'part_time', 'working_student', 'internship'])

function isPaid(type: string) {
  return paidTypes.has(type)
}

function typeLabel(type: string) {
  return $t(`jobs.type.${type}`) || type || ''
}

function renderMarkdown(value: string) {
  return sanitizeHtml(md.render(value || ''), markdownSanitizeOptions)
}

function formatDateRange(startIso?: string | null, endIso?: string | null) {
  if (!startIso) return $t('jobs.date.flexible')
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

const compensation = computed(() => {
  if (!job.value) return ''
  if (job.value.hourly_wage) return `${$t('jobs.hourly_wage')}: ${job.value.hourly_wage}`
  if (job.value.salary) return `${$t('jobs.salary')}: ${formatMonthlySalary(job.value.salary)}`
  return ''
})

function formatMonthlySalary(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const withEuro = /€|\beur\b/i.test(trimmed)
    ? trimmed.replace(/\bEUR\b/gi, '€')
    : `${trimmed} €`

  if (/\/\s*monat|pro\s+monat|monatlich|\bmonth\b|monthly/i.test(withEuro)) {
    return withEuro
  }

  return `${withEuro} / Monat`
}

const organisationLogo = computed(() => job.value?.organisation?.logo || null)
const organisationLogoAssetId = computed(() => {
  const logo = organisationLogo.value
  return typeof logo === 'string' ? logo : logo?.id || ''
})
const organisationLogoIsRaster = computed(() => {
  const logo = organisationLogo.value
  return typeof logo === 'string' || !logo?.type ? true : isRaster(logo.type)
})
const organisationInitials = computed(() => {
  return (job.value?.organisation?.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join('')
})
const hasOrganisationIdentity = computed(() => !!organisationLogoAssetId.value || !!organisationInitials.value)
</script>
