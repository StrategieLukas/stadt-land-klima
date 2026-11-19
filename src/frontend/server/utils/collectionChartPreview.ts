import sanitize from "sanitize-html";
import { loader, parse, View, type Spec as VegaSpec } from "vega";
import { compile, type TopLevelSpec } from "vega-lite";
import { expressionInterpreter } from "vega-interpreter";
import { asRecord, cloneVisualization } from "~/shared/visualization";
import { checkedVisualizationSpec } from "~/shared/visualizationSafety";
import {
  collectionChartPalette,
  withCollectionChartTheme,
  withCollectionChartThemeSignal,
  type CollectionChartPreview,
} from "~/utils/collectionChartTheme";

/** SSR only loads the public scalar feeds used by collection charts, never arbitrary URLs or files. */
export function collectionChartPreviewUrl(value: string): string {
  if (!value.startsWith("/api/stadtlandzahl/api/collections/")) throw new Error("Unsupported preview data URL");
  const url = new URL(value, "http://chart-preview.invalid");
  if (
    !/^\/api\/stadtlandzahl\/api\/collections\/[a-zA-Z0-9_-]{1,160}\/(?:timeseries|histogram|summary)\/$/.test(
      url.pathname,
    )
  )
    throw new Error("Unsupported preview data feed");
  if (url.hash || url.search.length > 2048) throw new Error("Invalid preview data query");
  return `${url.pathname}${url.search}`;
}

/** Generated SVG still crosses an HTML boundary: allow geometry/text and local paint references only. */
function sanitizePreview(svg: string, prefix: string): string {
  if (Buffer.byteLength(svg) > 256 * 1024) throw new Error("Chart preview is too large");
  const isolated = svg
    .replaceAll(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replaceAll(/url\(#([^)]*)\)/g, `url(#${prefix}$1)`);
  return sanitize(isolated, {
    allowedTags: [
      "svg",
      "g",
      "path",
      "circle",
      "ellipse",
      "rect",
      "line",
      "polyline",
      "polygon",
      "title",
      "desc",
      "text",
      "tspan",
      "defs",
      "clipPath",
      "linearGradient",
      "radialGradient",
      "stop",
    ],
    allowedAttributes: {
      "*": [
        "xmlns",
        "viewBox",
        "width",
        "height",
        "d",
        "fill",
        "fill-rule",
        "fill-opacity",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-dashoffset",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-miterlimit",
        "stroke-opacity",
        "opacity",
        "transform",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "points",
        "id",
        "clip-path",
        "text-anchor",
        "dominant-baseline",
        "font-family",
        "font-size",
        "font-weight",
        "font-style",
        "dx",
        "dy",
        "offset",
        "stop-color",
        "stop-opacity",
        "gradientUnits",
        "gradientTransform",
      ],
    },
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    nonTextTags: ["script", "style", "foreignObject"],
    transformTags: {
      "*": (tagName, attributes) => {
        for (const key of ["fill", "stroke", "stop-color", "clip-path"]) {
          const value = attributes[key];
          if (
            value &&
            !/^(?:none|currentColor|transparent|[a-z]+|#[a-f0-9]{3,8}|rgba?\([\d\s.,%]+\)|url\(#[a-zA-Z0-9_-]+\))$/i.test(
              value,
            )
          )
            delete attributes[key];
        }
        return { tagName, attribs: attributes };
      },
    },
  });
}

export async function renderCollectionChartPreview(
  input: unknown,
  height: number,
  prefix: string,
  load: (url: string) => Promise<string>,
): Promise<CollectionChartPreview> {
  const signalName = "slk_ssr_chart_palette";
  const sized = cloneVisualization(input);
  if (!["hconcat", "vconcat", "concat", "facet", "repeat"].some((key) => sized[key])) {
    sized.width = 640;
    sized.height = Math.max(160, Math.min(760, height));
    sized.autosize = { type: "fit", contains: "padding" };
  }
  const spec = checkedVisualizationSpec(withCollectionChartTheme(sized, signalName));
  const compiled = Array.isArray(asRecord(spec)?.marks) ? (spec as VegaSpec) : compile(spec as TopLevelSpec).spec;
  const data: Record<string, string> = {};
  let feedFailed = false;
  const previewLoader = loader();
  previewLoader.load = async (uri) => {
    try {
      const url = collectionChartPreviewUrl(uri);
      const body = await load(url);
      data[url] = body;
      return body;
    } catch (error) {
      feedFailed = true;
      throw error;
    }
  };
  previewLoader.sanitize = () => Promise.reject(new Error("Chart preview external resources are disabled"));
  const view = new View(parse(withCollectionChartThemeSignal(compiled, signalName, false), {}, { ast: true }), {
    renderer: "none",
    loader: previewLoader,
    expr: expressionInterpreter,
  });
  try {
    const light = sanitizePreview(await view.toSVG(), `${prefix}light-`);
    if (feedFailed) throw new Error("Chart preview feed unavailable");
    await view.signal(signalName, collectionChartPalette(true)).runAsync();
    const dark = sanitizePreview(await view.toSVG(), `${prefix}dark-`);
    return { light, dark, data };
  } finally {
    view.finalize();
  }
}
