import fse from 'fse';
import path from 'path';
import clearDir from '../shared/clearDir.mjs';

async function clearSchema(dest, options = {verbose: false}) {
  try {
    if (fse.existsSync(path.join(dest, 'header.yaml'))) {
      fse.unlinkSync(path.join(dest, 'header.yaml'));
    }
    clearDir(path.join(dest, 'collections'));
    clearDir(path.join(dest, 'fields'));
    clearDir(path.join(dest, 'relations'));

    if (options.verbose) {
      console.info(`${dest} cleared`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default clearSchema;
