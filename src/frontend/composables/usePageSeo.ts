import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useHead, useNuxtApp, useRoute, useRuntimeConfig, useSeoMeta } from "#imports";
import logo from "~/assets/images/Stadt-Land-Klima-Logo_quad_bordered.png";
import { seoMessages } from "~/shared/seoMessages";
import type { TranslationParams } from "~/shared/i18n";
import {
  canonicalUrl,
  isPrivateSeoRoute,
  metadataText,
  metadataTitle,
  resolveSiteOrigin,
  SITE_NAME,
  socialAssetUrl,
} from "~/shared/seo";

// Keep crawler metadata before styles/preloads, after charset, viewport and CSP.
const SEO_TAG_PRIORITY = 15;

type SeoKey = keyof (typeof seoMessages)["de-DE"];
type SeoText = MaybeRefOrGetter<string | null | undefined>;
type SeoAsset = { id: string; type?: string | null | undefined } | string | null | undefined;
type PageSeoOptions = {
  title?: SeoText;
  description?: SeoText;
  image?: MaybeRefOrGetter<SeoAsset>;
  socialImagePath?: SeoText;
  type?: "website" | "article";
};

/** Bundled YAML-derived copy keeps crawler metadata useful before import and during CMS outages. */
export function useSeoText() {
  const { $t, $locale } = useNuxtApp();
  return (key: SeoKey, params: TranslationParams = {}): string => {
    const translated = $t(key, params);
    let value = translated && translated !== key ? translated : seoMessages[$locale][key];
    for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(name, String(replacement ?? ""));
    return value;
  };
}

/** Page scope disposal keeps metadata fresh across client navigation as well as SSR. */
export function usePageSeo(options: MaybeRefOrGetter<PageSeoOptions> = {}) {
  const config = useRuntimeConfig();
  const route = useRoute();
  const text = useSeoText();
  const sectionDescriptions: Readonly<Record<string, SeoKey>> = {
    municipalities: "seo.municipalities.description",
    measures: "seo.measures.description",
    projects: "seo.projects.description",
    news: "seo.news.description",
    events: "seo.events.description",
    jobs: "seo.jobs.description",
    stats: "seo.stats.description",
    data: "seo.data.description",
    regions: "seo.data.description",
    map: "seo.municipalities.description",
  };
  const title = computed(() => metadataText(toValue(toValue(options).title), 110) || text("seo.title"));
  const description = computed(
    () =>
      metadataText(toValue(toValue(options).description)) ||
      text(sectionDescriptions[route.path.split("/")[1] ?? ""] ?? "seo.description"),
  );
  const site = resolveSiteOrigin(config.public.siteUrl);
  const privateRoute = computed(() => isPrivateSeoRoute(route.path, route.query));
  const image = computed(() => {
    if (privateRoute.value) return null;
    const path = toValue(toValue(options).socialImagePath);
    if (path && /^\/api\/public\/municipalities\/[a-z0-9-]{1,160}\/social-image(?:\?|$)/.test(path))
      return new URL(path, site).href;
    return socialAssetUrl(config.public.clientDirectusUrl, toValue(toValue(options).image), site);
  });
  const imageUrl = computed(() => image.value || new URL(logo, site).href);
  const shareTitle = computed(() => (privateRoute.value ? SITE_NAME : metadataTitle(title.value)));
  const shareDescription = computed(() => (privateRoute.value ? text("seo.description") : description.value));
  useHead(
    () => ({
      title: title.value,
      // Explicit tags retain compatibility with messenger clients and older card consumers.
      meta: [
        { name: "twitter:card", content: image.value ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: shareTitle.value },
        { name: "twitter:description", content: shareDescription.value },
        { name: "twitter:image", content: imageUrl.value },
        { name: "twitter:image:alt", content: image.value ? title.value : text("seo.image_alt") },
      ],
    }),
    { tagPriority: SEO_TAG_PRIORITY },
  );
  useSeoMeta(
    {
      description: shareDescription,
      ogTitle: shareTitle,
      ogDescription: shareDescription,
      ogType: () => (privateRoute.value ? "website" : (toValue(options).type ?? "website")),
      ogImage: imageUrl,
      ogImageWidth: () => (image.value ? 1200 : 452),
      ogImageHeight: () => (image.value ? 630 : 447),
      ogImageAlt: () => (image.value ? title.value : text("seo.image_alt")),
    },
    { tagPriority: SEO_TAG_PRIORITY },
  );
}

export function useSiteSeo() {
  const config = useRuntimeConfig();
  const route = useRoute();
  const { $locale } = useNuxtApp();
  usePageSeo();
  const privateRoute = computed(() => isPrivateSeoRoute(route.path, route.query));
  useHead(
    () => ({
      titleTemplate: (title) => metadataTitle(title),
      link: privateRoute.value
        ? []
        : [{ rel: "canonical", href: canonicalUrl(config.public.siteUrl, route.path, route.query) }],
    }),
    { tagPriority: SEO_TAG_PRIORITY },
  );
  useSeoMeta(
    {
      ogSiteName: SITE_NAME,
      ogLocale: $locale.replace("-", "_"),
      ogUrl: () => (privateRoute.value ? undefined : canonicalUrl(config.public.siteUrl, route.path, route.query)),
      robots: () => (privateRoute.value ? "noindex, nofollow, noarchive" : "index, follow, max-image-preview:large"),
    },
    { tagPriority: SEO_TAG_PRIORITY },
  );
}
