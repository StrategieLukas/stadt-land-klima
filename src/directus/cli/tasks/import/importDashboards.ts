import {
  createDashboard,
  createPanels,
  deleteDashboards,
  deletePanels,
  readDashboards,
  readPanels,
  updateDashboard,
} from "@directus/sdk";
import path from "path";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { CliClient, Dashboard, Panel, TaskOptions } from "../shared/models.ts";
import { ApiDashboardSchema, DashboardSchema, PanelSchema, relationId, requiredId } from "../shared/models.ts";
import readYamlFiles from "../shared/readYamlFiles.ts";

function getDashboardId(value: unknown) {
  return relationId(value);
}

function mapDashboardsByName(dashboards: Dashboard[]) {
  return new Map(dashboards.map((dashboard) => [dashboard.name, dashboard]));
}

function findDashboardByIdOrName(dashboards: Dashboard[], dashboardId: string | null, dashboardName: string) {
  return (
    dashboards.find((dashboard) => dashboard.id === dashboardId) ??
    dashboards.find((dashboard) => dashboard.name === dashboardName) ??
    null
  );
}

function cleanDashboardForImport(dashboard: Dashboard) {
  const clean = { ...dashboard };

  delete clean.id;
  delete clean.panels;
  delete clean.date_created;
  delete clean.date_updated;
  delete clean.user_created;
  delete clean.user_updated;

  return clean;
}

function cleanPanelForImport(panel: Panel, dashboardId: string) {
  const clean = { ...panel };

  delete clean.id;
  delete clean.date_created;
  delete clean.date_updated;
  delete clean.user_created;
  delete clean.user_updated;
  clean.dashboard = dashboardId;

  return clean;
}

async function replaceDashboardPanels(
  client: CliClient,
  dashboardId: string,
  panels: Panel[],
  existingPanels: Panel[],
  options: TaskOptions,
) {
  const panelsToDelete = existingPanels.filter((panel) => getDashboardId(panel.dashboard) === dashboardId);

  if (panelsToDelete.length) {
    if (options.verbose) {
      console.info(`Deleting ${panelsToDelete.length} existing dashboard panels`);
    }

    const panelIdsToDelete = panelsToDelete.map((panel) => requiredId(panel.id));

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

async function readPersistedDashboard(client: CliClient, dashboardName: string, savedDashboard: unknown) {
  const savedDashboardId = getDashboardId(savedDashboard);
  const dashboards = ApiDashboardSchema.array().parse(await client.request(readDashboards({ limit: -1 })));
  const persistedDashboard = findDashboardByIdOrName(dashboards, savedDashboardId, dashboardName);

  if (!persistedDashboard?.id) {
    throw new Error(`Dashboard "${dashboardName}" was not persisted before importing panels.`);
  }

  return { dashboard: persistedDashboard, dashboards };
}

async function importDashboards(src: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    const dashboards = readYamlFiles(path.join(src), DashboardSchema);
    const existingDashboards = ApiDashboardSchema.array().parse(await client.request(readDashboards({ limit: -1 })));
    const existingPanels = PanelSchema.array().parse(await client.request(readPanels({ limit: -1 })));
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
          updateDashboard(requiredId(existingDashboard.id), cleanDashboardForImport(dashboard)),
        );
      } else {
        if (options.verbose) {
          console.info(`Creating dashboard "${dashboard.name}"`);
        }

        savedDashboard = await client.request(createDashboard(cleanDashboardForImport(dashboard)));
      }

      const persisted = await readPersistedDashboard(client, dashboard.name, savedDashboard);

      savedDashboard = persisted.dashboard;
      currentDashboards = persisted.dashboards;
      currentDashboardsByName = mapDashboardsByName(currentDashboards);

      await replaceDashboardPanels(client, requiredId(savedDashboard.id), panels, currentPanels, options);
      currentPanels = PanelSchema.array().parse(await client.request(readPanels({ limit: -1 })));
    }

    if (options.remove) {
      const dashboardsToDelete = currentDashboards.filter((dashboard) => !importedDashboardNames.has(dashboard.name));

      if (dashboardsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${dashboardsToDelete.length} dashboards`);
        }

        const dashboardIdsToDelete = dashboardsToDelete
          .map((dashboard) => requiredId(dashboard.id))
          .filter((id) => id && id !== "");
        const panelIdsToDelete = currentPanels
          .filter((panel) => dashboardIdsToDelete.includes(getDashboardId(panel.dashboard) ?? ""))
          .map((panel) => requiredId(panel.id))
          .filter((id) => id && id !== "");

        if (panelIdsToDelete.length) {
          await client.request(deletePanels(panelIdsToDelete));
        }

        if (dashboardIdsToDelete.length) {
          await client.request(deleteDashboards(dashboardIdsToDelete));
        }
      }
    }

    if (options.verbose) {
      console.info("Dashboards imported");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default importDashboards;
