import fse from 'fse';
import path from 'path';
import { parse } from 'yaml';

function readYamlFiles(dir) {
  const yamls = [];

  fse.readdirSync(dir)
  .forEach((filename) => {
    if (path.extname(filename).toLowerCase() === '.yaml') {
      const yaml = parse(fse.readFileSync(path.join(dir, filename), { encoding: 'utf8' }));
      yamls.push(yaml);
    }
  });

  return yamls;
}

export default readYamlFiles;
