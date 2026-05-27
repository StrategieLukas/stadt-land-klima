import fse from 'fse';
import path from 'path';
import clearDir from '../shared/clearDir.mjs';

const clerDirOpts = {extensions: ['.hocon']};

async function clearSchema(dest, options = {verbose: false}) {
  try {
    if (fse.existsSync(path.join(dest, 'header.hocon'))) {
      fse.unlinkSync(path.join(dest, 'header.hocon'));
    }
    clearDir(path.join(dest, 'collections'), clerDirOpts);
    clearDir(path.join(dest, 'fields'), clerDirOpts);
    clearDir(path.join(dest, 'relations'), clerDirOpts);

    if (options.verbose) {
      console.info(`${dest} cleared`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default clearSchema;
