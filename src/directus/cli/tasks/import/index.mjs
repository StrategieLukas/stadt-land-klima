import importSchema from './importSchema.mjs';

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

      importSchema(argv.src, argv.verbose);
    }
  )
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  });
}

export default importTasks;
