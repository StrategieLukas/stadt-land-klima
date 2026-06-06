import fse from 'fse';
import fs from 'fs';
import path from 'path';
import { stringify } from 'yaml';
import { readDashboards, readPanels } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

function cleanDashboard(dashboard) {
  const clean = { ...dashboard };

  delete clean.id;
  delete clean.date_created;
  delete clean.date_updated;
  delete clean.user_created;
  delete clean.user_updated;

  return clean;
}

function cleanPanel(panel) {
  const clean = { ...panel };

  delete clean.id;
  delete clean.dashboard;
  delete clean.date_created;
  delete clean.date_updated;
  delete clean.user_created;
  delete clean.user_updated;

  return clean;
}

function getDashboardId(value) {
  return typeof value === 'object' && value !== null ? value.id : value;
}

function sortPanels(a, b) {
  return (
    (a.position_y ?? 0) - (b.position_y ?? 0) ||
    (a.position_x ?? 0) - (b.position_x ?? 0) ||
    String(a.name ?? '').localeCompare(String(b.name ?? ''))
  );
}

async function exportDashboards(dest, options = { verbose: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const dashboards = await client.request(readDashboards({ limit: -1 }));
    const panels = await client.request(readPanels({ limit: -1 }));

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
        const destPath = path.join(dest, slugify(dashboard.name, { replacement: '_', lower: false }) + '.yaml');

        if (!options.overwrite && fse.existsSync(destPath)) {
          if (options.verbose) {
            console.info(`File ${destPath} already exists.`);
          }
          return;
        }

        fse.writeFileSync(destPath, stringify(dashboardData), { encoding: 'utf8' });

        if (options.verbose) {
          console.info(`Exported dashboard ${destPath}`);
        }
      });

    if (options.verbose) {
      console.info(`Exported ${dashboards.length} dashboards.`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportDashboards;
