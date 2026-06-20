import type { Collection, CollectionCoverImage, RenderElement, SummaryAggregate } from "~/types/slz-api";

export const DATA_PRODUCT_SECTOR_COLORS: Record<string, string> = {
  energy: "#F59E0B",
  transport: "#3B82F6",
  agriculture: "#10B981",
  management: "#006e94",
  industry: "#8B5CF6",
  general: "#707070",
  other: "#6B7280",
};

const SECTOR_ALIASES: { key: string; pattern: RegExp; label: string }[] = [
  { key: "energy", pattern: /energy|energie/i, label: "Energy" },
  { key: "transport", pattern: /transport|verkehr|connexion/i, label: "Transport" },
  { key: "management", pattern: /management|climate protection/i, label: "Climate Protection Management" },
  {
    key: "agriculture",
    pattern: /agriculture|nature|nutrition|landwirtschaft|natur/i,
    label: "Agriculture, Nature and Nutrition",
  },
  {
    key: "industry",
    pattern: /industry|economy|consumption|wirtschaft|konsum/i,
    label: "Industry, Economy and Consumption",
  },
  { key: "general", pattern: /general|allgemein/i, label: "General" },
];

export function localizedText(value?: Record<string, string> | string | null) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value["de-DE"] || value["en-US"] || "";
}

export function sectorKey(collection: Pick<Collection, "sector">) {
  const raw = collection.sector?.trim() || "";
  const match = SECTOR_ALIASES.find((sector) => sector.pattern.test(raw));
  const fallback = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return (match?.key ?? fallback) || "other";
}

export function sectorLabel(collection: Pick<Collection, "sector" | "sector_label" | "sector_display">) {
  const camelCollection = collection as Collection & {
    sectorLabel?: Collection["sector_label"];
    sectorDisplay?: string;
  };
  const explicit =
    localizedText(collection.sector_label) ||
    localizedText(camelCollection.sectorLabel) ||
    collection.sector_display ||
    camelCollection.sectorDisplay;
  if (explicit) return explicit;
  const raw = collection.sector?.trim() || "";
  return (SECTOR_ALIASES.find((sector) => sector.pattern.test(raw))?.label ?? raw) || "Weitere";
}

export function sectorColor(collection: Pick<Collection, "sector">) {
  return DATA_PRODUCT_SECTOR_COLORS[sectorKey(collection)] ?? DATA_PRODUCT_SECTOR_COLORS.other;
}

export function firstKpiElement(collection: Pick<Collection, "render_elements">) {
  const camelCollection = collection as Collection & {
    renderElements?: RenderElement[];
    renderConfig?: Collection["render_config"];
  };
  const renderElements = collection.render_elements ?? camelCollection.renderElements ?? [];
  const renderElementKpi = renderElements.find((element) => element.type === "kpi") ?? null;
  if (renderElementKpi) return renderElementKpi;

  const renderConfig = ((collection as Collection).render_config ?? camelCollection.renderConfig) as
    | Record<string, any>
    | null
    | undefined;
  const configKpi =
    renderConfig?.kpi ??
    renderConfig?.primary_kpi ??
    renderConfig?.primaryKpi ??
    renderConfig?.threshold_bar ??
    renderConfig?.thresholdBar ??
    renderConfig?.kpis?.[0];

  if (!configKpi?.field && !configKpi?.thresholds) return null;
  return {
    type: "kpi",
    plot_id: configKpi.plot_id ?? configKpi.id ?? "render-config-kpi",
    field: configKpi.field ?? renderConfig?.color_field ?? renderConfig?.colorField,
    title: configKpi.title ?? configKpi.label ?? {},
    label: configKpi.label ?? configKpi.title ?? {},
    unit: configKpi.unit ?? {},
    thresholds: configKpi.thresholds ?? configKpi.threshold_bar?.thresholds ?? configKpi.thresholdBar?.thresholds ?? {},
    population_normalized: configKpi.population_normalized ?? configKpi.populationNormalized ?? false,
    is_percentage: configKpi.is_percentage ?? configKpi.isPercentage ?? false,
    vegalite_spec: null,
  } as RenderElement;
}

