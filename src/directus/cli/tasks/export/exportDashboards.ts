import { readDashboards, readPanels } from '@directus/sdk';
import fs from 'fs';
import fse from 'node:fs';
import path from 'path';
import slugify from 'slugify';
import { stringify } from 'yaml';
import createDirectusClient from '../shared/createDirectusClient.ts';
import type { Dashboard, Panel, TaskOptions } from '../shared/models.ts';
import {
  ApiDashboardSchema,
  PanelSchema,
  relationId,
} from '../shared/models.ts';

function cleanDashboard(dashboard: Dashboard) {
  const clean = { ...dashboard };

  delete clean.id;
  delete clean.date_created;
  delete clean.date_updated;
  delete clean.user_created;
  delete clean.user_updated;

  return clean;
}

function cleanPanel(panel: Panel) {
  const clean = { ...panel };

  delete clean.id;
  delete clean.dashboard;
  delete clean.date_created;
  delete clean.date_updated;
  delete clean.user_created;
  delete clean.user_updated;

  return clean;
}

function getDashboardId(value: unknown) {
  return relationId(value);
}

function sortPanels(a: Panel, b: Panel) {
  return (
    (a.position_y ?? 0) - (b.position_y ?? 0) ||
    (a.position_x ?? 0) - (b.position_x ?? 0) ||
    String(a.name ?? '').localeCompare(String(b.name ?? ''))
  );
}

async function exportDashboards(dest: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    const dashboards = ApiDashboardSchema.array().parse(
      await client.request(readDashboards({ limit: -1 })),
    );
    const panels = PanelSchema.array().parse(
      await client.request(readPanels({ limit: -1 })),
    );

    fs.mkdirSync(dest, { recursive: true });

    dashboards
      .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
      .forEach((dashboard) => {
        const dashboardPanels = panels
          .filter((panel) => getDashboardId(panel.dashboard) === dashboard.id)
          .map(cleanPanel)
          .sort(sortPanels);
        const dashboardData = {
          ...cleanDashboard(dashboard),
          panels: dashboardPanels,
        };
        const destPath = path.join(
          dest,
          slugify(dashboard.name, { replacement: '_', lower: false }) + '.yaml',
        );

        if (!options.overwrite && fse.existsSync(destPath)) {
          if (options.verbose) {
            console.info(`File ${destPath} already exists.`);
          }
          return;
        }

        fse.writeFileSync(destPath, stringify(dashboardData), {
          encoding: 'utf8',
        });

        if (options.verbose) {
          console.info(`Exported dashboard ${destPath}`);
        }
      });

    if (options.verbose) {
      console.info(`Exported ${dashboards.length} dashboards.`);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default exportDashboards;
