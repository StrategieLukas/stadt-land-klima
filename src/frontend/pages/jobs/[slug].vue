<template>
  <div v-if="job" class="py-8 lg:py-10">
    <article class="mx-auto w-full max-w-6xl">
      <NuxtLink
        :to="backHref"
        class="mb-6 inline-flex items-center gap-2 text-sm font-medium text-(--slk-text-muted) hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--slk-text-strong)"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        {{ backLabel }}
      </NuxtLink>

      <header class="mb-8">
        <h1
          class="max-w-4xl font-heading text-3xl leading-tight font-bold break-words text-(--slk-text-strong) sm:text-4xl lg:text-5xl"
        >
          {{ job.role_title }}
        </h1>
      </header>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <aside class="min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
          <div class="border border-(--slk-border) bg-(--slk-surface) p-6">
            <div v-if="job.organisation" class="mb-4 flex items-start gap-4">
              <OrganisationLogo :logo="job.organisation.logo" :dark-logo="job.organisation.logo_dark" :size="56" />
              <div class="min-w-0 text-base leading-snug font-semibold break-words text-(--slk-text-strong)">
                <a
                  v-if="job.organisation.link"
                  :href="job.organisation.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--slk-text-strong)"
                >
                  {{ job.organisation.name }}
                </a>
                <p v-else>{{ job.organisation.name }}</p>
              </div>
            </div>

            <p class="mb-4 text-sm text-(--slk-text-muted)">{{ typeLabel(job.type) }}</p>
            <dl class="space-y-4 border-t border-(--slk-border) pt-4 text-sm leading-relaxed break-words">
              <div>
                <dt class="mb-1 text-(--slk-text-muted)">{{ $t("jobs.period") }}</dt>
                <dd class="text-(--slk-text-strong)">{{ formatDateRange(job.start_date, job.end_date) }}</dd>
              </div>
              <div v-if="job.weekly_hours">
                <dt class="mb-1 text-(--slk-text-muted)">{{ $t("jobs.weekly_hours") }}</dt>
                <dd class="text-(--slk-text-strong)">{{ job.weekly_hours }}</dd>
              </div>
              <div v-if="compensation">
                <dt class="mb-1 text-(--slk-text-muted)">{{ compensation.label }}</dt>
                <dd class="text-(--slk-text-strong)">{{ compensation.value }}</dd>
              </div>
            </dl>
          </div>

          <CanonicalButton
            :label="$t('generic.contact')"
            :href="applicationHref"
            :icon-slug="applicationIsExternal ? 'mdi:open-in-new' : 'mdi:email-outline'"
            color="orange"
            :external="applicationIsExternal"
            class="mt-4 w-full"
          />
          <CanonicalButton
            :label="jobShareText($locale, 'jobs.share.open')"
            icon-slug="mdi:share-variant"
            variant="outline"
            color="gray"
            class="mt-3 w-full"
            @click="shareOpen = true"
          />
          <LazyJobsJobShareDialog
            v-if="shareOpen"
            :job="job"
            :site-url="config.public.siteUrl"
            @close="shareOpen = false"
          />
        </aside>

        <div
          v-if="hasContent"
          class="min-w-0 divide-y divide-(--slk-border) border border-(--slk-border) bg-(--slk-surface) p-6 sm:p-8 lg:col-start-1 lg:row-start-1"
        >
          <JobDetailSection v-if="job.tasks" :title="$t('jobs.tasks')" :html="renderMarkdown(job.tasks)" />
          <JobDetailSection
            v-if="job.qualifications"
            :title="$t('jobs.qualifications')"
            :html="renderMarkdown(job.qualifications)"
          />
          <JobDetailSection v-if="job.benefits" :title="$t('jobs.benefits')" :html="renderMarkdown(job.benefits)" />
          <JobDetailSection
            v-if="job.contact_notes"
            :title="$t('jobs.contact_notes')"
            :html="renderMarkdown(job.contact_notes)"
          />
        </div>
      </div>
    </article>
  </div>

  <div v-else class="py-8 text-(--slk-text-muted)">
    {{ $t("jobs.not_found") }}
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { computed, ref } from "vue";
import { useReferrer } from "~/composables/useReferrer";
import { routeSlug } from "~/shared/routeValues";
import { resolveJobApplicationLink } from "~/shared/jobApplicationLink";
import { canonicalUrl } from "~/shared/seo";
import { jobShareImagePath, jobShareText, resolveJobShareContent } from "~/shared/jobSharing";
const shareOpen = ref(false);
const fetchContent = useContentFetch();

const { $t, $locale } = useNuxtApp();
const route = useRoute();
const config = useRuntimeConfig();
const slug = routeSlug(route.params.slug);
if (!slug) throw createError({ statusCode: 404, statusMessage: "Job not found" });
const { backHref, backLabel } = useReferrer("/jobs", $t("jobs.back_label"));

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const markdownSanitizeOptions = {
  allowedTags: ["a", "blockquote", "br", "code", "em", "h1", "h2", "h3", "h4", "li", "ol", "p", "pre", "strong", "ul"],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank",
    }),
  },
};

const { data: jobData, error } = await useAsyncData(`job-${slug}`, () =>
  fetchContent(`/api/public/jobs/${encodeURIComponent(slug)}`),
);

if (error.value && error.value.status !== 404) throw error.value;
if (!jobData.value) {
  throw createError({ statusCode: 404, statusMessage: $t("jobs.not_found"), fatal: import.meta.client });
}

const job = computed(() => jobData.value?.job);

const shareContent = computed(() =>
  job.value ? resolveJobShareContent(job.value, $locale, config.public.siteUrl) : null,
);
usePageSeo({
  title: () => job.value?.role_title ?? $t("jobs.title"),
  description: () =>
    shareContent.value
      ? [
          shareContent.value.title,
          shareContent.value.organisation,
          shareContent.value.type,
          shareContent.value.hours,
          shareContent.value.pay,
          shareContent.value.period,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined,
  socialImagePath: () => (job.value ? jobShareImagePath(job.value.slug, $locale, "link") : undefined),
});

const applicationHref = computed(() => {
  const configuredLink = resolveJobApplicationLink(job.value?.application_url);
  if (configuredLink) return configuredLink;

  const title = job.value?.role_title ?? "";
  const content = [title, job.value?.organisation?.name, canonicalUrl(config.public.siteUrl, route.path, {})]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({ title, type: "cooperation", content: `${content}\n\n` });
  return `/contact?${params.toString()}`;
});
const applicationIsExternal = computed(() => /^https?:\/\//.test(applicationHref.value));

function typeLabel(type: import("~/shared/contracts/jobs").JobType) {
  return $t(`jobs.type.${type}`) || type || "";
}

function renderMarkdown(value: string) {
  return sanitizeHtml(md.render(value || ""), markdownSanitizeOptions);
}

function formatDateRange(startIso?: string | null, endIso?: string | null) {
  if (!startIso) return $t("jobs.date.flexible");
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

const hasContent = computed(() => {
  const currentJob = job.value;
  return !!(currentJob?.tasks || currentJob?.qualifications || currentJob?.benefits || currentJob?.contact_notes);
});

const compensation = computed(() => {
  if (job.value?.hourly_wage) return { label: $t("jobs.hourly_wage"), value: job.value.hourly_wage };
  if (job.value?.salary) return { label: $t("jobs.salary"), value: formatSalary(job.value.salary) };
  return null;
});

function formatSalary(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /€|\beur\b/i.test(trimmed) ? trimmed.replace(/\bEUR\b/gi, "€") : `${trimmed} €`;
}
</script>
