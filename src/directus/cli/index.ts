import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import authTasks from "./tasks/auth/index.ts";
import exportTasks from "./tasks/export/index.ts";
import importTasks from "./tasks/import/index.ts";
import specialTasks from "./tasks/special/index.ts";

const cli = yargs(hideBin(process.argv)).strict();
exportTasks(cli);
importTasks(cli);
specialTasks(cli);
authTasks(cli);
cli.completion();
await cli.parseAsync();
