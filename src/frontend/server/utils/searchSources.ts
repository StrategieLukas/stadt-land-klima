import { readItems } from "@directus/sdk";
import { z } from "zod";
import { isOrganisationTeamKey, ORGANISATION_TEAM_LABELS } from "../../shared/organisationTeams.ts";
import { staticSearchMessages } from "../../shared/staticSearchMessages.ts";
import type { createDirectusServerClient } from "./directusServerClient";
import { parseCms } from "./parseCms";
import { stripHtml, stripMd, type SiteContentDoc } from "./extractContent";

export const SEARCH_SOURCES = {
  climate_tool: {
    collection: "climate_tools",
    idField: "id",
    fields: ["id", "status", "title", "description", "category", "vendor"],
    filter: { status: { _eq: "published" } },
  },
  event_series: {
    collection: "event_series",
    idField: "id",
    fields: ["id", "status", "slug", "title", "introduction", "format", "closing_reflection"],
    filter: { status: { _eq: "published" } },
  },
  tour: {
    collection: "success_project_tours",
    idField: "id",
    fields: ["id", "status", "slug", "title", "introduction", "closing_reflection"],
    filter: { status: { _eq: "published" } },
  },
  tour_stop: {
    collection: "success_project_tour_stops",
    idField: "id",
    fields: [
      "id",
      "status",
      "slug",
      "title",
      "location",
      "state",
      "visit_details",
      "report_status",
      "report_title",
      "teaser",
      "tour.slug",
      "tour.title",
      "tour.status",
    ],
    filter: { status: { _eq: "published" }, tour: { status: { _eq: "published" } } },
  },
  team: { collection: "organisation_teams", idField: "team_key", fields: ["team_key", "label", "tasks"], filter: {} },
} as const;
export type SearchSourceType = keyof typeof SEARCH_SOURCES;
export function isSearchSourceType(type: string): type is SearchSourceType {
  return Object.hasOwn(SEARCH_SOURCES, type);
}
const text = z
  .string()
  .nullish()
  .transform((value) => value ?? "");
const id = z.union([z.string().regex(/^[a-zA-Z0-9_-]+$/), z.number().int().nonnegative()]).transform(String);
const slug = z.string().regex(/^[a-z0-9-]{1,160}$/);
const published = z.object({ id, status: z.literal("published"), title: text });
const routed = published.extend({ slug });
const clean = (...values: unknown[]) =>
  values
    .map((value) => stripMd(stripHtml(value)))
    .filter(Boolean)
    .join(" ");

export function buildSourceDoc(type: SearchSourceType, input: unknown): SiteContentDoc | null {
  if (type === "team") {
    const row = parseCms(z.object({ team_key: z.string(), label: text, tasks: z.array(z.string()).nullish() }), input);
    if (!isOrganisationTeamKey(row.team_key)) return null;
    const keys = ORGANISATION_TEAM_LABELS[row.team_key];
    const title = row.label.trim() || keys.map((key) => staticSearchMessages["de-DE"][key]).join(" ");
    return {
      id: `team_${row.team_key}`,
      type,
      title: clean(title),
      text: clean(title, ...(row.tasks ?? [])),
      url: `/organisation#team-${row.team_key}`,
      meta: null,
    };
  }
  if (type === "climate_tool") {
    const row = parseCms(published.extend({ description: text, category: text, vendor: text }), input);
    return {
      id: `${type}_${row.id}`,
      type,
      title: clean(row.title),
      text: clean(row.description, row.category, row.vendor),
      url: `/tools#tool-${row.id}`,
      meta: clean(row.category) || null,
    };
  }
  if (type === "tour_stop") {
    const row = parseCms(
      routed.extend({
        location: text,
        state: text,
        visit_details: text,
        report_status: text,
        report_title: text,
        teaser: text,
        tour: z.object({ slug, title: text, status: z.literal("published") }),
      }),
      input,
    );
    const reportPublished = row.report_status === "published";
    return {
      id: `${type}_${row.id}`,
      type,
      title: clean((reportPublished && row.report_title) || row.title || row.slug),
      text: clean(
        row.title,
        row.location,
        row.state,
        row.visit_details,
        row.tour.title,
        ...(reportPublished ? [row.report_title, row.teaser] : []),
      ),
      url: `/projects/tours/${row.tour.slug}/${row.slug}`,
      meta: clean(row.tour.title) || null,
      requiresPublishedReport: reportPublished,
    };
  }
  const row = parseCms(routed.extend({ introduction: text, closing_reflection: text, format: text }), input);
  return {
    id: `${type}_${row.id}`,
    type,
    title: clean(row.title || row.slug),
    text: clean(row.introduction, row.closing_reflection, type === "event_series" ? row.format : ""),
    url: `${type === "tour" ? "/projects/tours" : "/events/series"}/${row.slug}`,
    meta: type === "event_series" ? clean(row.format) || null : null,
  };
}

export async function readSearchSourceDocs(
  client: ReturnType<typeof createDirectusServerClient>,
  type: SearchSourceType,
  ids?: string[],
) {
  const source = SEARCH_SOURCES[type];
  const rows = parseCms(
    z.array(z.record(z.string(), z.unknown())),
    await client.request(
      readItems(source.collection, {
        fields: [...source.fields],
        filter: { ...source.filter, ...(ids ? { [source.idField]: { _in: ids } } : {}) },
        limit: -1,
      }),
    ),
  );
  return rows.map((row) => buildSourceDoc(type, row)).filter((doc): doc is SiteContentDoc => doc !== null);
}

export function buildElectionDoc(input: unknown): SiteContentDoc {
  const row = parseCms(
    z.object({ id, descriptor: text, municipalitySlug: slug, municipalityName: z.string(), localteamName: text }),
    input,
  );
  return {
    id: `election_${row.id}`,
    type: "election",
    title: clean([row.descriptor, row.municipalityName].filter(Boolean).join(" · ")),
    text: clean(row.descriptor, row.municipalityName, row.localteamName),
    url: `/elections/wahlcheck/${row.municipalitySlug}`,
    meta: clean(row.municipalityName),
  };
}
