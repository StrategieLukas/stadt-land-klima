<template>
  <main v-if="series" class="series-page" :class="series.format === 'tour' ? 'series-page--tour' : ''">
    <header class="series-hero">
      <div class="series-hero__copy">
        <span class="series-kicker">{{ series.format === 'tour' ? $t('tour.on_tour') : $t('tour.event_series') }}</span>
        <h1>{{ series.title }}</h1>
        <p v-if="series.introduction" class="series-intro">{{ series.introduction }}</p>
        <p v-else-if="series.format === 'tour'" class="series-intro">{{ $t('tour.follow_journey') }}</p>
        <CanonicalButton v-if="stops.length" href="#route" :label="$t('tour.discover')" color="dark" />
      </div>
      <div class="series-hero__art">
        <SmartImg
          v-if="series.cover_image"
          :asset-id="relationId(series.cover_image)"
          :is-raster="isRaster(series.cover_image?.type || 'image/jpeg')"
          :alt="series.title"
          :width="1100"
          img-class="h-full w-full object-cover"
        />
        <div v-else-if="series.format === 'tour'" class="series-hero__route" aria-hidden="true">
          <TourPin class="series-hero__giant-pin" />
          <span v-for="(stop, index) in stops.slice(0, 4)" :key="stop.id" class="series-hero__route-label" :style="{ '--pin-color': pinColor(index) }">
            <TourPin /> {{ stop.location || stop.title }}
          </span>
        </div>
        <div v-else class="series-hero__route" aria-hidden="true"><span v-for="number in 5" :key="number">{{ String(number).padStart(2, '0') }}</span></div>
        <p v-if="series.cover_image_credits" class="series-hero__credit">{{ series.cover_image_credits }}</p>
      </div>
    </header>

    <div v-if="stops.length" class="series-facts" :aria-label="$t('tour.itinerary')">
      <div><strong>{{ stops.length }}</strong><span>{{ $t('tour.stops') }}</span></div>
      <div><strong>{{ stateCount }}</strong><span>{{ $t('tour.states') }}</span></div>
      <div><strong>{{ dayCount }}</strong><span>{{ $t('tour.days') }}</span></div>
    </div>

    <section v-if="!stops.length" class="series-empty">{{ $t('tour.no_stops') }}</section>

    <template v-else-if="series.format === 'tour'">
      <section id="route" class="series-route-heading">
        <span class="series-kicker">{{ $t('tour.itinerary') }}</span>
        <h2>{{ $t('tour.route') }}</h2>
        <p>{{ formatBerlinDate(stops[0].start_date, $locale) }} – {{ formatBerlinDate(stops[stops.length - 1].end_date || stops[stops.length - 1].start_date, $locale) }}</p>
        <ol class="series-itinerary">
          <li v-for="(stop, index) in stops" :key="stop.id">
            <a :href="`#stop-${stop.slug}`" :style="{ '--pin-color': pinColor(index) }" :class="{ 'is-next': index === nextStopIndex }">
              <span class="series-itinerary__marker"><TourPin /></span>
              <span class="series-itinerary__entry"><small>{{ formatShortDate(stop.start_date) }}</small><strong>{{ stop.location || stop.title }}</strong></span>
              <span v-if="index === nextStopIndex" class="series-itinerary__next">{{ $t('tour.next_stop') }} <span aria-hidden="true">→</span></span>
            </a>
          </li>
        </ol>
      </section>

      <div class="tour-body">
        <aside class="tour-map-column" :style="{ '--tour-header': `${headerHeight + 8}px` }">
          <div class="tour-map-card">
            <div class="tour-map-card__top">
              <span>{{ $t('tour.route') }}</span>
              <button type="button" class="tour-map-toggle" @click="mapOpen = !mapOpen">
                {{ mapOpen ? $t('tour.collapse_map') : $t('tour.expand_map') }}
              </button>
            </div>
            <p class="tour-map-note">{{ $t('tour.approximate_map') }}</p>
            <div v-show="mapOpen" class="tour-map-frame">
              <ClientOnly>
                <TourMap :stops="stops" :active-index="activeStop" @select="goToStop" />
                <template #fallback><p class="tour-map-fallback">{{ $t('tour.map_unavailable') }}</p></template>
              </ClientOnly>
            </div>
            <nav class="tour-stop-strip" :aria-label="$t('tour.stops_plural')">
              <a
                v-for="(stop, index) in stops"
                :key="stop.id"
                :href="`#stop-${stop.slug}`"
                :class="{ 'is-active': activeStop === index }"
                :aria-current="activeStop === index ? 'location' : undefined"
                @click.prevent="goToStop(index)"
              >
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="tour-stop-strip__place">{{ stop.location || stop.title }}</span>
              </a>
            </nav>
          </div>
        </aside>

        <div class="tour-chapters">
          <article
            v-for="(stop, index) in stops"
            :id="`stop-${stop.slug}`"
            :key="stop.id"
            class="tour-chapter"
            :class="{ 'tour-chapter--reported': reportFor(stop.id) }"
            :data-stop-index="index"
          >
            <div class="tour-chapter__number" :style="{ '--pin-color': pinColor(index) }" aria-hidden="true"><TourPin /><span>{{ String(index + 1).padStart(2, '0') }}</span></div>
            <div class="tour-chapter__body">
              <p class="tour-chapter__eyebrow">
                {{ $t('tour.stop') }} {{ index + 1 }}
                <span aria-hidden="true">·</span>
                {{ formatBerlinDate(stop.start_date, $locale) }}
                <span v-if="stop.state" aria-hidden="true">·</span>
                {{ stop.state }}
              </p>
              <div class="tour-chapter__title" :style="{ '--pin-color': pinColor(index) }">
                <TourPin class="tour-chapter__watermark" />
                <h3>{{ stop.location || stop.title }}</h3>
                <span class="tour-chapter__date-pill"><b>{{ index + 1 }}</b> {{ formatShortDate(stop.start_date) }}</span>
              </div>
              <p v-if="stop.location" class="tour-chapter__event-title">{{ stop.title }}</p>
              <p v-if="stop.event_category === 'internal'" class="tour-chapter__attendance">{{ $t('tour.internal_visit') }}</p>
              <p v-else-if="stop.event_category === 'own_public'" class="tour-chapter__attendance">{{ $t('tour.public_event') }}</p>

              <template v-if="reportFor(stop.id)">
                <p v-if="reportFor(stop.id).teaser" class="tour-chapter__excerpt">{{ reportFor(stop.id).teaser }}</p>
                <div v-if="reportPhotos(stop.id).length" class="tour-photos" :class="{ 'tour-photos--pair': reportPhotos(stop.id).length > 1 }">
                  <figure v-for="(photo, photoIndex) in reportPhotos(stop.id)" :key="photo.id" :class="`tour-photo--${photoIndex % 3}`">
                    <SmartImg
                      :asset-id="relationId(photo.file)"
                      :is-raster="isRaster(photo.file?.type || 'image/jpeg')"
                      :alt="photo.alt"
                      :width="900"
                      img-class="block h-auto w-full"
                    />
                    <figcaption>
                      <span v-if="photo.caption">{{ photo.caption }}</span>
                      <small>{{ photo.credit }}</small>
                    </figcaption>
                  </figure>
                </div>
                <CanonicalButton :href="`/news/${reportFor(stop.id).slug}`" :label="$t('tour.read_report')" color="dark" />
              </template>
              <p v-else class="tour-chapter__status">
                {{ visitHasEnded(stop.start_date, stop.end_date, now) ? $t('tour.report_pending') : $t('tour.upcoming') }}
              </p>

              <div class="tour-chapter__links">
                <NuxtLink :to="`/events/${stop.slug}`">{{ $t('tour.event_details') }} <span aria-hidden="true">↗</span></NuxtLink>
                <a v-if="stop.registration_url && stop.event_category !== 'internal'" :href="stop.registration_url" target="_blank" rel="noopener noreferrer">
                  {{ $t('events.register') }} <span aria-hidden="true">↗</span>
                </a>
                <NuxtLink v-for="project in projectsFor(stop.id)" :key="project.id" :to="`/projects/${project.slug}`">
                  {{ project.title }} <span v-if="project.profile_stage === 'preview'" class="tour-preview-label">{{ $t('tour.preview') }}</span>
                </NuxtLink>
              </div>
              <nav class="tour-chapter__paging" :aria-label="$t('tour.stops_plural')">
                <a v-if="index > 0" :href="`#stop-${stops[index - 1].slug}`">← {{ $t('tour.previous') }}</a>
                <a v-if="index < stops.length - 1" :href="`#stop-${stops[index + 1].slug}`">{{ $t('tour.next') }} →</a>
              </nav>
            </div>
          </article>
        </div>
      </div>

      <footer class="series-outro">
        <div class="series-brand">
          <div v-if="series.brand_logo" class="series-brand__logo">
            <SmartImg :asset-id="relationId(series.brand_logo)" :is-raster="isRaster(series.brand_logo?.type || 'image/png')" :alt="series.title" :width="420" img-class="block h-auto max-w-full object-contain" />
          </div>
          <div v-else class="series-brand__fallback"><span>{{ series.title }}</span><TourPin /><strong>Stadt.Land.Klima!</strong></div>
        </div>
        <p v-if="series.closing_reflection" class="series-outro__reflection">{{ series.closing_reflection }}</p>
        <div v-if="allProjects.length || publishedReports.length" class="series-outro__references">
          <div v-if="allProjects.length">
            <h2>{{ $t('tour.all_projects') }}</h2>
            <NuxtLink v-for="project in allProjects" :key="project.id" :to="`/projects/${project.slug}`">{{ project.title }} →</NuxtLink>
          </div>
          <div v-if="publishedReports.length">
            <h2>{{ $t('tour.all_reports') }}</h2>
            <NuxtLink v-for="report in publishedReports" :key="report.id" :to="`/news/${report.slug}`">{{ report.title }} →</NuxtLink>
          </div>
        </div>
        <div class="series-outro__links">
          <CanonicalButton href="/projects" :label="$t('tour.all_projects')" color="dark" />
          <CanonicalButton href="/news" :label="$t('tour.all_reports')" color="green" />
        </div>
      </footer>
    </template>

    <section v-else id="route" class="standard-series container mx-auto px-4 py-10">
      <h2>{{ $t('tour.itinerary') }}</h2>
      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <EventCard v-for="stop in stops" :key="stop.id" :event="stop" />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { formatBerlinDate } from "~/shared/eventDateTime";
