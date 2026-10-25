import fs from "fs";
import path from "path";
import clearDir from "../shared/clearDir.ts";
import clearDirectusCache from "../shared/clearDirectusCache.ts";
import type { CliArguments, TaskOptions } from "../shared/models.ts";
import { requiredId } from "../shared/models.ts";
import clearSchema from "./clearSchema.ts";
import exportCollectionItems from "./exportCollectionItems.ts";
import exportDashboards from "./exportDashboards.ts";
import exportFlows from "./exportFlows.ts";
import exportPolicies from "./exportPolicies.ts";
import exportPresets from "./exportPresets.ts";
import exportRoles from "./exportRoles.ts";
import exportSchema from "./exportSchema.ts";
import exportSettings from "./exportSettings.ts";
import exportTranslations from "./exportTranslations.ts";

const clerDirOpts = { extensions: [".yaml"] };

async function clear(dest: string, options: TaskOptions = {}) {
  try {
    clearDir(dest, clerDirOpts);

    if (options.verbose) {
      console.info(`${dest} cleared`);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function exportTasks(yargs: CliArguments) {
  return yargs
    .command(
      "export:schema [dest]",
      'export the schema to the folder specified by "dest". By default it will export into "schema"',
      (yargs) => {
        return yargs.positional("dest", {
          describe: "destination folder",
          default: "schema",
        });
      },
      async (argv) => {
        if (argv.verbose) {
          console.info(`Exporting schema to ${argv.dest}`);
        }
        if (argv.clear) {
          await clearSchema(argv.dest, {
            verbose: argv.verbose,
          });
        }

        await clearDirectusCache();
        await exportSchema(argv.dest, {
          verbose: argv.verbose,
          remove: argv.clear,
        });
      },
    )

    .command(
      "export:policies [dest]",
      'export all policies to the folder specified by "dest". By default it will export into "policies". Always clears the directory first.',
      (yargs) => {
        return yargs.positional("dest", {
          describe: "destination folder",
          default: "policies",
        });
      },
      async (argv) => {
        const dest = argv.dest;

        if (argv.verbose) {
          console.info(`Exporting policies to ${dest}`);
        }

        await clearDirectusCache();

        // Clear the directory before export (deletes all yaml files)
        if (fs.existsSync(dest)) {
          clearDir(dest, { extensions: [".yaml"] });
        } else {
          fs.mkdirSync(dest, { recursive: true });
        }

        if (argv.verbose) {
          console.info(`${dest} cleared`);
        }

        await exportPolicies(dest, {
          verbose: argv.verbose,
          overwrite: true,
        });
      },
    )

    .command(
      "export:roles [dest]",
      'export all roles to the folder specified by "dest". By default it will export into "roles"',
      (yargs) => {
        return yargs.positional("dest", {
          describe: "destination folder",
          default: "roles",
        });
      },
      async (argv) => {
        if (argv.verbose) {
          console.info(`Exporting roles to ${argv.dest}`);
        }
        if (argv.clear) {
          await clear(argv.dest, {
            verbose: argv.verbose,
          });
        }

        await clearDirectusCache();
        await exportRoles(argv.dest, {
          verbose: argv.verbose,
          overwrite: argv.force,
        });
      },
    )

    .command(
      "export:presets [dest]",
      'export all presets to the folder specified by "dest". By default it will export into "presets"',
      (yargs) => {
        return yargs.positional("dest", {
          describe: "destination folder",
          default: "presets",
        });
      },
      async (argv) => {
        if (argv.verbose) {
          console.info(`Exporting presets to ${argv.dest}`);
        }
        if (argv.clear) {
          await clear(argv.dest, {
            verbose: argv.verbose,
          });
        }

        await clearDirectusCache();
        await exportPresets(argv.dest, {
          verbose: argv.verbose,
          overwrite: argv.force,
        });
      },
    )

    .command(
      "export:flows [dest]",
      'export all flows to the folder specified by "dest". By default it will export into "flows"',
      (yargs) => {
        return yargs.positional("dest", {
          describe: "destination folder",
          default: "flows",
        });
      },
      async (argv) => {
        if (argv.verbose) {
          console.info(`Exporting flows to ${argv.dest}`);
        }
        if (argv.clear) {
          await clear(argv.dest, {
            verbose: argv.verbose,
          });
        }

        await clearDirectusCache();
        await exportFlows(argv.dest, {
          verbose: argv.verbose,
          overwrite: argv.force,
        });
      },
    )

    .command(
      "export:translations [dest]",
      'export all translations to the folder specified by "dest". By default it will export into "translations"',
      (yargs) => {
        return yargs.positional("dest", {
          describe: "destination folder",
          default: "translations",
        });
      },
      async (argv) => {
        if (argv.verbose) {
          console.info(`Exporting translations to ${argv.dest}`);
        }
        if (argv.clear) {
          await clear(argv.dest, {
            verbose: argv.verbose,
          });
        }

        await clearDirectusCache();
        await exportTranslations(argv.dest, {
          verbose: argv.verbose,
          overwrite: argv.force,
        });
      },
    )

    .command(
      "export:settings [dest]",
      'export all settings to the folder specified by "dest". By default it will export into "settings"',
      (yargs) => {
        return yargs.positional("dest", {
          describe: "destination folder",
          default: "settings",
        });
      },
      async (argv) => {
        if (argv.verbose) {
          console.info(`Exporting settings to ${argv.dest}`);
        }
        if (argv.clear) {
          await clear(argv.dest, {
            verbose: argv.verbose,
          });
        }

        await clearDirectusCache();
        await exportSettings(argv.dest, {
          verbose: argv.verbose,
          overwrite: argv.force,
        });
      },
    )

    .command(
      "export:dashboards [dest]",
      'export all dashboards to the folder specified by "dest". By default it will export into "dashboards"',
      (yargs) => {
        return yargs.positional("dest", {
          describe: "destination folder",
          default: "dashboards",
        });
      },
      async (argv) => {
        if (argv.verbose) {
          console.info(`Exporting dashboards to ${argv.dest}`);
        }
        if (argv.clear) {
          await clear(argv.dest, {
            verbose: argv.verbose,
          });
        }

        await clearDirectusCache();
        await exportDashboards(argv.dest, {
          verbose: argv.verbose,
          overwrite: argv.force,
        });
      },
    )

    .command(
      "export:all [dest]",
      "export schema, policies, roles, flows, presets, translations, settings, and dashboards consecutively. " +
        "In v11+, policies are exported separately from roles.",
      (yargs) => {
        return yargs.positional("dest", {
          describe: "base destination folder (default: current directory)",
          default: ".",
        });
      },
      async (argv) => {
        const startTime = Date.now();
        const dest = argv.dest;

        console.info("Starting full export...");

        // Clear cache once at the beginning
        console.info("Clearing cache...");
        await clearDirectusCache();

        // Export schema
        console.info("Exporting schema...");
        if (argv.clear) {
          await clearSchema(path.join(dest, "schema"), {
            verbose: argv.verbose,
          });
        }
        await exportSchema(path.join(dest, "schema"), {
          verbose: argv.verbose,
          remove: argv.clear,
        });

        // Export policies (separate from roles in v11+)
        console.info("Exporting policies...");
        if (argv.clear) {
          await clear(path.join(dest, "policies"), { verbose: argv.verbose });
        }
        await exportPolicies(path.join(dest, "policies"), {
          verbose: argv.verbose,
          overwrite: argv.force,
        });

        // Export roles
        console.info("Exporting roles...");
        if (argv.clear) {
          await clear(path.join(dest, "roles"), { verbose: argv.verbose });
        }
        await exportRoles(path.join(dest, "roles"), {
          verbose: argv.verbose,
          overwrite: argv.force,
        });

        // Export flows
        console.info("Exporting flows...");
        if (argv.clear) {
          await clear(path.join(dest, "flows"), { verbose: argv.verbose });
        }
        await exportFlows(path.join(dest, "flows"), {
          verbose: argv.verbose,
          overwrite: argv.force,
        });

        // Export presets
        console.info("Exporting presets...");
        if (argv.clear) {
          await clear(path.join(dest, "presets"), { verbose: argv.verbose });
        }
        await exportPresets(path.join(dest, "presets"), {
          verbose: argv.verbose,
          overwrite: argv.force,
        });

        // Export translations
        console.info("Exporting translations...");
        if (argv.clear) {
          await clear(path.join(dest, "translations"), {
            verbose: argv.verbose,
          });
        }
        await exportTranslations(path.join(dest, "translations"), {
          verbose: argv.verbose,
          overwrite: argv.force,
        });

        // Export settings
        console.info("Exporting settings...");
        if (argv.clear) {
          await clear(path.join(dest, "settings"), { verbose: argv.verbose });
        }
        await exportSettings(path.join(dest, "settings"), {
          verbose: argv.verbose,
          overwrite: argv.force,
        });

        // Export dashboards
        console.info("Exporting dashboards...");
        if (argv.clear) {
          await clear(path.join(dest, "dashboards"), { verbose: argv.verbose });
        }
        await exportDashboards(path.join(dest, "dashboards"), {
          verbose: argv.verbose,
          overwrite: argv.force,
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.info(`Full export completed in ${elapsed}s`);
      },
    )

    .command(
      "export:items [collection] [dest]",
      'export all items of a collection to the folder specified by "dest". By default it will export into "contents"',
      (yargs) => {
        return yargs
          .positional("collection", {
            type: "string",
            describe: "collection to export",
            required: true,
          })
          .positional("dest", {
            describe: "destination folder",
            default: "contents",
          });
      },
      async (argv) => {
        if (argv.verbose) {
          console.info(`Exporting ${argv.collection} items to ${argv.dest}`);
        }

        await clearDirectusCache();
        await exportCollectionItems(requiredId(argv.collection), argv.dest, {
          verbose: argv.verbose,
          overwrite: argv.force,
        });
      },
    )

    .option("clear", {
      alias: "c",
      type: "boolean",
      description: "Clear existing files",
    })
    .option("force", {
      alias: "f",
      type: "boolean",
      description: "Overwrite existing files",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Run with verbose logging",
    });
}

export default exportTasks;
