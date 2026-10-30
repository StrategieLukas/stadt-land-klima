<template>
  <div :id="`block-${uuid}`" class="not-prose space-y-10 sm:space-y-16">
    <section class="grid items-center gap-8 py-6 sm:py-10 lg:grid-cols-5">
      <div class="lg:col-span-3">
        <p class="mb-4 text-sm font-bold tracking-widest text-gray uppercase">{{ $t("home.eyebrow") }}</p>
        <h1
          v-blokkli-editable:title
          class="mb-5 font-heading text-4xl leading-tight font-black text-light-green sm:text-6xl"
          v-text="props.title || $t('home.title')"
        />
        <p
          v-blokkli-editable:subtitle
          class="max-w-2xl text-lg leading-relaxed text-gray"
          v-text="props.subtitle || $t('home.description')"
        />
        <div class="mt-6 flex flex-wrap gap-3">
          <CanonicalButton
            href="/municipalities"
            :label="$t('home.ranking')"
            color="bright-green"
            icon-slug="icon_location"
          />
          <CanonicalButton
            href="/mitmachen"
            :label="$t('home.participate')"
            color="bright-green"
            icon-slug="icon_team"
          />
        </div>
      </div>
      <div
        class="border-2 border-base-content bg-base-100 p-5 shadow-[6px_6px_0_var(--slk-text-strong)] sm:p-7 lg:col-span-2"
      >
        <h2 class="mb-3 font-heading text-2xl font-bold text-gray">{{ $t("home.search.title") }}</h2>
        <p class="mb-5 leading-relaxed text-gray">{{ $t("home.search.description") }}</p>
        <AdministrativeAreaSearchBar base-path="/municipalities" link-mode="slug" />
        <NuxtLink
          to="/map"
          class="mt-5 inline-block text-sm font-semibold text-stats-dark underline underline-offset-4"
          >{{ $t("home.search.map") }}</NuxtLink
        >
      </div>
    </section>

    <section aria-labelledby="home-how">
      <h2 id="home-how" class="mb-6 font-heading text-3xl font-bold text-gray">{{ $t("home.how.title") }}</h2>
      <ol class="grid gap-4 md:grid-cols-3">
        <li v-for="step in steps" :key="step.number" class="border border-base-300 bg-base-100 p-5 sm:p-6">
          <span
            class="mb-4 inline-flex size-10 items-center justify-center rounded-full bg-light-green font-heading text-xl font-bold text-black"
            >{{ step.number }}</span
          >
          <h3 class="mb-2 font-heading text-xl font-bold text-gray">{{ step.title }}</h3>
          <p class="mb-4 leading-relaxed text-gray">{{ step.description }}</p>
          <NuxtLink :to="step.href" class="font-semibold text-stats-dark underline underline-offset-4">{{
            step.link
          }}</NuxtLink>
        </li>
      </ol>
      <p v-if="data?.measureCount" class="mt-4 text-sm text-gray">
        {{ $t("home.catalog", { ":count": data.measureCount, ":catalog": data.catalog }) }}
      </p>
    </section>

    <section aria-labelledby="home-projects">
      <div class="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="home-projects" class="font-heading text-3xl font-bold text-gray">{{ $t("home.projects.title") }}</h2>
        <NuxtLink to="/projects" class="font-semibold text-stats-dark underline underline-offset-4">{{
          $t("home.projects.all")
        }}</NuxtLink>
      </div>
      <p class="mb-5 max-w-3xl leading-relaxed text-gray">{{ $t("home.projects.description") }}</p>
      <div v-if="data?.projects.length" class="grid gap-5 md:grid-cols-3">
        <NuxtLink
          v-for="project in data.projects"
          :key="project.id"
          :to="`/projects/${project.slug}`"
          class="card overflow-hidden rounded-sm border border-base-300 bg-base-100 transition-colors hover:border-light-blue"
        >
          <SmartImg
            v-if="project.image?.id"
            :asset-id="project.image.id"
            :is-raster="isRaster(project.image.type)"
            :width="480"
            :height="270"
            fit="cover"
            :alt="project.title"
            img-class="aspect-video w-full object-cover"
          />
          <div class="p-5">
            <h3 class="font-heading text-xl font-bold text-gray">{{ project.title }}</h3>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section v-if="data?.news.length" aria-labelledby="home-news">
      <div class="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="home-news" class="font-heading text-3xl font-bold text-gray">{{ $t("home.news.title") }}</h2>
        <NuxtLink to="/news" class="font-semibold text-stats-dark underline underline-offset-4">{{
          $t("home.news.all")
        }}</NuxtLink>
      </div>
      <div class="grid gap-5 md:grid-cols-3">
        <NuxtLink
          v-for="item in data.news"
          :key="item.id"
          :to="`/news/${item.slug}`"
          class="border-t-2 border-light-green py-4 font-heading text-xl font-bold text-gray hover:underline"
          >{{ item.title }}</NuxtLink
        >
      </div>
    </section>

    <section class="border-2 border-base-content bg-base-100 p-5 shadow-[6px_6px_0_var(--slk-text-strong)] sm:p-8">
      <h2 class="mb-3 font-heading text-3xl font-bold text-light-green">{{ $t("home.join.title") }}</h2>
      <p class="max-w-3xl leading-relaxed text-gray">{{ $t("home.join.description") }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <CanonicalButton href="/mitmachen" :label="$t('home.participate')" color="bright-green" icon-slug="icon_team" />
        <CanonicalButton
          href="/contact"
          :label="$t('home.join.contact')"
          color="bright-green"
          icon-slug="icon_newsletter_click"
        />
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { isRaster } from "~/shared/utils";
const { uuid } = defineBlokkli({
  bundle: "landing_page",
  propsFieldMapping: { title: { name: "title", type: "editable" }, subtitle: { name: "subtitle", type: "editable" } },
  editor: {
    editTitle: (el) => el.textContent?.trim(),
    mockProps: () => {
      return { title: "", subtitle: "" };
    },
  },
});
const props = defineProps<{ title?: string; subtitle?: string }>();
const { $t, $locale } = useNuxtApp();
const fetchContent = useContentFetch();
const { data } = await useAsyncData(`landing-page-${$locale}`, async () => {
  const [measures, feed] = await Promise.all([fetchContent("/api/public/measures"), fetchContent("/api/public/news")]);
  return {
    measureCount: measures.measures.length,
    catalog: measures.catalogVersion.name,
    projects: feed.articles.slice(0, 3),
    news: feed.news.slice(0, 3),
  };
});
const steps = computed(() => [
  {
    number: 1,
    title: $t("home.how.assess.title"),
    description: $t("home.how.assess.description"),
    href: "/measures",
    link: $t("home.how.assess.link"),
  },
  {
    number: 2,
    title: $t("home.how.compare.title"),
    description: $t("home.how.compare.description"),
    href: "/stats",
    link: $t("home.how.compare.link"),
  },
  {
    number: 3,
    title: $t("home.how.act.title"),
    description: $t("home.how.act.description"),
    href: "/projects",
    link: $t("home.projects.all"),
  },
]);
</script>
