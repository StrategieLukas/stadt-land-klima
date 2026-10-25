import { z } from "zod";
import type { Geometry } from "geojson";
const position = z.tuple([z.number(), z.number()]).rest(z.number());
const ring = z.array(position);
export const BoundaryGeometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: z.array(ring) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(ring)) }),
]);
export type BoundaryGeometry = z.infer<typeof BoundaryGeometrySchema>;
const simpleGeometry = z.union([
  BoundaryGeometrySchema,
  z.object({ type: z.literal("Point"), coordinates: position }),
  z.object({ type: z.literal("MultiPoint"), coordinates: ring }),
  z.object({ type: z.literal("LineString"), coordinates: ring }),
  z.object({ type: z.literal("MultiLineString"), coordinates: z.array(ring) }),
]);
export const GeometrySchema: z.ZodType<Geometry> = z.lazy(() =>
  z.union([simpleGeometry, z.object({ type: z.literal("GeometryCollection"), geometries: z.array(GeometrySchema) })]),
);
export const GeoFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: GeometrySchema.nullable(),
  properties: z.record(z.string(), z.unknown()).nullable().default(null),
});
export const GeoDataSchema = z.union([
  GeometrySchema,
  GeoFeatureSchema,
  z.object({ type: z.literal("FeatureCollection"), features: z.array(GeoFeatureSchema) }),
]);
export type GeoData = z.infer<typeof GeoDataSchema>;
export function parseGeoData(input: unknown): GeoData | null {
  try {
    const parsed = GeoDataSchema.safeParse(typeof input === "string" ? (JSON.parse(input) as unknown) : input);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function parseGeoCenter(input: unknown): { lat: number; lon: number } | null {
  try {
    const raw: unknown = typeof input === "string" ? (JSON.parse(input) as unknown) : input;
    if (
      Array.isArray(raw) &&
      typeof raw[0] === "number" &&
      typeof raw[1] === "number" &&
      Number.isFinite(raw[0]) &&
      Number.isFinite(raw[1])
    )
      return { lon: raw[0], lat: raw[1] };
    if (!raw || typeof raw !== "object") return null;
    if ("coordinates" in raw) return parseGeoCenter(raw.coordinates);
    const lat = "lat" in raw ? raw.lat : "latitude" in raw ? raw.latitude : undefined;
    const lon = "lon" in raw ? raw.lon : "lng" in raw ? raw.lng : "longitude" in raw ? raw.longitude : undefined;
    return typeof lat === "number" && Number.isFinite(lat) && typeof lon === "number" && Number.isFinite(lon)
      ? { lat, lon }
      : null;
  } catch {
    return null;
  }
}
