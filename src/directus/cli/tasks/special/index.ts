import clearDirectusCache from "../shared/clearDirectusCache.ts";
import type { CliArguments } from "../shared/models.ts";
import migrateRatings from "./migrateRatings.ts";

export default function importTasks(yargs: CliArguments) {
  return yargs.command(
    "migrate [old] [new]",
    "migrates all ratings from the old version of the measure catalog to the new version",
    (yargs) => {
      return yargs
        .positional("old", {
          type: "string",
          describe: "old version",
        })
        .positional("new", {
          type: "string",
          describe: "new version",
        });
    },
    async (argv) => {
      console.info(`Migrating ratings from ${argv.old} to ${argv.new}`);

      await clearDirectusCache();
      await migrateRatings(argv.old, argv.new);
    },
  );
}
