import clearDir from '../shared/clearDir.mjs';
import exportSchema from './exportSchema.mjs';
import clearSchema from './clearSchema.mjs';
import exportRoles from './exportRoles.mjs';
import exportPresets from './exportPresets.mjs';
import exportWebhooks from './exportWebhooks.mjs';
import exportFlows from './exportFlows.mjs';
import exportTranslations from './exportTranslations.mjs';
import exportSettings from './exportSettings.mjs';

async function clear(dest, options = {verbose: false}) {
  try {
    clearDir(dest);

    if (options.verbose) {
      console.info(`${dest} cleared`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

function exportTasks(yargs) {
  return yargs
  .command(
    'export:schema [dest]',
    'export the schema to the folder specified by "dest". By default it will export into "schema"',
    (yargs) => {
      return yargs
      .positional('dest', {
        describe: 'destination folder',
        default: 'schema',
      });
    },
    (argv) => {
      if (argv.verbose) {
        console.info(`Exporting schema to ${argv.dest}`);
      }
      if (argv.clear) {
        clearSchema(argv.dest, {
          verbose: argv.verbose,
        });
      }

      exportSchema(argv.dest, {
        verbose: argv.verbose,
        overwrite: argv.force,
      });
    }
  )

  .command(
    'export:roles [dest]',
    'export all roles to the folder specified by "dest". By default it will export into "roles"',
    (yargs) => {
      return yargs
      .positional('dest', {
        describe: 'destination folder',
        default: 'roles',
      });
    },
    (argv) => {
      if (argv.verbose) {
        console.info(`Exporting roles to ${argv.dest}`);
      }
      if (argv.clear) {
        clear(argv.dest, {
          verbose: argv.verbose,
        });
      }

      exportRoles(argv.dest, {
        verbose: argv.verbose,
        overwrite: argv.force,
      });
    }
  )

  .command(
    'export:presets [dest]',
    'export all presets to the folder specified by "dest". By default it will export into "presets"',
    (yargs) => {
      return yargs
      .positional('dest', {
        describe: 'destination folder',
        default: 'presets',
      });
    },
    (argv) => {
      if (argv.verbose) {
        console.info(`Exporting presets to ${argv.dest}`);
      }
      if (argv.clear) {
        clear(argv.dest, {
          verbose: argv.verbose,
        });
      }

      exportPresets(argv.dest, {
        verbose: argv.verbose,
        overwrite: argv.force,
      });
    }
  )

  .command(
    'export:webhooks [dest]',
    'export all webhooks to the folder specified by "dest". By default it will export into "webhooks"',
    (yargs) => {
      return yargs
      .positional('dest', {
        describe: 'destination folder',
        default: 'webhooks',
      });
    },
    (argv) => {
      if (argv.verbose) {
        console.info(`Exporting webhooks to ${argv.dest}`);
      }
      if (argv.clear) {
        clear(argv.dest, {
          verbose: argv.verbose,
        });
      }

      exportWebhooks(argv.dest, {
        verbose: argv.verbose,
        overwrite: argv.force,
      });
    }
  )

  .command(
    'export:flows [dest]',
    'export all flows to the folder specified by "dest". By default it will export into "flows"',
    (yargs) => {
      return yargs
      .positional('dest', {
        describe: 'destination folder',
        default: 'flows',
      });
    },
    (argv) => {
      if (argv.verbose) {
        console.info(`Exporting flows to ${argv.dest}`);
      }
      if (argv.clear) {
        clear(argv.dest, {
          verbose: argv.verbose,
        });
      }

      exportFlows(argv.dest, {
        verbose: argv.verbose,
        overwrite: argv.force,
      });
    }
  )

  .command(
    'export:translations [dest]',
    'export all translations to the folder specified by "dest". By default it will export into "translations"',
    (yargs) => {
      return yargs
      .positional('dest', {
        describe: 'destination folder',
        default: 'translations',
      });
    },
    (argv) => {
      if (argv.verbose) {
        console.info(`Exporting translations to ${argv.dest}`);
      }
      if (argv.clear) {
        clear(argv.dest, {
          verbose: argv.verbose,
        });
      }

      exportTranslations(argv.dest, {
        verbose: argv.verbose,
        overwrite: argv.force,
      });
    }
  )

  .command(
    'export:settings [dest]',
    'export all settings to the folder specified by "dest". By default it will export into "settings"',
    (yargs) => {
      return yargs
      .positional('dest', {
        describe: 'destination folder',
        default: 'settings',
      });
    },
    (argv) => {
      if (argv.verbose) {
        console.info(`Exporting settings to ${argv.dest}`);
      }
      if (argv.clear) {
        clear(argv.dest, {
          verbose: argv.verbose,
        });
      }

      exportSettings(argv.dest, {
        verbose: argv.verbose,
        overwrite: argv.force,
      });
    }
  )

  .option('clear', {
    alias: 'c',
    type: 'boolean',
    description: 'Clear existing files',
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: 'Overwrite existing files',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  });
}

export default exportTasks;
