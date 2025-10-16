import path from 'path';
import clearDirectusCache from '../shared/clearDirectusCache.mjs';
import migrateRatings from './migrateRatings.mjs';

export default function importTasks(yargs) {
  return yargs
  .command(
    'migrate [old] [new]',
    'migrates all ratings from the old version of the measure catalog to the new version',
    (yargs) => {
      return yargs
      .positional('old', {
        describe: 'old version',
      })
      .positional('new', {
            describe: 'new version',
          });
    },
    async (argv) => {
      console.info(`Migrating ratings from ${argv.old} to ${argv.new}`);

      await clearDirectusCache();
      await migrateRatings(argv.old, argv.new);
    }
  )
}