export function collectionCoverImage(collection: Collection, assetBaseUrl?: string | null) {
  const camelCollection = collection as Collection & { coverImage?: CollectionCoverImage | null };
  const cover = collection.cover_image ?? camelCollection.coverImage ?? null;
  if (!cover || typeof cover !== "object") return { url: null, attribution: null };

  if (cover.type === "slk_backend_asset") {
    const uuid = cover.asset_uuid ?? cover.assetUuid ?? cover.uuid ?? cover.id ?? null;
    return {
      url: uuid ? (buildBackendAssetUrl(uuid, assetBaseUrl) ?? cover.url ?? null) : (cover.url ?? null),
      attribution:
        localizedText(cover.attribution_key) || localizedText(cover.attributionKey) || localizedText(cover.attribution),
    };
  }

  if (cover.type === "url") {
    return {
      url: cover.url ?? cover.src ?? cover.href ?? null,
      attribution: localizedText(cover.attribution),
    };
  }

  return {
    url: cover.url ?? cover.src ?? cover.href ?? null,
    attribution: localizedText(cover.attribution),
  };
}

function buildBackendAssetUrl(uuid: string, assetBaseUrl?: string | null) {
  const base = assetBaseUrl?.replace(/\/$/, "");
  return base ? `${base}/assets/${uuid}` : null;
}

export function collectionIconifyStr(collection: Collection) {
  const camelCollection = collection as Collection & { iconifyStr?: string | null };
  return collection.iconify_str ?? camelCollection.iconifyStr ?? null;
}

export function normalizeCollection(collection: Collection) {
  const camelCollection = collection as Collection & {
    coverImage?: Collection["cover_image"];
    iconifyStr?: string | null;
    sectorLabel?: Collection["sector_label"];
    sectorDisplay?: string;
    temporalExtent?: Collection["temporal_extent"];
    narrativeSteps?: Collection["narrative_steps"];
    renderElements?: Collection["render_elements"];
    renderConfig?: Collection["render_config"];
    sourceAttributions?: Collection["source_attributions"];
  };

  return {
    ...collection,
    cover_image: collection.cover_image ?? camelCollection.coverImage ?? null,
    iconify_str: collection.iconify_str ?? camelCollection.iconifyStr ?? null,
    sector_label: collection.sector_label ?? camelCollection.sectorLabel,
    sector_display: collection.sector_display ?? camelCollection.sectorDisplay,
    temporal_extent: collection.temporal_extent ?? camelCollection.temporalExtent,
    narrative_steps: collection.narrative_steps ?? camelCollection.narrativeSteps,
    render_elements: collection.render_elements ?? camelCollection.renderElements,
    render_config: collection.render_config ?? camelCollection.renderConfig,
    source_attributions: collection.source_attributions ?? camelCollection.sourceAttributions,
  } as Collection;
}

export function firstMapElement(collection: Pick<Collection, "render_elements">) {
  return collection.render_elements?.find((element) => element.type === "map" && element.vegalite_spec) ?? null;
}

export function bestVisualElement(elements: RenderElement[]) {
  return (
    elements.find((element) => element.type === "map" && element.vegalite_spec) ??
    elements.find((element) => element.type !== "kpi" && element.vegalite_spec) ??
    elements.find((element) => element.type === "image" && element.src_url) ??
    null
  );
}

export function kpiValueFromAggregate(
  kpi: RenderElement | null,
  aggregate: SummaryAggregate | Record<string, unknown> | null,
  population?: number | null,
) {
  if (!kpi?.field || !aggregate) return null;
  const raw = aggregate[kpi.field];
  if (typeof raw !== "number") return null;
  if (kpi.population_normalized && population) return (raw / population) * 1000;
  return raw;
}

export function formatKpiValue(kpi: RenderElement | null, value: number | null) {
  if (value === null || value === undefined) return "Keine Daten";
  if (kpi?.is_percentage) {
    const thresholds = kpi.thresholds ?? {};
    const values = Object.values(thresholds).filter((x) => typeof x === "number" && x > 0);
    const percentValue = values.length > 0 && Math.max(...values) <= 1 ? value * 100 : value;
    return `${percentValue.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`;
  if (value >= 10_000) return value.toLocaleString("de-DE", { maximumFractionDigits: 0 });
  return value.toLocaleString("de-DE", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });
}

export function injectAreaIntoSpec(spec: object | null | undefined, ars: string) {
  if (!spec || !ars) return spec ?? null;
  const cloned = JSON.parse(JSON.stringify(spec));

  function patchNode(node: any) {
    if (node?.data?.url) {
      try {
        const url = new URL(node.data.url);
        url.searchParams.set("area", ars);
        node.data.url = url.toString();
      } catch {
        const separator = String(node.data.url).includes("?") ? "&" : "?";
        node.data.url = `${node.data.url}${separator}area=${encodeURIComponent(ars)}`;
      }
    }
    if (Array.isArray(node?.layer)) node.layer.forEach(patchNode);
    if (Array.isArray(node?.hconcat)) node.hconcat.forEach(patchNode);
    if (Array.isArray(node?.vconcat)) node.vconcat.forEach(patchNode);
  }

  patchNode(cloned);
  return cloned;
}
