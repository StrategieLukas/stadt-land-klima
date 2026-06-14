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

function getImportOptions(argv) {
  return {
    verbose: argv.verbose,
    remove: argv['remove-orphans'],
    overwrite: argv.force,
  };
}

function registerFolderImportCommand(yargs, {
  command,
  description,
  defaultSrc,
  importer,
  label,
  srcDescription = 'source folder',
}) {
  return yargs.command(
    command,
    description,
    (yargs) => {
      return yargs
      .positional('src', {
        describe: srcDescription,
        default: defaultSrc,
      });
    },
    async (argv) => {
      if (argv.verbose) {
        console.info(`Importing ${label} from ${argv.src}`);
      }

      await clearDirectusCache();
      await importer(argv.src, getImportOptions(argv));
    }
  );
}

function importTasks(yargs) {
  const importCommands = [
    {
      command: 'import:schema [src]',
      description: 'imports the schema from the folder specified by "src". By default it will import from "schema"',
      defaultSrc: 'schema',
      importer: importSchema,
      label: 'schema',
    },
    {
      command: 'import:policies [src]',
      description: 'imports the policies from the folder specified by "src". By default it will import from "policies"',
      defaultSrc: 'policies',
      importer: importPolicies,
      label: 'policies',
    },
    {
      command: 'import:roles [src]',
      description: 'imports the roles from the folder specified by "src". By default it will import from "roles". NOTE: Import policies first, as roles reference policies by ID.',
      defaultSrc: 'roles',
      importer: importRoles,
      label: 'roles',
    },
    {
      command: 'import:roles-and-policies [src]',
      description: 'imports roles and policies from the folder specified by "src". Expects policies/ and roles/ subdirectories. By default imports from current directory.',
      defaultSrc: '.',
      importer: importRolesAndPolicies,
      label: 'roles and policies',
      srcDescription: 'source folder containing policies/ and roles/ subdirectories',
    },
    {
      command: 'import:presets [src]',
      description: 'imports the presets from the folder specified by "src". By default it will import from "presets"',
      defaultSrc: 'presets',
      importer: importPresets,
      label: 'presets',
    },
    {
      command: 'import:flows [src]',
      description: 'imports the flows from the folder specified by "src". By default it will import from "flows"',
      defaultSrc: 'flows',
      importer: importFlows,
      label: 'flows',
    },
    {
      command: 'import:translations [src]',
      description: 'imports the translations from the folder specified by "src". By default it will import from "translations"',
      defaultSrc: 'translations',
      importer: importTranslations,
      label: 'translations',
    },
    {
      command: 'import:settings [src]',
      description: 'imports the settings from the folder specified by "src". By default it will import from "settings"',
      defaultSrc: 'settings',
      importer: importSettings,
      label: 'settings',
    },
    {
      command: 'import:dashboards [src]',
      description: 'imports the dashboards from the folder specified by "src". By default it will import from "dashboards"',
      defaultSrc: 'dashboards',
      importer: importDashboards,
      label: 'dashboards',
    },
  ];

  return importCommands
  .reduce(registerFolderImportCommand, yargs)

  .command(
    'import:all [src]',
    'imports schema, policies, roles, flows, presets, translations, settings, and dashboards consecutively.',
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

      // Import dashboards last because panels can depend on extensions and app-level access.
      console.info('Importing dashboards...');
      await importDashboards(path.join(src, 'dashboards'), {
        verbose: argv.verbose,
        remove: argv['remove-orphans'],
        overwrite: argv.force,
      });

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
