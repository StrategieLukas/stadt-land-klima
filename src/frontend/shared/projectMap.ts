import { z } from "zod";
import { pointLatLng, type TourPoint } from "./tour";

export const ProjectPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});
export const ProjectMunicipalitySchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  geolocation: ProjectPointSchema.nullish()
    .catch(null)
    .transform((value) => value ?? null),
});
export const ProjectMapLocationSchema = z.object({
  geolocation: ProjectPointSchema,
  source: z.enum(["project", "municipality"]),
  municipality_name: z.string(),
});
export type ProjectMapLocation = z.infer<typeof ProjectMapLocationSchema>;
export type ProjectMunicipality = z.infer<typeof ProjectMunicipalitySchema>;
export type ProjectLocationInput = {
  geolocation?: TourPoint | null | undefined;
  municipality?: ProjectMunicipality | null | undefined;
  municipality_name?: string | null | undefined;
  state?: string | null | undefined;
};
const normalized = (value: string | null | undefined) =>
  (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

/** Prepare once per public response; lookup is linear in towns + projects rather than their product. */
export function createProjectLocationResolver(municipalities: readonly ProjectMunicipality[]) {
  const byName = new Map<string, ProjectMunicipality[]>();
  const seen = new Set<string>();
  for (const municipality of municipalities) {
    if (seen.has(municipality.id)) continue;
    seen.add(municipality.id);
    const key = normalized(municipality.name);
    const matches = byName.get(key) ?? [];
    matches.push(municipality);
    byName.set(key, matches);
  }
  // Never guess from partial names, a federal state alone, or an ambiguous match.
  return (project: ProjectLocationInput): ProjectMapLocation | null => {
    if (pointLatLng(project.geolocation))
      return {
        geolocation: project.geolocation!,
        source: "project",
        municipality_name: project.municipality?.name || project.municipality_name || "",
      };
    const linked = project.municipality;
    if (linked)
      return pointLatLng(linked.geolocation)
        ? { geolocation: linked.geolocation!, source: "municipality", municipality_name: linked.name }
        : null;
    const name = normalized(project.municipality_name);
    if (!name) return null;
    const state = normalized(project.state);
    const matches = (byName.get(name) ?? []).filter((candidate) => !state || normalized(candidate.state) === state);
    const match = matches.length === 1 ? matches[0] : undefined;
    return match && pointLatLng(match.geolocation)
      ? { geolocation: match.geolocation!, source: "municipality", municipality_name: match.name }
      : null;
  };
}

export function resolveProjectLocation(project: ProjectLocationInput, municipalities: readonly ProjectMunicipality[]) {
  return createProjectLocationResolver(municipalities)(project);
}

export type ProjectMapItem = { id: number; slug: string; title: string; label: string; location: ProjectMapLocation };
export function groupProjectLocations(projects: readonly ProjectMapItem[]) {
  const groups = new Map<string, { key: string; point: [number, number]; projects: ProjectMapItem[] }>();
  for (const project of projects) {
    const point = pointLatLng(project.location.geolocation);
    if (!point) continue;
    const key = point.join(",");
    const group = groups.get(key) ?? { key, point, projects: [] };
    group.projects.push(project);
    groups.set(key, group);
  }
  return [...groups.values()];
}
