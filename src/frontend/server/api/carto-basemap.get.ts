const RASTER_TILE = /^\/(light_all|dark_all)\/(\d{1,2})\/(\d{1,10})\/(\d{1,10})(@2x)?\.png$/;
const SPRITE = /^\/gl\/(?:positron-gl-style|dark-matter-gl-style|voyager-gl-style)\/sprite(?:@2x)?\.(?:png|json)$/;
const GLYPH = /^\/fonts\/([^/]{1,160})\/(\d{1,6})-(\d{1,6})\.pbf$/;

function cartoAsset(path: string): { host: string; contentType: string } | null {
  const tile = RASTER_TILE.exec(path);
  if (tile) {
    const zoom = Number(tile[2]);
    if (zoom > 20 || Number(tile[3]) >= 2 ** zoom || Number(tile[4]) >= 2 ** zoom) return null;
    return { host: "basemaps.cartocdn.com", contentType: "image/png" };
  }

  if (SPRITE.test(path)) {
    return {
      host: "tiles.basemaps.cartocdn.com",
      contentType: path.endsWith(".json") ? "application/json" : "image/png",
    };
  }

  const glyph = GLYPH.exec(path);
  if (glyph) {
    let fontstack: string;
    try {
      fontstack = decodeURIComponent(glyph[1]);
    } catch {
      return null;
    }
    if (!/^[A-Za-z0-9 ,+_-]+$/.test(fontstack)) return null;
    return { host: "tiles.basemaps.cartocdn.com", contentType: "application/x-protobuf" };
  }

  return null;
}

export default defineEventHandler(async (event) => {
  const requestUrl = new URL(event.path ?? "/", "http://carto-proxy.local");
  if (requestUrl.searchParams.size !== 1) {
    throw createError({ statusCode: 404, statusMessage: "Basemap asset not found" });
  }
  const path = requestUrl.searchParams.get("asset") ?? "";
  const asset = cartoAsset(path);
  if (!asset) throw createError({ statusCode: 404, statusMessage: "Basemap asset not found" });

  const apiKey = (process.env.CARTO_BASEMAP_API_KEY ?? useRuntimeConfig(event).cartoBasemapApiKey)?.trim();
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: "Basemap is not configured" });

  let upstream: Response;
  try {
    upstream = await fetch(`https://${asset.host}${path}?key=${encodeURIComponent(apiKey)}`, {
      redirect: "manual",
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Basemap upstream unavailable" });
  }

  if (!upstream.ok) throw createError({ statusCode: 502, statusMessage: "Basemap upstream request failed" });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
});