import { berlinDayNumber, pinColor, relationId, visitHasEnded } from "~/shared/tour";
import type { TourPoint } from "~/shared/tour";
import { isRaster } from "~/shared/utils";
import { useHeaderHeight } from "~/composables/useHeaderHeight";

type Photo = { id: number; file: { id: string; type?: string } | string; sort?: number | null; alt: string; caption?: string | null; credit: string };
type Report = { id: string; slug: string; title: string; teaser?: string | null; report_event: string | { id: string }; journey_photos?: Photo[] };
type Project = { id: number; slug: string; title: string; profile_stage?: string };
type Stop = { id: string; slug: string; title: string; start_date: string; end_date?: string | null; location?: string | null; state?: string | null; series_order?: number | null; geolocation?: TourPoint | null; image?: { id: string; type?: string } | null; event_type?: string | null; event_category?: string | null; registration_url?: string | null };
type Series = { id: string; slug: string; title: string; introduction?: string | null; closing_reflection?: string | null; cover_image?: { id: string; type?: string } | null; brand_logo?: { id: string; type?: string } | null; cover_image_credits?: string | null; format: "tour" | "standard" };

const { $directus, $readItems, $t, $locale } = useNuxtApp();
const route = useRoute();
const headerHeight = useHeaderHeight();
const slug = String(route.params.slug);

