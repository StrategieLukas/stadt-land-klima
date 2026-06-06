import path from "path";
import os from "os";
import fs from "fs";
import csvjson from "csvjson";
import type { Accountability, Database, Schema, Services } from "@directus/types";

interface RatingMeasure {
  id?: number;
  status?: string;
  rating?: number;
  applicable?: boolean;
  approved?: boolean;
  choices?: any;
  current_progress?: number;
  date_created?: string;
  date_updated?: string;
  measure_published?: any;
  source?: string;
  localteam_id?: {
    municipality_id?: {
      name?: string;
    };
  };
  measure_id?: {
    catalog_version?: {
      name?: string;
      id?: number;
    };
    date_updated?: string;
    measure_id?: number;
    must_be_rated_again?: boolean;
    name?: string;
  };
}

interface RatingMeasureRow {
  id: number | null;
  status: string | null;
  rating: number | null;
  applicable: boolean | null;
  approved: boolean | null;
  choices: any | null;
  current_progress: number | null;
  date_created: string | null;
  date_updated: string | null;
  measure_published: any | null;
  source: string | null;
  municipality: string | null;
  catalog_version_name: string | null;
  catalog_version_id: number | null;
  measure_date_updated: string | null;
  measure_id: number | null;
  must_be_rated_again: boolean | null;
  measure_name: string | null;
}

interface HookContext {
  schedule: (cron: string, handler: () => Promise<void>) => void;
}

interface HookServices {
  services: Services;
  database: Database;
  getSchema: () => Promise<Schema>;
}

const REPORT_EMAIL = process.env.REPORT_RECIPIENT_EMAIL ?? "massnahmen@stadt-land-klima.de";
const CRON_PERIOD = process.env.REPORT_CRON ?? "0 0 * * 0"; // Every Sunday at midnight

function formatTimestamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mapToRow(raw: RatingMeasure): RatingMeasureRow {
  return {
    id:                   raw?.id                                        ?? null,
    status:               raw?.status                                    ?? null,
    rating:               raw?.rating                                    ?? null,
    applicable:           raw?.applicable                                ?? null,
    approved:             raw?.approved                                  ?? null,
    choices:              raw?.choices                                   ?? null,
    current_progress:     raw?.current_progress                          ?? null,
    date_created:         raw?.date_created                              ?? null,
    date_updated:         raw?.date_updated                              ?? null,
    measure_published:    raw?.measure_published                         ?? null,
    source:               raw?.source                                    ?? null,
    municipality:         raw?.localteam_id?.municipality_id?.name       ?? null,
    catalog_version_name: raw?.measure_id?.catalog_version?.name         ?? null,
    catalog_version_id:   raw?.measure_id?.catalog_version?.id           ?? null,
    measure_date_updated: raw?.measure_id?.date_updated                  ?? null,
    measure_id:           raw?.measure_id?.measure_id                    ?? null,
    must_be_rated_again:  raw?.measure_id?.must_be_rated_again           ?? null,
    measure_name:         raw?.measure_id?.name                          ?? null,
  };
}

export default ({ schedule }: HookContext, { services, database, getSchema }: HookServices) => {
  const { MailService, ItemsService } = services;

  schedule(CRON_PERIOD, async () => {
    let filePath: string | null = null;

    try {
      const schema = await getSchema();

      const itemsService = new ItemsService("ratings_measures", { database, schema });

      const results = await itemsService.readByQuery({
        limit: -1,
        fields: [
          "id", "status", "rating", "applicable", "approved",
          "choices", "current_progress", "date_created", "date_updated",
          "measure_published", "source",
          "localteam_id.municipality_id.name",
          "measure_id.catalog_version.name",
          "measure_id.catalog_version.id",
          "measure_id.date_updated",
          "measure_id.measure_id",
          "measure_id.must_be_rated_again",
          "measure_id.name",
        ],
      }) as RatingMeasure[];

      if (!results || results.length === 0) {
        console.warn("[rating report] No data returned, skipping report.");
        return;
      }

      const rows = results.map(mapToRow);

      const csv = csvjson.toCSV(rows, { delimiter: ",", wrap: true });

      const fileName = `rating_measures-${formatTimestamp(new Date())}.csv`;
      filePath = path.join(os.tmpdir(), fileName);
      fs.writeFileSync(filePath, csv, { encoding: "utf-8" });

      const mailService = new MailService({ schema });

      await mailService.send({
        to: REPORT_EMAIL,
        subject: "Stadt.Land.Klima Wochenbericht",
        text: "Attached is the weekly rating measures report (CSV).",
        attachments: [{ filename: fileName, path: filePath }],
      });

      console.log(`[rating report] Report sent successfully to ${REPORT_EMAIL}`);

    } catch (err) {
      console.error("[rating report] Cron job failed:", err);

      try {
        const schema = await getSchema();
        const mailService = new MailService({ schema });
        await mailService.send({
          to: REPORT_EMAIL,
          subject: "Stadt.Land.Klima Wochenbericht – FEHLER",
          text: `The weekly rating report failed to generate or send.\n\nError: ${err instanceof Error ? err.message : String(err)}`,
        });
      } catch (mailErr) {
        console.error("[rating report] Failed to send error notification:", mailErr);
      }

    } finally {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupErr) {
          console.error("[rating report] Failed to clean up temp file:", cleanupErr);
        }
      }
    }
  });
};
