import type { TranslationKey } from "./translationKeys";

/** Canonical public Nuxt landing pages. Never derive this list from all page files:
 * backend redirects, token workflows and embeds must not become search entries.
 * Dynamic records are indexed separately with their publication checks.
 */
export const PUBLIC_NUXT_ROUTES = [
  { id: "static_home", url: "/", titleKey: "seo.title", textKeys: ["seo.description"] },
  { id: "static_municipalities", url: "/municipalities", titleKey: "municipalities.heading", textKeys: [] },
  { id: "static_map", url: "/map", titleKey: "map.title", textKeys: [] },
  { id: "static_stats", url: "/stats", titleKey: "stats.title", textKeys: [] },
  { id: "static_measures", url: "/measures", titleKey: "measures.heading", textKeys: ["measures.description"] },
  { id: "static_projects", url: "/projects", titleKey: "projects.title", textKeys: [] },
  { id: "static_feedback", url: "/contact", titleKey: "feedback.nav_label", textKeys: ["contact.hero.description"] },
  {
    id: "static_register_localteam",
    url: "/register_localteam",
    titleKey: "localteam.create",
    textKeys: ["localteam.register.intro"],
  },
  { id: "static_news", url: "/news", titleKey: "news.title", textKeys: ["news.description"] },
  { id: "static_jobs", url: "/jobs", titleKey: "jobs.title", textKeys: ["jobs.description"] },
  { id: "static_theses", url: "/abschlussarbeiten", titleKey: "theses.title", textKeys: ["theses.intro"] },
  { id: "static_organisation", url: "/organisation", titleKey: "organisation.title", textKeys: [] },
  { id: "static_events", url: "/events", titleKey: "events.title", textKeys: ["events.hero.description"] },
  { id: "static_data", url: "/data", titleKey: "data.overview.title", textKeys: ["data.dashboard.intro"] },
  { id: "static_tools", url: "/tools", titleKey: "tools.title", textKeys: ["tools.description"] },
  { id: "static_donate", url: "/spenden", titleKey: "donate.page.title", textKeys: ["donate.page.description"] },
  {
    id: "static_wahlcheck",
    url: "/elections/wahlcheck",
    titleKey: "elections.wahlcheck.title",
    textKeys: ["elections.wahlcheck.meta_description"],
  },
  {
    id: "static_municipality_updates",
    url: "/municipalities/updates",
    titleKey: "municipality.updates.title",
    textKeys: ["municipality.updates.description"],
  },
  {
    id: "static_submit_project",
    url: "/projects/submit",
    titleKey: "projects.submit.title",
    textKeys: ["projects.submit.intro"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  url: string;
  titleKey: TranslationKey;
  textKeys: readonly TranslationKey[];
}>;
