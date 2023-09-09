import fse from 'fse';
import path from 'path';

function clearDir(dir) {
  if (!fse.existsSync(dir) || !fse.statSync(dir).isDirectory()) {
    return;
  }

  fse.readdirSync(dir)
  .forEach((filename) => {
    if (filename !== '.' && filename !== '..') {
      fse.unlinkSync(path.join(dir, filename));
    }
  });
}

export default clearDir;
