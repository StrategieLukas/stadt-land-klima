import fse from 'fse';
import path from 'path';
import readHoconFile from './readHoconFile.mjs';

async function readHoconFiles(dir) {
  const hocons = [];

  if (!fse.existsSync(dir) || !fse.statSync(dir).isDirectory()) {
    return hocons;
  }

  const files = fse.readdirSync(dir);
  
  for (const filename of files) {
    const fullPath = path.join(dir, filename);
    if (fse.statSync(fullPath).isDirectory()) {
      const nested = await readHoconFiles(fullPath);
      hocons.push(...nested);
    } else if (path.extname(filename).toLowerCase() === '.hocon') {
      const hocon = await readHoconFile(fullPath);
      hocons.push(hocon);
    }
  }

  return hocons;
}

export default readHoconFiles;
