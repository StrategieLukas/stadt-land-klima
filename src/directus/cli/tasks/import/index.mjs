import path from 'path';
import importSchema from './importSchema.mjs';
import importRoles from './importRoles.mjs';

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
    (argv) => {
      if (argv.verbose) {
        console.info(`Importing schema from ${argv.src}`);
      }

      importSchema(argv.src, {verbose: argv.verbose});
    }
  )
  .command(
    'import:roles [src]',
    'imports the roles from the folder specified by "src". By default it will import from "schema/roles"',
    (yargs) => {
      return yargs
      .positional('src', {
        describe: 'source folder',
        default: path.join('schema', 'roles'),
      });
    },
    (argv) => {
      if (argv.verbose) {
        console.info(`Importing roles from ${argv.src}`);
      }

      importRoles(argv.src, {verbose: argv.verbose, remove: argv['remove-orphans']});
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
