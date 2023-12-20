#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import exportTasks from './tasks/export/index.mjs';
import importTasks from './tasks/import/index.mjs';
import authTasks from "./tasks/authTasks.mjs";

const _yargs = yargs(hideBin(process.argv));
exportTasks(_yargs);
importTasks(_yargs);
authTasks(_yargs);
_yargs.parse();
