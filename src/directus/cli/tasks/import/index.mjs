import clearDirectusCache from '../shared/clearDirectusCache.mjs';
import importSchema from './importSchema.mjs';
import importRoles from './importRoles.mjs';
import importPresets from './importPresets.mjs';
import importWebhooks from './importWebhooks.mjs';
import importFlows from './importFlows.mjs';
import importTranslations from './importTranslations.mjs';
import importSettings from './importSettings.mjs';

function importTasks(yargs) {
  return yargs
  .command(
    'import:schema [src]',
    'imports the schema from the folder specified by "src". By default it will import from "schema"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'schema',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing schema from ${argv.src}`);
      }

      await clearDirectusCache();
      await importSchema(argv.src, {
        verbose: argv.verbose,
      });
    }
  )

  .command(
    'import:roles [src]',
    'imports the roles from the folder specified by "src". By default it will import from "roles"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'roles',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing roles from ${argv.src}`);
      }

      await clearDirectusCache();
      await importRoles(argv.src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
      });
    }
  )

  .command(
    'import:presets [src]',
    'imports the presets from the folder specified by "src". By default it will import from "presets"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'presets',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing presets from ${argv.src}`);
      }

      await clearDirectusCache();
      await importPresets(argv.src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
      });
    }
  )

  .command(
    'import:webhooks [src]',
    'imports the webhooks from the folder specified by "src". By default it will import from "webhooks"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'webhooks',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing webhooks from ${argv.src}`);
      }

      await clearDirectusCache();
      await importWebhooks(argv.src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
      });
    }
  )

  .command(
    'import:flows [src]',
    'imports the flows from the folder specified by "src". By default it will import from "flows"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'flows',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing flows from ${argv.src}`);
      }

      await clearDirectusCache();
      await importFlows(argv.src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
      });
    }
  )

  .command(
    'import:translations [src]',
    'imports the translations from the folder specified by "src". By default it will import from "translations"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'translations',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing translations from ${argv.src}`);
      }

      await clearDirectusCache();
      await importTranslations(argv.src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
      });
    }
  )

  .command(
    'import:settings [src]',
    'imports the settings from the folder specified by "src". By default it will import from "settings"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'settings',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing settings from ${argv.src}`);
      }

      await clearDirectusCache();
      await importSettings(argv.src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
      });
    }
  )

  .option('remove-orphans', {
    alias: 'r',
    type: 'boolean',
    description: 'Removes orphan entries not present in the imported data.',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  });
}

export default importTasks;