const { data: seriesRows } = await useAsyncData(`event-series-${slug}`, () => $directus.request($readItems("event_series", {
  filter: { slug: { _eq: slug }, status: { _eq: "published" } },
  fields: ["id", "slug", "title", "introduction", "closing_reflection", "format", "cover_image_credits", { cover_image: ["id", "type"] }, { brand_logo: ["id", "type"] }],
  limit: 1,
})));
const series = computed<Series | null>(() => (seriesRows.value?.[0] as Series) ?? null);
if (!series.value) throw createError({ statusCode: 404, statusMessage: $t("page_not_found"), fatal: true });

const { data: stopRows } = await useAsyncData(`event-series-stops-${series.value.id}`, () => $directus.request($readItems("events", {
  filter: { series: { _eq: series.value?.id }, status: { _eq: "published" } },
  fields: ["id", "slug", "title", "start_date", "end_date", "location", "state", "series_order", "geolocation", "event_type", "event_category", "registration_url", { image: ["id", "type"] }],
  limit: -1,
})));
const stops = computed<Stop[]>(() => [...((stopRows.value ?? []) as Stop[])].sort((a, b) =>
  (a.series_order ?? Number.MAX_SAFE_INTEGER) - (b.series_order ?? Number.MAX_SAFE_INTEGER)
  || new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  || a.slug.localeCompare(b.slug)
));
const eventIds = stops.value.map((stop) => stop.id);

const [{ data: projectLinks }, { data: reportRows }] = await Promise.all([
  useAsyncData(`event-series-projects-${series.value.id}`, () => eventIds.length ? $directus.request($readItems("events_articles", {
    filter: { events_id: { _in: eventIds } },
    fields: ["events_id", { articles_id: ["id", "slug", "title", "profile_stage"] }],
    limit: -1,
  })) : Promise.resolve([])),
  useAsyncData(`event-series-reports-${series.value.id}`, () => eventIds.length ? $directus.request($readItems("news_items", {
    filter: { report_event: { _in: eventIds }, status: { _eq: "published" } },
    fields: ["id", "slug", "title", "teaser", "report_event", { journey_photos: ["id", "sort", "alt", "caption", "credit", { file: ["id", "type"] }] }],
    limit: -1,
  })) : Promise.resolve([])),
]);

const projectsByEvent = computed(() => {
  const result = new Map<string, Project[]>();
  for (const link of (projectLinks.value ?? []) as { events_id: string; articles_id: Project | null }[]) {
    const id = relationId(link.events_id);
    if (!id || !link.articles_id) continue;
    const projects = result.get(id) ?? [];
    if (!projects.some((project) => project.id === link.articles_id?.id)) {
      result.set(id, [...projects, link.articles_id]);
    }
  }
  return result;
});
const reportsByEvent = computed(() => new Map(((reportRows.value ?? []) as Report[]).map((report) => [relationId(report.report_event), report])));
const allProjects = computed(() => [...new Map([...projectsByEvent.value.values()].flat().map((project) => [project.id, project])).values()]);
const publishedReports = computed(() => (reportRows.value ?? []) as Report[]);
const reportFor = (eventId: string): Report | undefined => reportsByEvent.value.get(eventId);
const projectsFor = (eventId: string): Project[] => projectsByEvent.value.get(eventId) ?? [];
const reportPhotos = (eventId: string): Photo[] => [...(reportFor(eventId)?.journey_photos ?? [])]
  .filter((photo) => relationId(photo.file))
  .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));

const stateCount = computed(() => new Set(stops.value.map((stop) => stop.state).filter(Boolean)).size);
const dayCount = computed(() => {
  if (!stops.value.length) return 0;
  const first = Math.min(...stops.value.map((stop) => berlinDayNumber(stop.start_date) ?? Infinity));
  const last = Math.max(...stops.value.map((stop) => berlinDayNumber(stop.end_date || stop.start_date) ?? -Infinity));
  return Number.isFinite(first) && Number.isFinite(last) ? last - first + 1 : 0;
});

