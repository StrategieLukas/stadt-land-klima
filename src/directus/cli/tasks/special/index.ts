import path from 'path';
import clearDirectusCache from '../shared/clearDirectusCache.js';
import migrateRatings from './migrateRatings.js';

export default function specialTasks(yargs: any) {
  return yargs
    .command(
      'migrate [old] [new]',
      'migrates all ratings from the old version of the measure catalog to the new version',
      (yargs: any) => {
        return yargs
          .positional('old', {
            describe: 'old version',
          })
          .positional('new', {
            describe: 'new version',
          });
      },
      async (argv: any) => {
        console.info(`Migrating ratings from ${argv.old} to ${argv.new}`);

        await clearDirectusCache();
        await migrateRatings(argv.old, argv.new);
      }
    );
}
