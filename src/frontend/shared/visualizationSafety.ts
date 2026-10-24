import type { Loader } from "vega";
import type { VisualizationSpec } from "vega-embed";
import type { StyleSpecification } from "maplibre-gl";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { asRecord, cloneVisualization } from "./visualization";
import { parseGeoData } from "./contracts/geometry";
import { assertEditorJson } from "./editorBlocks";

/** URLs stay HTTP(S), credential-free and outside private same-origin application APIs. */
export function visualizationUrl(value: string, origin = "https://visualization.invalid"): string {
  for (const character of value) {
    if (character.charCodeAt(0) <= 32 || character === "\\") throw new Error("Invalid visualization URL");
  }
  if (!value || value !== value.trim() || value.startsWith("//")) throw new Error("Invalid visualization URL");
  const url = new URL(value, origin);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid visualization URL");
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    throw new Error("Invalid visualization URL");
  }
  if (url.origin === new URL(origin).origin) {
    const publicApi =
      /^\/api\/(?:public(?:\/|$)|stadtlandzahl(?:\/|$)|carto-basemap(?:\?|\/|$)|area-(?:by-slug|children|ancestors|nearby|search)(?:\/|$)|content-search(?:\/|$))/;
    if (
      (path.startsWith("/api/") && !publicApi.test(path)) ||
      /^\/(?:admin|auth|graphql|items|elections\/thesen)(?:\/|$)/.test(path)
    )
      throw new Error("Private visualization URL");
  }
  return value;
}
/** The loader is also used for runtime-computed data, image and hyperlink URLs. */
export function safeVisualizationLoader(loader: Loader, origin: string): Loader {
  const safe: Loader = {
    ...loader,
    async load(uri, options) {
      return loader.load.call(safe, visualizationUrl(uri, origin), options);
    },
    async sanitize(uri, options) {
      const result = await loader.sanitize(visualizationUrl(uri, origin), options);
      visualizationUrl(result.href, origin);
      return { ...result, target: "_blank", rel: "noopener noreferrer" };
    },
    async http(uri, options) {
      return loader.http(visualizationUrl(uri, origin), { ...options, credentials: "omit", redirect: "error" });
    },
    file() {
      return Promise.reject(new Error("Local visualization files are not supported"));
    },
  };
  return safe;
}

export function checkedVisualizationSpec(input: unknown): VisualizationSpec {
  assertEditorJson(input);
  const spec = cloneVisualization(input);
  if (!(
    typeof spec.mark === "string" ||
    asRecord(spec.mark) ||
    Array.isArray(spec.marks) ||
    ["layer", "hconcat", "vconcat", "concat"].some((key) => Array.isArray(spec[key])) ||
    ((spec.facet || spec.repeat) && asRecord(spec.spec))
  ))
    throw new Error("Unsupported visualization specification");
  // A remote document cannot replace the application's loader, interpreter, actions or CSS.
  const meta = asRecord(spec.usermeta);
  if (meta) delete meta.embedOptions;
  // Validate URL-bearing config (data values and labels are arbitrary user data).
  function visit(value: unknown, depth: number): void {
    if (depth > 64) throw new Error("Visualization is too deep");
    if (Array.isArray(value)) {
      for (const child of value) visit(child, depth + 1);
      return;
    }
    const record = asRecord(value);
    if (!record) return;
    for (const [key, child] of Object.entries(record)) {
      if (key === "values" || key === "datasets" || key === "usermeta") continue;
      if (["url", "href"].includes(key) && typeof child === "string") visualizationUrl(child);
      else visit(child, depth + 1);
    }
  }
  visit(spec, 0);
  // Vega/Vega-Lite's parser performs complete grammar/expression validation at embedding.
  return spec;
}

export function checkedMapStyle(input: unknown): StyleSpecification {
  assertEditorJson(input);
  const style = asRecord(input);
  if (!style || style.version !== 8 || !asRecord(style.sources) || !Array.isArray(style.layers))
    throw new Error("Invalid map style");
  for (const value of [style.glyphs, ...(typeof style.sprite === "string" ? [style.sprite] : [])]) {
    if (typeof value === "string") visualizationUrl(value);
  }
  if (Array.isArray(style.sprite))
    for (const sprite of style.sprite) {
      const entry = asRecord(sprite);
      if (typeof entry?.url === "string") visualizationUrl(entry.url);
    }
  for (const raw of Object.values(asRecord(style.sources) ?? {})) {
    const source = asRecord(raw);
    if (!source) continue;
    for (const key of ["url", "data"]) {
      if (typeof source[key] === "string") visualizationUrl(source[key]);
    }
    for (const key of ["tiles", "urls"]) {
      const values: unknown = source[key];
      if (Array.isArray(values))
        values.forEach((value: unknown) => {
          if (typeof value === "string") visualizationUrl(value);
        });
    }
    if (source.type === "geojson" && typeof source.data !== "string" && !parseGeoData(source.data))
      throw new Error("Invalid map geometry");
  }
  // The installed style-spec validator checks sources, layers, paint and expressions.
  const typed = style as unknown as StyleSpecification;
  if (validateStyleMin(typed).length) throw new Error("Invalid map style");
  return typed;
}
