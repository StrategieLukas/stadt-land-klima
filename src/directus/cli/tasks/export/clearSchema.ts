import fse from 'fse';
import path from 'path';
import clearDir from '../shared/clearDir.js';

const clerDirOpts = { extensions: ['.yaml'] };

interface ClearSchemaOptions {
  verbose?: boolean;
}

async function clearSchema(dest: string, options: ClearSchemaOptions = { verbose: false }): Promise<void> {
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
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default clearSchema;
