import { Resvg, renderAsync, type ResvgRenderOptions } from "@resvg/resvg-js";
import { JOB_SHARE_FORMATS, type JobShareContent, type JobShareFormat } from "../../shared/jobSharing";

export const JOB_IMAGE_REVISION = "1";
const ink = "#16352d";
const muted = "#456157";
const xml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
const graphemes = (value: string) =>
  Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (part) => part.segment);

export type ShareTextBox = { text: string; x: number; y: number; width: number; height: number };

/** Wrap using the actual bundled font; no browser canvas or system fonts. */
export function wrapJobShareText(
  text: string,
  width: number,
  maxLines: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  let line = "";
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= width) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    if (measure(word) <= width) {
      line = word;
      continue;
    }
    for (const character of graphemes(word)) {
      if (line && measure(line + character) > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  let last = graphemes(result[maxLines - 1] ?? "");
  while (last.length && measure(last.join("") + "…") > width) last = last.slice(0, -1);
  result[maxLines - 1] = last.join("").trimEnd() + "…";
  return result;
}

/** All assets are supplied as trusted/static or validated raster data URIs. */
export function jobShareSvg(
  content: JobShareContent,
  format: JobShareFormat,
  fontFile: string,
  brandSvg: string,
  organisationPng?: Buffer,
) {
  const config = JOB_SHARE_FORMATS[format];
  const { width, height, left: x, top } = config;
  const w = width - x - config.right;
  const bottom = height - config.bottom;
  const landscape = format === "link";
  const font: ResvgRenderOptions = {
    font: { loadSystemFonts: false, fontFiles: [fontFile], defaultFontFamily: "Roboto Condensed" },
  };
  const measured = new Map<string, number>();
  function measure(value: string, size: number) {
    const key = `${size}:${value}`;
    const cached = measured.get(key);
    if (cached !== undefined) return cached;
    const bbox = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="300"><text x="2" y="${size + 2}" font-family="Roboto Condensed" font-size="${size}">${xml(value)}</text></svg>`,
      font,
    ).innerBBox();
    const sizeValue = bbox ? bbox.width + Math.max(0, bbox.x - 2) + 4 : 0;
    measured.set(key, sizeValue);
    return sizeValue;
  }
  const nodes: string[] = [];
  const boxes: ShareTextBox[] = [];
  function text(value: string, tx: number, y: number, maxWidth: number, size: number, maxLines = 1, color = ink) {
    const lineHeight = Math.ceil(size * 1.25);
    const lines = wrapJobShareText(value, maxWidth - 8, maxLines, (v) => measure(v, size));
    lines.forEach((line, index) => {
      const ty = y + index * lineHeight;
      boxes.push({ text: line, x: tx + 4, y: ty, width: measure(line, size), height: lineHeight });
      nodes.push(`<text x="${tx + 4}" y="${ty + size}" font-size="${size}" fill="${color}">${xml(line)}</text>`);
    });
    return lines.length * lineHeight;
  }
  function panel(y: number, panelHeight: number, color = "#e8efdc") {
    nodes.push(`<rect x="${x}" y="${y}" width="${w}" height="${panelHeight}" fill="${color}"/>`);
  }

  const accent = content.family === "earlyCareer" ? "#f39200" : "#AFCA0B";
  nodes.push(`<rect x="${x}" y="${top}" width="${w}" height="8" fill="${accent}"/>`);
  const logoWidth = landscape ? 156 : 204;
  nodes.push(
    `<image x="${width - config.right - logoWidth}" y="${top + 22}" width="${logoWidth}" height="${landscape ? 55 : 72}" href="data:image/svg+xml;base64,${Buffer.from(brandSvg).toString("base64")}"/>`,
  );
  text(content.type, x, top + 26, w - logoWidth - 28, landscape ? 27 : 32, 2);
  let y = top + (landscape ? 87 : 118);
  if (content.organisation) {
    const logoInset = organisationPng ? (landscape ? 80 : 100) : 0;
    if (organisationPng)
      nodes.push(
        `<image x="${x}" y="${y}" width="${logoInset - 16}" height="${landscape ? 40 : 60}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${organisationPng.toString("base64")}"/>`,
      );
    y +=
      Math.max(
        organisationPng ? (landscape ? 40 : 60) : 0,
        text(content.organisation, x + logoInset, y, w - logoInset, landscape ? 25 : 30, landscape ? 1 : 2, muted),
      ) + (landscape ? 12 : 20);
  }
  const titleSize = landscape ? 52 : format === "feed" ? 78 : 64;
  const titleHeight = text(content.title, x, y, w, titleSize, landscape ? 3 : 4);
  y += titleHeight + (landscape ? 18 : 30);
  const footerHeight = landscape ? 66 : 108;
  const footerTop = bottom - footerHeight;
  const factSize = landscape ? 27 : 34;
  const labelSize = landscape ? 19 : 24;
  const factHeight = landscape ? 100 : 142;
  const periodHeight = landscape ? 0 : 92;

  function facts() {
    const facts = [
      content.hours ? { label: content.hoursLabel, value: content.hours } : null,
      content.pay ? { label: content.payLabel, value: content.pay } : null,
    ].filter((fact) => fact !== null);
    if (!facts.length) return;
    panel(y, factHeight);
    const columnWidth = (w - 40) / facts.length;
    facts.forEach((fact, index) => {
      const fx = x + 16 + columnWidth * index;
      text(fact.label, fx, y + 10, columnWidth - 16, labelSize, 1, muted);
      text(fact.value, fx, y + 18 + labelSize, columnWidth - 16, factSize, landscape ? 1 : 2);
    });
    y += factHeight + (landscape ? 16 : 22);
  }
  function period() {
    if (landscape || !content.period) return;
    text(content.periodLabel, x, y, w, 23, 1, muted);
    text(content.period, x, y + 34, w, 29, 1);
    y += periodHeight;
  }
  const reserve = (content.hours || content.pay ? factHeight + 22 : 0) + (content.period ? periodHeight : 0);
  const excerptLines = Math.min(3, Math.floor((footerTop - y - reserve - 24) / 42));
  function excerpt() {
    if (landscape || excerptLines < 1 || !content.excerpt) return;
    y += text(content.excerpt, x, y, w, 32, excerptLines, muted) + 24;
  }
  if (content.family === "volunteer") excerpt();
  if (content.family === "earlyCareer") period();
  facts();
  if (content.family !== "earlyCareer") period();
  if (content.family !== "volunteer") excerpt();
  nodes.push(
    `<line x1="${x}" y1="${footerTop - 12}" x2="${width - config.right}" y2="${footerTop - 12}" stroke="#a2b7a9" stroke-width="2"/>`,
  );
  text(content.cta, x, footerTop, w, landscape ? 27 : 34, 1);
  const publicUrl = new URL(content.url);
  text(publicUrl.host + publicUrl.pathname, x, footerTop + (landscape ? 36 : 52), w, landscape ? 21 : 26, 1, muted);
  if (
    boxes.some(
      (box) => box.x < x || box.x + box.width > width - config.right || box.y < top || box.y + box.height > bottom,
    )
  )
    throw new Error("Job image content exceeds its safe area");
  // Check content blocks against the anchored footer as well as the outer safe area.
  if (y > footerTop - 12) throw new Error("Job image content overlaps its footer");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f8faee"/><g font-family="Roboto Condensed">${nodes.join("")}</g></svg>`,
    boxes,
    font,
  };
}

export async function renderJobShareImage(
  content: JobShareContent,
  format: JobShareFormat,
  fontFile: string,
  brandSvg: string,
  logo?: Buffer,
) {
  const layout = jobShareSvg(content, format, fontFile, brandSvg, logo);
  return (await renderAsync(layout.svg, layout.font)).asPng();
}