const formatShortDate = (value: string) => new Intl.DateTimeFormat($locale, { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(value));

const nowIso = useState(`tour-now-${slug}`, () => new Date().toISOString());
const now = computed(() => new Date(nowIso.value));
const nextStopIndex = computed(() => stops.value.findIndex((stop) => !visitHasEnded(stop.start_date, stop.end_date, now.value)));
const activeStop = ref(-1);
const mapOpen = ref(true);
let observer: IntersectionObserver | null = null;
let nowTimer: ReturnType<typeof setInterval> | null = null;

function goToStop(index: number) {
  const stop = stops.value[index];
  if (!stop) return;
  activeStop.value = index;
  const hash = `#stop-${stop.slug}`;
  history.replaceState(null, "", hash);
  document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}

onMounted(() => {
  nowIso.value = new Date().toISOString();
  nowTimer = setInterval(() => { nowIso.value = new Date().toISOString(); }, 60_000);
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting);
    if (!visible.length) return;
    visible.sort((a, b) => Math.abs(a.boundingClientRect.top - window.innerHeight * 0.35) - Math.abs(b.boundingClientRect.top - window.innerHeight * 0.35));
    activeStop.value = Number((visible[0].target as HTMLElement).dataset.stopIndex);
  }, { rootMargin: "-22% 0px -50% 0px", threshold: 0 });
  document.querySelectorAll(".tour-chapter").forEach((chapter) => observer?.observe(chapter));
});
onUnmounted(() => {
  observer?.disconnect();
  if (nowTimer) clearInterval(nowTimer);
});

useHead({ title: series.value.title });
</script>

