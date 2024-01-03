#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import exportTasks from './tasks/export/index.mjs';
import importTasks from './tasks/import/index.mjs';
import authTasks from "./tasks/auth/index.mjs";

const _yargs = yargs(hideBin(process.argv));
_yargs.strict();
exportTasks(_yargs);
importTasks(_yargs);
authTasks(_yargs);
_yargs.parse();
