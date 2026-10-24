import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createDirectus,
  customEndpoint,
  readFiles,
  readItems,
  rest,
  staticToken,
  updateItem,
  uploadFiles,
} from "@directus/sdk";
import { TOUR_MEDIA_FOLDER } from "./migrateSuccessProjectTours.js";

const seriesSlug = "erfolgsprojekte-tour-ost-2026";
const fixtureCredit = "Stadt.Land.Klima! – synthetisches Testmedium, keine Aufnahme des Besuchs";
const assets = [
  ["landscape.png", "image/png"],
  ["portrait.png", "image/png"],
  ["garden.png", "image/png"],
  ["video.webm", "video/webm"],
] as const;

type Stop = { id: string; location: string; sort: number; start_date: string };

async function main(): Promise<void> {
  if (process.env.SLK_ENV !== "development") {
    throw new Error("Tour demo content can only be seeded with SLK_ENV=development.");
  }
  const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;
  if (!token) throw new Error("A working CLI_DIRECTUS_STATIC_TOKEN is required.");
  const client = createDirectus("http://127.0.0.1:8055").with(staticToken(token)).with(rest());
  const series = await client.request(
    readItems("success_project_tours", {
      filter: { slug: { _eq: seriesSlug } },
      fields: ["id"],
      limit: 1,
    }),
  );
  if (!series.length) throw new Error("Import the Tour Ost 2026 fixture before seeding demo content.");
  const stops = (await client.request(
    readItems("success_project_tour_stops", {
      filter: { tour: { id: { _eq: series[0].id } } },
      fields: ["id", "location", "sort", "start_date"],
      sort: ["sort"],
      limit: -1,
    }),
  )) as Stop[];
  const reported = await client.request(
    readItems("success_project_tour_stops", {
      filter: { tour: { id: { _eq: series[0].id } } },
      fields: [
        "id",
        "report_status",
        "report_title",
        "teaser",
        "author",
        "date_published",
        "image",
        "image_credits",
        { media: ["id"] },
      ],
      limit: -1,
    }),
  );
  const [blocks, drafts] = await Promise.all([
    client.request(
      readItems("blocks", {
        filter: {
          entity_type: { _eq: "success_project_tour_stops" },
          entity_uuid: { _in: stops.map((stop) => stop.id) },
          status: { _neq: "archived" },
        },
        fields: ["entity_uuid"],
        limit: -1,
      }),
    ),
    client.request(
      readItems("edit_states", {
        filter: {
          entity_type: { _eq: "success_project_tour_stops" },
          entity_uuid: { _in: stops.map((stop) => stop.id) },
        },
        fields: ["entity_uuid"],
        limit: -1,
      }),
    ),
  ]);
  const existingStops = new Set([
    ...reported
      .filter(
        (stop) =>
          stop.report_status !== "draft" ||
          stop.report_title ||
          stop.teaser ||
          stop.author ||
          stop.date_published ||
          stop.image ||
          stop.image_credits ||
          stop.media?.length,
      )
      .map((stop) => stop.id),
    ...blocks.map((block) => block.entity_uuid),
    ...drafts.map((draft) => draft.entity_uuid),
  ]);
  const missing = stops.filter((stop) => !existingStops.has(stop.id));
  if (!missing.length) {
    console.info("[tour demo] All stops already have reports; nothing changed.");
    return;
  }

  const fileIds: string[] = [];
  for (const [filename, mime] of assets) {
    console.info(`[tour demo] Preparing ${filename}.`);
    const downloadName = `slk-dev-tour-${filename}`;
    const existing = await client.request(
      readFiles({
        filter: { filename_download: { _eq: downloadName }, description: { _eq: fixtureCredit } },
        fields: ["id"],
        limit: 1,
      }),
    );
    if (existing.length) {
      fileIds.push(existing[0].id);
      continue;
    }
    const bytes = await readFile(new URL(`../migrations/fixtures/dev-tour/${filename}`, import.meta.url));
    const form = new FormData();
    form.append("folder", TOUR_MEDIA_FOLDER);
    form.append("title", `[DEV TEST] Tour ${filename}`);
    form.append("description", fixtureCredit);
    form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), downloadName);
    const uploaded = await client.request(uploadFiles(form));
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    fileIds.push(file.id);
  }
  const [landscape, portrait, garden, video] = fileIds;

  for (const stop of missing) {
    const title = `[DEV TEST] Bericht aus ${stop.location}`;
    const locationHtml = stop.location.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
    const media = [
      {
        file: landscape,
        alt: "Synthetisches Testbild im Querformat: Straße mit Solardächern",
        caption: "[DEV TEST] Querformat – Solardächer und Mobilität",
      },
      {
        file: video,
        poster: stop.sort % 2 ? landscape : null,
        alt: "Synthetischer Testclip mit bewegten Farbfeldern",
        caption: "[DEV TEST] Fünf Sekunden Video – Wiedergabe und Pause testen",
      },
      {
        file: portrait,
        alt: "Synthetisches Testbild im Hochformat: Radverkehr und Stadtgrün",
        caption: "[DEV TEST] Hochformat – Radverkehr und Stadtgrün",
      },
      {
        file: garden,
        alt: "Synthetisches Testbild im Querformat: Stadtgarten",
        caption: "[DEV TEST] Weiteres Querformat – Stadtgarten",
      },
    ];
    // Exercise portrait cropping and video previews (with and without posters).
    if (stop.sort % 3 === 0) media.unshift(...media.splice(1, 1));
    else if (stop.sort % 2 === 0) media.unshift(...media.splice(2, 1));

    const report = await client.request(
      updateItem("success_project_tour_stops", stop.id, {
        report_status: "draft",
        report_title: title,
        author: "Stadt.Land.Klima! – Entwicklungstest",
        teaser: `Testbericht für ${stop.location}: So wirken Text, Bilder und Videos auf der Tourkarte. Alle Inhalte sind frei erfundene Entwicklungsdaten.`,
        date_published: stop.start_date,
        image: landscape,
        image_credits: fixtureCredit,
        media: media.map((entry, index) => ({ ...entry, sort: index + 1, credit: fixtureCredit })),
      }),
    );
    try {
      const scope = { entity_type: "success_project_tour_stops", entity_uuid: report.id, field_name: "content" };
      const state = await client.request(
        customEndpoint<{ revision: string }>({
          path: "/blokkli-persistence/state",
          method: "GET",
          params: scope,
        }),
      );
      await client.request(
        customEndpoint({
          path: "/blokkli-persistence/publish",
          method: "POST",
          body: JSON.stringify({
            ...scope,
            baseRevision: state.revision,
            blocks: [
              {
                uuid: randomUUID(),
                bundle: "text",
                options: {},
                props: {
                  content: `<h2>Testbericht: ${locationHtml}</h2><p><strong>Dies ist ein frei erfundener Bericht für die lokale Entwicklungsumgebung.</strong> Er beschreibt keinen tatsächlichen Besuch.</p><p>In diesem Beispiel beschäftigen wir uns mit Solardächern, sicheren Radwegen und mehr Stadtgrün. Der längere Text hilft dir dabei, die Lesbarkeit und die Abstände auf der Detailseite zu prüfen.</p><h3>Bilder und Video ausprobieren</h3><p>Die Galerie enthält vier synthetische Testmedien mit unterschiedlichen Seitenverhältnissen. Öffne ein Vorschaubild, wechsle mit den Pfeiltasten zwischen den Medien und starte das Video. Prüfe anschließend, ob die Wiedergabe beim Wechseln oder Schließen stoppt.</p>`,
                },
              },
            ],
          }),
        }),
      );
      // Keep incomplete content private and publish only after the blocks exist.
      await client.request(updateItem("success_project_tour_stops", report.id, { report_status: "published" }));
    } catch (error) {
      // Retain the itinerary and incomplete draft for recovery on the same stop.
      console.warn(`[tour demo] Incomplete stop report ${report.id} remains private for inspection.`);
      throw error;
    }
    console.info(`[tour demo] Created report and four media entries for ${stop.location}.`);
  }
  console.info(`[tour demo] Created ${missing.length} reports; skipped ${existingStops.size} existing reports.`);
}

void main().catch((error) => {
  const messages = Array.isArray(error?.errors)
    ? error.errors.map((entry: { message: string }) => entry.message).join("; ")
    : error?.errors?.message || error?.errors?.error;
  console.error("[tour demo]", error?.message || messages || "Seeding failed.");
  process.exitCode = 1;
});
