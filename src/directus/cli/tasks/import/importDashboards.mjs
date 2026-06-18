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
import clearDirectusCache from '../shared/clearDirectusCache.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

const DASHBOARD_RETRY_ATTEMPTS = 5;
const DASHBOARD_RETRY_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDashboardId(value) {
  if (Array.isArray(value)) {
    return getDashboardId(value[0]);
  }

  return typeof value === 'object' && value !== null ? value.id : value;
}

function mapDashboardsByName(dashboards) {
  return new Map(dashboards.map((dashboard) => [dashboard.name, dashboard]));
}

function findDashboardByIdOrName(dashboards, dashboardId, dashboardName) {
  return dashboards.find((dashboard) => dashboard.id === dashboardId)
    ?? dashboards.find((dashboard) => dashboard.name === dashboardName)
    ?? null;
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

async function readPersistedDashboard(client, dashboardName, savedDashboard, options) {
  const savedDashboardId = getDashboardId(savedDashboard);
  let dashboards = [];

  for (let attempt = 1; attempt <= DASHBOARD_RETRY_ATTEMPTS; attempt++) {
    dashboards = await client.request(readDashboards({ limit: -1 }));
    const persistedDashboard = findDashboardByIdOrName(dashboards, savedDashboardId, dashboardName);

    if (persistedDashboard?.id) {
      return { dashboard: persistedDashboard, dashboards };
    }

    if (attempt < DASHBOARD_RETRY_ATTEMPTS) {
      await clearDirectusCache({ verbose: options.verbose });
      await sleep(DASHBOARD_RETRY_DELAY_MS);
    }
  }

  if (savedDashboardId) {
    console.warn(
      `Dashboard "${dashboardName}" was saved as ${savedDashboardId}, but readDashboards() did not return it after cache retries; using the saved ID for panel import.`
    );

    return {
      dashboard: {
        ...(
          typeof savedDashboard === 'object' && savedDashboard !== null && !Array.isArray(savedDashboard)
            ? savedDashboard
            : {}
        ),
        id: savedDashboardId,
        name: dashboardName,
      },
      dashboards,
    };
  }

  throw new Error(`Dashboard "${dashboardName}" was not persisted before importing panels.`);
}

async function importDashboards(src, options = { verbose: false, overwrite: false, remove: false }) {
  const client = createDirectusClient();

  try {
    const dashboards = readYamlFiles(path.join(src));
    const existingDashboards = await client.request(readDashboards({ limit: -1 }));
    const existingPanels = await client.request(readPanels({ limit: -1 }));
    let currentDashboards = existingDashboards;
    let currentDashboardsByName = mapDashboardsByName(currentDashboards);
    let currentPanels = existingPanels;
    const importedDashboardNames = new Set(dashboards.map((dashboard) => dashboard.name));

    for (const dashboard of dashboards) {
      const panels = dashboard.panels ?? [];
      const existingDashboard = currentDashboardsByName.get(dashboard.name);
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

      const persisted = await readPersistedDashboard(client, dashboard.name, savedDashboard, options);

      savedDashboard = persisted.dashboard;
      currentDashboards = persisted.dashboards;
      currentDashboardsByName = mapDashboardsByName(currentDashboards);

      await replaceDashboardPanels(client, savedDashboard.id, panels, currentPanels, options);
      currentPanels = await client.request(readPanels({ limit: -1 }));
    }

    if (options.remove) {
      const dashboardsToDelete = currentDashboards.filter((dashboard) => !importedDashboardNames.has(dashboard.name));

      if (dashboardsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${dashboardsToDelete.length} dashboards`);
        }

        const dashboardIdsToDelete = dashboardsToDelete
          .map((dashboard) => dashboard.id)
          .filter((id) => id && id !== '');
        const panelIdsToDelete = currentPanels
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
