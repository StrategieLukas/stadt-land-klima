import path from 'path';
import {
  createDashboard,
  createPanels,
  deleteDashboards,
  deletePanels,
  readDashboards,
  readPanels,
  updateDashboard,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

function getDashboardId(value) {
  return typeof value === 'object' && value !== null ? value.id : value;
}

function cleanDashboardForImport(dashboard) {
  const clean = { ...dashboard };

  delete clean.id;
  delete clean.panels;
  delete clean.date_created;
  delete clean.date_updated;
  delete clean.user_created;
  delete clean.user_updated;

  return clean;
}

function cleanPanelForImport(panel, dashboardId) {
  const clean = { ...panel };

  delete clean.id;
  delete clean.date_created;
  delete clean.date_updated;
  delete clean.user_created;
  delete clean.user_updated;
  clean.dashboard = dashboardId;

  return clean;
}

async function replaceDashboardPanels(client, dashboardId, panels, existingPanels, options) {
  const panelsToDelete = existingPanels.filter((panel) => getDashboardId(panel.dashboard) === dashboardId);

  if (panelsToDelete.length) {
    if (options.verbose) {
      console.info(`Deleting ${panelsToDelete.length} existing dashboard panels`);
    }

    const panelIdsToDelete = panelsToDelete.map((panel) => panel.id).filter((id) => id && id !== '');

    if (panelIdsToDelete.length) {
      await client.request(deletePanels(panelIdsToDelete));
    }
  }

  if (!panels.length) {
    return;
  }

  if (options.verbose) {
    console.info(`Creating ${panels.length} dashboard panels`);
  }

  await client.request(createPanels(panels.map((panel) => cleanPanelForImport(panel, dashboardId))));
}

async function importDashboards(src, options = { verbose: false, overwrite: false, remove: false }) {
  const client = createDirectusClient();

  try {
    const dashboards = readYamlFiles(path.join(src));
    const existingDashboards = await client.request(readDashboards({ limit: -1 }));
    const existingPanels = await client.request(readPanels({ limit: -1 }));
    const existingDashboardsByName = new Map(existingDashboards.map((dashboard) => [dashboard.name, dashboard]));
    const importedDashboardNames = new Set(dashboards.map((dashboard) => dashboard.name));

    for (const dashboard of dashboards) {
      const panels = dashboard.panels ?? [];
      const existingDashboard = existingDashboardsByName.get(dashboard.name);
      let savedDashboard = existingDashboard;

      if (existingDashboard) {
        if (!options.overwrite) {
          if (options.verbose) {
            console.info(`Dashboard "${dashboard.name}" already exists. Skipping.`);
          }
          continue;
        }

        if (options.verbose) {
          console.info(`Updating dashboard "${dashboard.name}"`);
        }

        savedDashboard = await client.request(
          updateDashboard(existingDashboard.id, cleanDashboardForImport(dashboard))
        );
      } else {
        if (options.verbose) {
          console.info(`Creating dashboard "${dashboard.name}"`);
        }

        savedDashboard = await client.request(createDashboard(cleanDashboardForImport(dashboard)));
      }

      await replaceDashboardPanels(client, savedDashboard.id, panels, existingPanels, options);
    }

    if (options.remove) {
      const dashboardsToDelete = existingDashboards.filter((dashboard) => !importedDashboardNames.has(dashboard.name));

      if (dashboardsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${dashboardsToDelete.length} dashboards`);
        }

        const dashboardIdsToDelete = dashboardsToDelete
          .map((dashboard) => dashboard.id)
          .filter((id) => id && id !== '');
        const panelIdsToDelete = existingPanels
          .filter((panel) => dashboardIdsToDelete.includes(getDashboardId(panel.dashboard)))
          .map((panel) => panel.id)
          .filter((id) => id && id !== '');

        if (panelIdsToDelete.length) {
          await client.request(deletePanels(panelIdsToDelete));
        }

        if (dashboardIdsToDelete.length) {
          await client.request(deleteDashboards(dashboardIdsToDelete));
        }
      }
    }

    if (options.verbose) {
      console.info('Dashboards imported');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importDashboards;
