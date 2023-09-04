import fse from 'fse';
import path from 'path';

async function clearSchema(dest) {
  function clearDir(dir) {
    fse.readdirSync(dir)
    .forEach((filename) => {
      if (filename !== '.' && filename !== '..') {
        fse.unlinkSync(path.join(dir, filename));
      }
    });
  }

  try {
    fse.unlinkSync(path.join(dest, 'header.yaml'));
    clearDir(path.join(dest, 'collections'));
    clearDir(path.join(dest, 'fields'));
    clearDir(path.join(dest, 'relations'));
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default clearSchema;
