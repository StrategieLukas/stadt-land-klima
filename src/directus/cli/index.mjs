#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import exportTasks from './tasks/export/index.mjs';
import importTasks from './tasks/import/index.mjs';

const _yargs = yargs(hideBin(process.argv));
exportTasks(_yargs);
importTasks(_yargs);

_yargs.parse();
