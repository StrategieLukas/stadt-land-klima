#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import exportTasks from './tasks/export/index.js';
import importTasks from './tasks/import/index.js';
import specialTasks from './tasks/special/index.js';
import authTasks from "./tasks/auth/index.js";

const _yargs = yargs(hideBin(process.argv));
_yargs.strict();
exportTasks(_yargs);
importTasks(_yargs);
specialTasks(_yargs);
authTasks(_yargs);
_yargs.parse();
_yargs.completion();
