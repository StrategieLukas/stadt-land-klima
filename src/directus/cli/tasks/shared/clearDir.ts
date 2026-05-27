import fse from 'fse';
import path from 'path';
import includes from 'lodash/includes.js';

interface ClearDirOptions {
  extensions?: string[] | null;
}

function clearDir(dir: string, options: ClearDirOptions = { extensions: null }): void {
  if (!fse.existsSync(dir) || !fse.statSync(dir).isDirectory()) {
    return;
  }

  fse.readdirSync(dir)
    .forEach((filename) => {
      if (filename !== '.' && filename !== '..') {
        const fullPath = path.join(dir, filename);
        if (fse.statSync(fullPath).isDirectory()) {
          clearDir(fullPath, options);
          if (fse.readdirSync(fullPath).length === 0) {
            fse.rmdirSync(fullPath);
          }
        } else {
          const extension = path.extname(filename);

          if (options.extensions && options.extensions.length) {
            if (includes(options.extensions, extension)) {
              fse.unlinkSync(fullPath);
            }
          } else {
            fse.unlinkSync(fullPath);
          }
        }
      }
    });
}

export default clearDir;
