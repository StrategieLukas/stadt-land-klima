import path from 'path';
import clearDirectusCache from '../shared/clearDirectusCache.mjs';
import importSchema from './importSchema.mjs';
import importRoles from './importRoles.mjs';
import importPolicies from './importPolicies.mjs';
import importRolesAndPolicies from './importRolesAndPolicies.mjs';
import importPresets from './importPresets.mjs';
import importFlows from './importFlows.mjs';
import importTranslations from './importTranslations.mjs';
import importSettings from './importSettings.mjs';
import importCollectionItems from './importCollectionItems.mjs';
import importDashboards from './importDashboards.mjs';

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
    'import:policies [src]',
    'imports the policies from the folder specified by "src". By default it will import from "policies"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'policies',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing policies from ${argv.src}`);
      }

      await clearDirectusCache();
      await importPolicies(argv.src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });
    }
  )

  .command(
    'import:roles [src]',
    'imports the roles from the folder specified by "src". By default it will import from "roles". NOTE: Import policies first, as roles reference policies by ID.',
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
        overwrite: argv.force,
      });
    }
  )

  .command(
    'import:roles-and-policies [src]',
    'imports roles and policies from the folder specified by "src". Expects policies/ and roles/ subdirectories. By default imports from current directory.',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder containing policies/ and roles/ subdirectories',
        default: '.',
      });
    },
    async (argv) => {
      const src = argv.src;

      if (argv.verbose) {
        console.info(`Importing roles and policies from ${src}`);
      }

      await clearDirectusCache();
      await importRolesAndPolicies(src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
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
        overwrite: argv.force,
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
        overwrite: argv.force,
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
        overwrite: argv.force,
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
        overwrite: argv.force,
      });
    }
  )

  .command(
    'import:dashboards [src]',
    'imports the dashboards from the folder specified by "src". By default it will import from "dashboards"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: 'dashboards',
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing dashboards from ${argv.src}`);
      }

      await clearDirectusCache();
      await importDashboards(argv.src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });
    }
  )

  .command(
    'import:all [src]',
    'imports schema, policies, roles, flows, presets, translations, and settings consecutively. ' +
      'Dashboards are intentionally skipped for now.',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'base folder for all imports (default: current directory)',
        default: '.',
      });
    },
    async (argv) => {
      const startTime = Date.now();
      const src = argv.src;

      console.info('Starting full import...');

      // Clear cache once at the beginning
      console.info('Clearing cache...');
      await clearDirectusCache();

      // Import schema
      console.info('Importing schema...');
      await importSchema(path.join(src, 'schema'), {
        verbose: argv.verbose,
      });

      // Import policies and roles together (policies must be before roles in v11+)
      console.info('Importing policies and roles...');
      await importRolesAndPolicies(src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });

      // Import flows
      console.info('Importing flows...');
      await importFlows(path.join(src, 'flows'), {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });

      // Import presets
      console.info('Importing presets...');
      await importPresets(path.join(src, 'presets'), {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });

      // Import translations
      console.info('Importing translations...');
      await importTranslations(path.join(src, 'translations'), {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });

      // Import settings
      console.info('Importing settings...');
      await importSettings(path.join(src, 'settings'), {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });

      console.info('Dashboards are not imported at the moment. Run import:dashboards manually if needed.');

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.info(`Full import completed in ${elapsed}s`);
    }
  )

  .command(
    'import:items [collection] [src]',
    'imports the items of a collection from a file specified by "src". By default it will import from "contents/{collection}.yaml"',
    (yargs) => {
      return yargs
      .positional('collection', {
        describe: 'collection to import',
        required: true,
      })
      .positional('src', {
        describe: 'source file',
        default: '',
      });
    },
    async (argv) => {
      const src = argv.src || path.join('contents', argv.collection + '.yaml');

      if (argv.verbose) {
        console.info(`Importing ${argv.collection} items from ${src}`);
      }

      await clearDirectusCache();
      await importCollectionItems(argv.collection, src, {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });
    }
  )

  .option('remove-orphans', {
    alias: 'r',
    type: 'boolean',
    description: 'Removes orphan entries not present in the imported data.',
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: 'Overwrite existing entries',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  });
}

export default importTasks;
