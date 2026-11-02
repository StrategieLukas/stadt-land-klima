<template>
  <div :id="`block-${uuid}`" class="not-prose space-y-10 sm:space-y-16">
    <section class="grid items-center gap-8 py-6 sm:py-10 lg:grid-cols-2">
      <div class="min-w-0">
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
        <div class="mt-8 max-w-xl border-t border-(--slk-border) pt-6">
          <AdministrativeAreaSearchBar
            base-path="/municipalities"
            link-mode="slug"
            reasonable-munips-to-rate="include"
            compact
            :placeholder="$t('home.search.placeholder')"
          />
          <CanonicalButton
            href="/map"
            :label="$t('home.search.map')"
            icon-slug="icon_map_view"
            color="bright-green"
            class="mt-3"
          />
        </div>
      </div>
      <figure class="min-w-0">
        <img
          src="~/assets/images/home/berlin-friedensplatz.webp"
          :alt="$t('home.photo.alt')"
          width="1100"
          height="900"
          fetchpriority="high"
          class="aspect-[11/9] w-full object-cover"
        />
        <figcaption class="mt-2 text-xs leading-relaxed text-(--slk-text-muted)">
          {{ $t("home.photo.credit") }} ·
          <NuxtLink to="/projects/berliner-klimaanpassungsgesetz-2025" class="underline underline-offset-2">
            {{ $t("home.photo.link") }}
          </NuxtLink>
        </figcaption>
      </figure>
    </section>

    <section aria-labelledby="home-how">
      <h2 id="home-how" class="mb-6 font-heading text-3xl font-bold text-gray">{{ $t("home.how.title") }}</h2>
      <div class="grid gap-6 md:grid-cols-3">
        <div
          v-for="step in steps"
          :key="step.href"
          class="flex flex-col items-start border-t border-(--slk-border) py-5 sm:pr-6"
        >
          <img :src="step.icon" alt="" class="slk-home-step-icon mb-4 size-12" />
          <h3 class="mb-2 font-heading text-xl font-bold text-gray">{{ step.title }}</h3>
          <p class="mb-4 leading-relaxed text-gray">{{ step.description }}</p>
          <CanonicalButton
            :href="step.href"
            :label="step.link"
            :icon-slug="step.iconSlug"
            color="bright-green"
            class="mt-auto"
          />
        </div>
      </div>
      <p v-if="data?.measureCount" class="mt-4 text-sm text-gray">
        {{ $t("home.catalog", { ":count": data.measureCount, ":catalog": data.catalog }) }}
      </p>
    </section>

    <section aria-labelledby="home-start" class="border-y border-(--slk-border) py-8 sm:py-10">
      <h2 id="home-start" class="mb-3 font-heading text-3xl font-bold text-gray">{{ $t("home.start.title") }}</h2>
      <p class="mb-7 max-w-3xl leading-relaxed text-gray">{{ $t("home.start.description") }}</p>
      <div class="grid gap-8 md:grid-cols-3">
        <div v-for="item in gettingStarted" :key="item.href" class="flex flex-col items-start">
          <h3 class="mb-2 font-heading text-xl font-bold text-gray">{{ item.title }}</h3>
          <p class="mb-5 flex-1 leading-relaxed text-gray">{{ item.description }}</p>
          <CanonicalButton
            :href="item.href"
            :label="item.label"
            :icon-slug="item.icon"
            color="bright-green"
            :external="item.external"
          />
        </div>
      </div>
    </section>

    <section aria-labelledby="home-projects">
      <div class="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="home-projects" class="font-heading text-3xl font-bold text-gray">{{ $t("home.projects.title") }}</h2>
        <CanonicalButton
          href="/projects"
          :label="$t('home.projects.all')"
          color="bright-green"
          icon-slug="icon_approved"
        />
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
        <CanonicalButton
          href="/news"
          :label="$t('home.news.all')"
          color="bright-green"
          icon-slug="icon_newsletter_click"
        />
      </div>
      <div class="grid gap-5 md:grid-cols-3">
        <NuxtLink
          v-for="item in data.news"
          :key="item.id"
          :to="`/news/${item.slug}`"
          class="group overflow-hidden rounded-sm border border-base-300 bg-base-100 transition-colors hover:border-light-blue"
        >
          <SmartImg
            v-if="item.image?.id"
            :asset-id="item.image.id"
            :is-raster="isRaster(item.image.type)"
            :alt="item.title"
            :width="480"
            :height="270"
            fit="cover"
            img-class="aspect-video w-full object-cover"
          />
          <h3 class="p-5 font-heading text-xl font-bold text-gray group-hover:underline">{{ item.title }}</h3>
        </NuxtLink>
      </div>
    </section>

    <section aria-labelledby="home-about" class="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 id="home-about" class="mb-3 font-heading text-3xl font-bold text-gray">{{ $t("home.about.title") }}</h2>
        <p class="mb-5 leading-relaxed text-gray">{{ $t("home.about.description") }}</p>
        <div class="flex flex-wrap gap-x-6 gap-y-3">
          <CanonicalButton
            href="/ueber-uns"
            :label="$t('home.about.more')"
            icon-slug="icon_info"
            color="bright-green"
          />
          <CanonicalButton
            href="/kooperationen-oder-partner-oder-netzwerk"
            :label="$t('home.about.network')"
            icon-slug="icon_team"
            color="bright-green"
          />
        </div>
      </div>
      <div class="border-l-4 border-light-green pl-6">
        <h3 class="mb-3 font-heading text-2xl font-bold text-gray">{{ $t("home.support.title") }}</h3>
        <p class="mb-5 leading-relaxed text-gray">{{ $t("home.support.description") }}</p>
        <CanonicalButton
          href="/spenden"
          :label="$t('home.support.link')"
          color="bright-green"
          icon-slug="icon_hand_holding_heart"
        />
      </div>
    </section>

    <section class="border-t border-(--slk-border) py-8">
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
import assessmentIcon from "~/assets/icons/icon_evaluation_criteria.svg?url&no-inline";
import comparisonIcon from "~/assets/icons/icon_impact.svg?url&no-inline";
import actionIcon from "~/assets/icons/icon_team.svg?url&no-inline";
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
const gettingStarted = computed(() => [
  {
    title: $t("home.workshop.title"),
    description: $t("home.workshop.description"),
    label: $t("home.workshop.link"),
    href: "/klimawerkstatt",
    icon: "icon_team",
    external: false,
  },
  {
    title: $t("home.assess.title"),
    description: $t("home.assess.description"),
    label: $t("home.assess.link"),
    href: "/register_localteam",
    icon: "icon_evaluation_criteria",
    external: false,
  },
  {
    title: $t("home.onboarding.title"),
    description: $t("home.onboarding.description"),
    label: $t("home.onboarding.link"),
    href: "https://cal.stadt-land-klima.de/otto/onboarding",
    icon: "icon_newsletter_click",
    external: true,
  },
]);
const steps = computed(() => [
  {
    icon: assessmentIcon,
    iconSlug: "icon_evaluation_criteria",
    title: $t("home.how.assess.title"),
    description: $t("home.how.assess.description"),
    href: "/measures",
    link: $t("home.how.assess.link"),
  },
  {
    icon: comparisonIcon,
    iconSlug: "icon_impact",
    title: $t("home.how.compare.title"),
    description: $t("home.how.compare.description"),
    href: "/stats",
    link: $t("home.how.compare.link"),
  },
  {
    icon: actionIcon,
    iconSlug: "icon_team",
    title: $t("home.how.act.title"),
    description: $t("home.how.act.description"),
    href: "/projects",
    link: $t("home.projects.all"),
  },
]);
</script>