<style scoped>
.series-page { min-height: 100vh; color: #24343d; background: #fffdf7; }
.series-hero { display: grid; min-height: 32rem; grid-template-columns: 1fr 46%; overflow: hidden; background: #f2f8fa; }
.series-hero__copy { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: clamp(2rem, 6vw, 6rem); }
.series-kicker { color: #3f8342; font: 700 .8rem Inter, sans-serif; letter-spacing: .17em; text-transform: uppercase; }
.series-hero h1 { max-width: 12ch; margin: .75rem 0 1.25rem; color: #006e94; font: 800 clamp(3rem, 6vw, 6.5rem)/.94 RobotoCondensed, sans-serif; }
.series-intro { max-width: 37rem; margin-bottom: 2rem; white-space: pre-line; font-size: clamp(1rem, 1.4vw, 1.2rem); line-height: 1.7; }
.series-hero__art { position: relative; min-height: 22rem; background: linear-gradient(145deg, #006e94, #3f8342); }
.series-hero__route { position: absolute; inset: 8%; display: flex; align-items: center; justify-content: space-around; border: 2px dashed #ffffffa8; border-radius: 50%; transform: rotate(-18deg); color: white; font: 700 1.2rem RobotoCondensed, sans-serif; }
.series-hero__route span { transform: rotate(18deg); border-radius: 50%; background: #f27c00; padding: .45rem; }
.series-hero__credit { position: absolute; right: 1rem; bottom: .5rem; color: white; font-size: .7rem; text-shadow: 0 1px 3px #000; }
.series-facts { display: flex; justify-content: center; gap: clamp(2rem, 8vw, 8rem); padding: 1.4rem 1rem; border-bottom: 1px solid #d8e4e7; background: white; }
.series-facts div { display: flex; align-items: baseline; gap: .5rem; }
.series-facts strong { color: #006e94; font: 800 2.4rem RobotoCondensed, sans-serif; }
.series-facts span { color: #505050; font-size: .9rem; }
.series-route-heading { max-width: 80rem; margin: 0 auto; padding: 5rem 1.5rem 2rem; scroll-margin-top: 9rem; }
.series-route-heading h2, .standard-series h2 { color: #006e94; font: 800 clamp(2.6rem, 5vw, 5rem)/1 RobotoCondensed, sans-serif; }
.series-route-heading p { color: #707070; }
.series-itinerary { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: .5rem; margin-top: 2rem; }
.series-itinerary a { display: flex; align-items: baseline; gap: .5rem; min-height: 3rem; padding: .6rem .75rem; border-bottom: 1px solid #cce2ea; color: #006e94; }
.series-itinerary a:hover, .series-itinerary a:focus-visible { background: #e6f1f4; }
.series-itinerary strong { color: #f27c00; }
.series-itinerary span { flex: 1; font-weight: 700; }
.series-itinerary small { color: #707070; font-size: .65rem; }
.tour-body { display: grid; grid-template-columns: minmax(0, 42%) minmax(0, 58%); max-width: 100rem; margin: 0 auto; padding: 0 1.5rem; }
.tour-map-column { align-self: start; position: sticky; top: var(--tour-header); height: calc(100vh - var(--tour-header) - 1rem); min-height: 28rem; padding: 0 2rem 2rem 0; }
.tour-map-card { display: flex; flex-direction: column; height: 100%; overflow: hidden; border: 1px solid #cce2ea; border-radius: 1.25rem; background: white; box-shadow: 0 20px 45px #006e9419; }
.tour-map-card__top { display: flex; justify-content: space-between; padding: .8rem 1rem; color: #006e94; font-weight: 700; }
.tour-map-toggle { display: none; color: #006e94; text-decoration: underline; }
.tour-map-frame { flex: 1; min-height: 0; }
.tour-map-fallback { padding: 2rem; }
.tour-stop-strip { display: flex; gap: .5rem; overflow-x: auto; padding: .8rem; border-top: 1px solid #d6e8ee; scrollbar-width: thin; }
.tour-stop-strip a { display: flex; flex: none; align-items: center; gap: .3rem; padding: .45rem .65rem; border-radius: 999px; background: #e6f1f4; color: #006e94; font-size: .75rem; }
.tour-stop-strip a.is-active { background: #006e94; color: white; }
.tour-stop-strip__place { max-width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tour-chapters { min-width: 0; border-left: 2px dashed #b3d4df; }
.tour-chapter { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr); min-height: 26rem; padding: 0 0 5rem; scroll-margin-top: 11rem; }
.tour-chapter--reported { min-height: 38rem; }
.tour-chapter__number { width: 3.2rem; height: 3.2rem; margin-left: -1.7rem; border: 3px solid #fffdf7; border-radius: 50%; background: #f27c00; box-shadow: 0 0 0 2px #f27c00; color: white; text-align: center; font: 800 1.35rem/2.9rem RobotoCondensed, sans-serif; }
.tour-chapter__body { min-width: 0; padding: 1rem 1rem 2rem 0; }
.tour-chapter__eyebrow { color: #3f8342; font-size: .78rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.tour-chapter h3 { margin: .65rem 0; color: #006e94; font: 800 clamp(2.7rem, 5vw, 5rem)/.97 RobotoCondensed, sans-serif; }
.tour-chapter__event-title { color: #505050; font-size: 1.15rem; font-weight: 600; }
.tour-chapter__attendance { display: inline-block; margin-top: .6rem; padding: .3rem .65rem; border-radius: 999px; background: #e6f1f4; color: #006e94; font-size: .75rem; font-weight: 700; }
.tour-chapter__excerpt { max-width: 38rem; margin: 2rem 0; font-size: clamp(1.1rem, 1.7vw, 1.4rem); line-height: 1.65; }
.tour-chapter__status { margin: 2rem 0; padding: 1rem 1.25rem; border-left: 4px solid #afca0b; background: #f7fae7; color: #505050; }
.tour-photos { display: grid; gap: 1rem; max-width: 42rem; margin: 2rem 0 3rem; }
.tour-photos--pair { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
.tour-photos figure { min-width: 0; padding: .65rem .65rem 1rem; border: 1px solid #ece7dc; background: white; box-shadow: 0 12px 25px #263f4929; }
.tour-photo--0 { transform: rotate(-2deg); }
.tour-photo--1 { transform: translateY(1.5rem) rotate(2deg); }
.tour-photo--2 { transform: rotate(1deg); }
.tour-photos figcaption { display: flex; flex-direction: column; gap: .2rem; padding: .65rem .25rem 0; color: #505050; font-size: .8rem; }
.tour-photos small { color: #707070; }
.tour-chapter__links { display: flex; flex-wrap: wrap; gap: .6rem; margin: 2rem 0; }
.tour-chapter__links a { padding: .6rem .85rem; border: 1px solid #b3d4df; border-radius: .5rem; background: white; color: #006e94; font-weight: 700; }
.tour-preview-label { margin-left: .4rem; color: #707070; font-size: .7rem; text-transform: uppercase; }
.tour-chapter__paging { display: flex; justify-content: space-between; gap: 1rem; margin-top: 3rem; color: #006e94; font-size: .85rem; }
.series-outro { margin-top: 4rem; padding: clamp(3rem, 6vw, 6rem) 1.5rem; background: #e6f1f4; text-align: center; }
.series-outro__reflection { max-width: 45rem; margin: 0 auto 2rem; white-space: pre-line; font: 600 clamp(1.3rem, 2.5vw, 2rem)/1.5 RobotoCondensed, sans-serif; }
.series-outro__references { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 2rem; max-width: 70rem; margin: 0 auto 2rem; text-align: left; }
.series-outro__references div { display: flex; flex-direction: column; gap: .5rem; }
.series-outro__references h2 { color: #006e94; font: 800 1.5rem RobotoCondensed, sans-serif; }
.series-outro__references a { color: #006e94; text-decoration: underline; }
.series-outro__links { display: flex; flex-wrap: wrap; justify-content: center; gap: .8rem; }
.standard-series h2 { margin-bottom: 2rem; }
.series-empty { padding: 4rem 1.5rem; text-align: center; }
@media (max-width: 900px) {
  .series-hero { grid-template-columns: 1fr; }
  .series-hero__art { order: -1; min-height: 15rem; max-height: 25rem; }
  .series-hero__copy { padding: 2.5rem 1.5rem; }
  .series-hero h1 { max-width: none; }
  .series-facts { gap: 1rem; justify-content: space-around; }
  .series-facts div { flex-direction: column; align-items: center; gap: 0; text-align: center; }
  .series-facts strong { font-size: 2rem; }
  .series-facts span { font-size: .72rem; }
  .series-route-heading { padding-top: 3rem; }
  .tour-body { display: block; padding: 0 1rem; }
  .tour-map-column { z-index: 20; top: var(--tour-header); height: auto; min-height: 0; padding: 0 0 1rem; }
  .tour-map-card { max-height: 38vh; border-radius: .8rem; }
  .tour-map-card__top { padding: .35rem .7rem; font-size: .8rem; }
  .tour-map-toggle { display: inline; }
  .tour-map-frame { height: 22vh; min-height: 8rem; flex: none; }
  .tour-stop-strip { padding: .35rem; }
  .tour-stop-strip__place { display: none; }
  .tour-chapters { margin-left: 1.2rem; }
  .tour-chapter { grid-template-columns: 2.5rem minmax(0, 1fr); min-height: 17rem; padding-bottom: 2rem; scroll-margin-top: calc(var(--tour-header) + 17rem); }
  .tour-chapter__number { width: 2.5rem; height: 2.5rem; margin-left: -1.35rem; font-size: 1rem; line-height: 2.15rem; }
  .tour-chapter__body { padding-right: 0; }
}
@media (max-width: 480px) {
  .tour-photos--pair { grid-template-columns: 1fr; }
  .tour-photos figure { max-width: 95%; }
  .tour-photo--1 { justify-self: end; transform: rotate(1deg); }
}
@media (prefers-reduced-motion: reduce) {
  .tour-photos figure { transform: none; }
}

/* The tour is a campaign journal; standard series keep the neutral event layout. */
.series-page--tour { --tour-ink: #182127; --tour-blue: #b9efff; color: var(--tour-ink); background: var(--tour-blue); overflow: clip; }
.series-page--tour .series-hero { min-height: min(78vh, 48rem); grid-template-columns: minmax(0, 52%) minmax(0, 48%); background: #b9efff; }
.series-page--tour .series-hero__copy { z-index: 1; padding: clamp(2rem, 5vw, 5rem); }
.series-page--tour .series-kicker { color: #075b79; }
.series-page--tour .series-hero h1 { max-width: 11ch; color: var(--tour-ink); font-size: clamp(3.6rem, 8vw, 9rem); line-height: .85; text-wrap: balance; }
.series-page--tour .series-intro { max-width: 28rem; color: #253941; font-size: clamp(1.1rem, 1.65vw, 1.45rem); line-height: 1.45; }
.series-page--tour .series-hero__art { min-height: 34rem; background: #85dcfa; }
.series-page--tour .series-hero__art:has(img) { background: #b9efff; }
.series-page--tour .series-hero__route { inset: 0; display: block; border: 0; border-radius: 0; transform: none; color: #16bae7; overflow: hidden; }
.series-page--tour .series-hero__route span { background: #fffefa; border-radius: 0; padding: .45rem .8rem; }
.series-hero__giant-pin { position: absolute; top: -9%; left: 13%; width: min(78%, 32rem); height: 125%; filter: drop-shadow(0 22px 0 #087ea414); transform: rotate(9deg); }
.series-hero__route-label { position: absolute; right: 4%; display: flex; align-items: center; gap: .4rem; padding: .45rem .8rem; background: #fffefa; box-shadow: 5px 6px 0 #182127; color: #182127; font: 800 clamp(1rem, 2vw, 1.65rem)/1 RobotoCondensed, sans-serif; transform: rotate(-3deg); }
.series-hero__route-label:nth-of-type(1) { top: 16%; }
.series-hero__route-label:nth-of-type(2) { top: 34%; right: 11%; transform: rotate(3deg); }
.series-hero__route-label:nth-of-type(3) { top: 54%; }
.series-hero__route-label:nth-of-type(4) { top: 73%; right: 8%; transform: rotate(2deg); }
.series-hero__route-label svg { width: 1.5rem; height: 2rem; color: var(--pin-color); }
.series-page--tour .series-hero__credit { padding: .3rem .5rem; background: #182127d9; }
.series-page--tour .series-facts { gap: clamp(2rem, 7vw, 8rem); border-top: 4px solid #182127; border-bottom: 4px solid #182127; background: #fffefa; }
.series-page--tour .series-facts strong { color: #182127; font-size: clamp(2.5rem, 4vw, 4.5rem); line-height: 1; }
.series-page--tour .series-facts span { color: #182127; font-weight: 700; }
.series-page--tour .series-route-heading { max-width: 76rem; padding: clamp(3rem, 6vw, 6rem) 1.5rem; }
.series-page--tour .series-route-heading h2 { margin: .35rem 0; color: #182127; font-size: clamp(3.5rem, 7vw, 7rem); }
.series-page--tour .series-route-heading > p { color: #253941; font-size: 1.1rem; }
.series-page--tour .series-itinerary { position: relative; display: block; max-width: 57rem; margin: 3rem auto 0; }
.series-page--tour .series-itinerary::before { content: ""; position: absolute; top: 1rem; bottom: 1rem; left: clamp(3.1rem, 12vw, 10.5rem); width: 4px; background: repeating-linear-gradient(to bottom, #087ea4 0 12px, transparent 12px 21px); }
.series-page--tour .series-itinerary li { position: relative; }
.series-page--tour .series-itinerary a { display: grid; grid-template-columns: clamp(3.1rem, 12vw, 10.5rem) 5rem minmax(0, 1fr) auto; align-items: center; min-height: clamp(5.1rem, 8vw, 7rem); gap: 0; padding: .3rem 1rem .3rem 0; border: 0; color: #182127; text-decoration: none; }
.series-page--tour .series-itinerary a:hover, .series-page--tour .series-itinerary a:focus-visible { background: #ffffff80; outline-offset: 2px; }
.series-page--tour .series-itinerary a:focus-visible { outline: 3px solid #182127; }
.series-itinerary__marker { grid-column: 2; z-index: 1; display: flex; align-items: center; }
.series-itinerary__marker svg { width: clamp(3rem, 5.5vw, 4.5rem); height: clamp(4rem, 7vw, 6rem); color: var(--pin-color); }
.series-itinerary__entry { grid-column: 3; display: flex; align-items: baseline; gap: .75rem; min-width: 0; }
.series-page--tour .series-itinerary__entry small { flex: none; color: #182127; font: 600 clamp(1.05rem, 2.6vw, 2rem)/1 RobotoCondensed, sans-serif; }
.series-page--tour .series-itinerary__entry strong { color: #182127; font: 800 clamp(1.5rem, 3.3vw, 3rem)/1 RobotoCondensed, sans-serif; }
.series-itinerary__next { grid-column: 1; grid-row: 1; color: #0c8144; font: 800 clamp(.85rem, 2vw, 1.55rem)/1 RobotoCondensed, sans-serif; text-align: right; padding-right: .65rem; }
.series-page--tour .series-itinerary a.is-next .series-itinerary__entry { background: #fffefa; box-shadow: 6px 6px 0 #182127; padding: .5rem; }
.series-page--tour .tour-body { max-width: 100rem; padding-bottom: 5rem; }
.series-page--tour .tour-map-card { border: 3px solid #182127; border-radius: 0; box-shadow: 9px 10px 0 #087ea433; }
.series-page--tour .tour-map-card__top { background: #182127; color: white; font: 800 1.25rem RobotoCondensed, sans-serif; }
.series-page--tour .tour-map-note { margin: 0; padding: .3rem .8rem; background: #fffefa; color: #46555a; font-size: .7rem; }
.series-page--tour .tour-stop-strip { background: #fffefa; }
.series-page--tour .tour-stop-strip a { background: #dcf6fd; color: #182127; font-weight: 800; }
.series-page--tour .tour-stop-strip a.is-active { background: #182127; color: white; }
.series-page--tour .tour-chapters { border-left: 4px dashed #087ea4; }
.series-page--tour .tour-chapter { grid-template-columns: 5rem minmax(0, 1fr); min-height: 30rem; }
.series-page--tour .tour-chapter__number { position: relative; width: 4.8rem; height: 6.5rem; margin: 0 0 0 -2.5rem; border: 0; border-radius: 0; background: none; box-shadow: none; line-height: normal; }
.tour-chapter__number svg { width: 100%; height: 100%; color: var(--pin-color); }
.tour-chapter__number span { position: absolute; top: 1.15rem; left: 0; width: 100%; color: #182127; font: 900 1.2rem RobotoCondensed, sans-serif; }
.series-page--tour .tour-chapter__body { padding: 1rem 1.5rem 4rem .25rem; }
.series-page--tour .tour-chapter__eyebrow { color: #075b79; }
.tour-chapter__title { position: relative; isolation: isolate; padding: 1.25rem 0 1rem; }
.tour-chapter__watermark { position: absolute; z-index: -1; top: -1rem; right: 4%; width: clamp(8rem, 18vw, 17rem); height: 17rem; color: var(--pin-color); opacity: .8; transform: rotate(12deg); }
.series-page--tour .tour-chapter h3 { position: relative; max-width: 12ch; margin: 1rem 0 .5rem; color: #182127; font-size: clamp(3rem, 6vw, 6rem); line-height: .88; text-wrap: balance; }
.tour-chapter__date-pill { display: inline-flex; align-items: center; gap: .4rem; border-radius: 999px; padding: .25rem .8rem .25rem .3rem; background: #182127; color: white; font: 800 1.35rem RobotoCondensed, sans-serif; }
.tour-chapter__date-pill b { display: grid; place-items: center; min-width: 1.5rem; height: 1.5rem; border-radius: 50%; background: white; color: #182127; font-size: 1rem; }
.series-page--tour .tour-chapter__event-title { max-width: 25ch; margin-top: 1rem; color: #182127; font: 800 clamp(1.45rem, 2.5vw, 2.5rem)/1.1 RobotoCondensed, sans-serif; }
.series-page--tour .tour-chapter__status { border-left-color: #182127; background: #fffefa; color: #182127; }
.series-page--tour .tour-chapter__links a { border-color: #182127; border-radius: 0; background: #fffefa; color: #182127; }
.series-page--tour .tour-chapter__paging { color: #182127; font-weight: 800; }
.series-page--tour .tour-photos figure { border: 6px solid white; background: white; box-shadow: 9px 12px 0 #087ea433; }
.series-page--tour .series-outro { margin-top: 0; border-top: 4px solid #182127; background: #85dcfa; }
.series-page--tour .series-outro__references h2, .series-page--tour .series-outro__references a { color: #182127; }
.series-brand { display: flex; justify-content: center; margin: 0 auto 3rem; }
.series-brand__logo { max-width: min(100%, 28rem); height: auto; object-fit: contain; }
.series-brand__fallback { display: flex; align-items: center; gap: .5rem; color: #182127; font: 800 clamp(1rem, 2vw, 1.75rem) RobotoCondensed, sans-serif; }
.series-brand__fallback svg { width: 2.5rem; height: 3rem; color: #16bae7; }
.series-brand__fallback strong { font-weight: 900; }
@media (max-width: 900px) {
  .series-page--tour .series-hero { display: flex; flex-direction: column-reverse; min-height: 0; }
  .series-page--tour .series-hero__art { min-height: 16rem; max-height: none; }
  .series-page--tour .series-hero__copy { padding: 2.5rem 1.5rem 3rem; }
  .series-page--tour .series-hero h1 { font-size: clamp(3.2rem, 11vw, 6rem); }
  .series-hero__giant-pin { top: -45%; left: 18%; width: 55%; height: 200%; }
  .series-hero__route-label { font-size: .85rem; }
  .series-hero__route-label:nth-of-type(n+3) { display: none; }
  .series-page--tour .series-itinerary a { grid-template-columns: 3.1rem 3.5rem minmax(0, 1fr); }
  .series-page--tour .series-itinerary::before { left: 3.1rem; }
  .series-itinerary__next { position: absolute; top: -.9rem; left: 0; padding: .15rem .3rem; background: #fffefa; font-size: .8rem; }
  .series-page--tour .tour-map-toggle { color: white; }
  .series-page--tour .tour-chapter { grid-template-columns: 3rem minmax(0, 1fr); }
  .series-page--tour .tour-chapter__number { width: 3rem; height: 4rem; margin-left: -1.6rem; }
  .tour-chapter__number span { top: .72rem; font-size: .9rem; }
}
@media (max-width: 480px) {
  .series-page--tour .series-facts { gap: .4rem; padding: 1rem .3rem; }
  .series-page--tour .series-facts strong { font-size: 2.25rem; }
  .series-page--tour .series-facts span { font-size: .66rem; }
  .series-page--tour .series-itinerary__entry { flex-direction: column; gap: .05rem; }
  .series-page--tour .series-itinerary__entry strong { font-size: clamp(1.3rem, 6vw, 2rem); }
  .series-page--tour .tour-chapter h3 { overflow-wrap: anywhere; }
  .tour-chapter__watermark { right: -1rem; width: 9rem; opacity: .5; }
  .series-brand__fallback { flex-wrap: wrap; justify-content: center; }
}
</style>

<style>
html[data-theme="staedteChallengeDark"] .series-page { color: #e8eef0; background: #15252c; }
html[data-theme="staedteChallengeDark"] .series-hero { background: #1d343d; }
html[data-theme="staedteChallengeDark"] .series-hero h1,
html[data-theme="staedteChallengeDark"] .series-route-heading h2,
html[data-theme="staedteChallengeDark"] .standard-series h2,
html[data-theme="staedteChallengeDark"] .tour-chapter h3,
html[data-theme="staedteChallengeDark"] .series-outro__references h2 { color: #9bddea; }
html[data-theme="staedteChallengeDark"] .series-kicker,
html[data-theme="staedteChallengeDark"] .tour-chapter__eyebrow { color: #a8d483; }
html[data-theme="staedteChallengeDark"] .series-facts,
html[data-theme="staedteChallengeDark"] .tour-map-card,
html[data-theme="staedteChallengeDark"] .tour-chapter__links a { background: #1e323b; border-color: #42606a; }
html[data-theme="staedteChallengeDark"] .series-facts strong,
html[data-theme="staedteChallengeDark"] .series-itinerary a,
html[data-theme="staedteChallengeDark"] .tour-map-card__top,
html[data-theme="staedteChallengeDark"] .tour-map-toggle,
html[data-theme="staedteChallengeDark"] .tour-chapter__links a,
html[data-theme="staedteChallengeDark"] .tour-chapter__paging,
html[data-theme="staedteChallengeDark"] .series-outro__references a { color: #9bddea; }
html[data-theme="staedteChallengeDark"] .series-route-heading p,
html[data-theme="staedteChallengeDark"] .series-itinerary small,
html[data-theme="staedteChallengeDark"] .series-facts span,
html[data-theme="staedteChallengeDark"] .tour-chapter__event-title { color: #bfced3; }
html[data-theme="staedteChallengeDark"] .tour-chapter__status { background: #31422a; color: #e8eef0; }
html[data-theme="staedteChallengeDark"] .tour-chapter__attendance { background: #29434c; color: #b7e3ec; }
html[data-theme="staedteChallengeDark"] .tour-stop-strip a { background: #29434c; color: #b7e3ec; }
html[data-theme="staedteChallengeDark"] .tour-stop-strip a.is-active { background: #f27c00; color: #18262c; }
html[data-theme="staedteChallengeDark"] .series-outro { background: #1d343d; }
html[data-theme="staedteChallengeDark"] .tour-photos figure { color: #24343d; }
html[data-theme="staedteChallengeDark"] .series-page--tour { --tour-ink: #edfaff; --tour-blue: #133845; background: #133845; color: #edfaff; }
html[data-theme="staedteChallengeDark"] .series-page--tour .series-hero { background: #164c60; }
html[data-theme="staedteChallengeDark"] .series-page--tour .series-hero__art,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-outro { background: #17627b; }
html[data-theme="staedteChallengeDark"] .series-page--tour .series-hero h1,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-route-heading h2,
html[data-theme="staedteChallengeDark"] .series-page--tour .tour-chapter h3,
html[data-theme="staedteChallengeDark"] .series-page--tour .tour-chapter__event-title,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-outro__references h2,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-outro__references a,
html[data-theme="staedteChallengeDark"] .series-brand__fallback { color: #edfaff; }
html[data-theme="staedteChallengeDark"] .series-page--tour .series-intro,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-route-heading > p,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-itinerary__entry small,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-itinerary__entry strong { color: #d8f2f9; }
html[data-theme="staedteChallengeDark"] .series-page--tour .series-facts,
html[data-theme="staedteChallengeDark"] .series-page--tour .tour-chapter__status,
html[data-theme="staedteChallengeDark"] .series-page--tour .tour-chapter__links a { background: #102b36; color: #edfaff; }
html[data-theme="staedteChallengeDark"] .series-page--tour .series-facts strong,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-facts span,
html[data-theme="staedteChallengeDark"] .series-page--tour .tour-chapter__links a { color: #edfaff; }
html[data-theme="staedteChallengeDark"] .series-page--tour .series-itinerary a.is-next .series-itinerary__entry { background: #102b36; box-shadow: 6px 6px 0 #16bae7; }
html[data-theme="staedteChallengeDark"] .series-page--tour .tour-chapter__eyebrow,
html[data-theme="staedteChallengeDark"] .series-page--tour .series-kicker { color: #9eeaff; }
html[data-theme="staedteChallengeDark"] .series-page--tour .tour-map-note { background: #102b36; color: #edfaff; }
</style>
