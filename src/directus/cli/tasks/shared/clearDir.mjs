import fse from 'fse';
import path from 'path';
import includes from 'lodash/includes.js';

function clearDir(dir, options = {extensions: null}) {
  if (!fse.existsSync(dir) || !fse.statSync(dir).isDirectory()) {
    return;
  }

  fse.readdirSync(dir)
  .forEach((filename) => {
    if (filename !== '.' && filename !== '..') {
      const extension = path.extname(filename);

      if (options.extensions && options.extensions.length) {
        if (includes(options.extensions, extension)) {
          fse.unlinkSync(path.join(dir, filename));
        }
      } else {
        fse.unlinkSync(path.join(dir, filename));
      }
    }
  });
}

export default clearDir;
