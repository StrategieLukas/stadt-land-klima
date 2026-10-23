import fse from 'node:fs';
import path from 'path';
import clearDir from '../shared/clearDir.ts';
import type { TaskOptions } from '../shared/models.ts';

const clerDirOpts = { extensions: ['.yaml'] };

async function clearSchema(dest: string, options: TaskOptions = {}) {
  try {
    if (fse.existsSync(path.join(dest, 'header.yaml'))) {
      fse.unlinkSync(path.join(dest, 'header.yaml'));
    }
    clearDir(path.join(dest, 'collections'), clerDirOpts);
    clearDir(path.join(dest, 'fields'), clerDirOpts);
    clearDir(path.join(dest, 'relations'), clerDirOpts);

    if (options.verbose) {
      console.info(`${dest} cleared`);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default clearSchema;
