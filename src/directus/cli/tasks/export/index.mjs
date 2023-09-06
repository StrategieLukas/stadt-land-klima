import exportSchema from './exportSchema.mjs';
import clearSchema from './clearSchema.mjs';

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
