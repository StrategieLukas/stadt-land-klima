import fse from 'fse';
import { parse } from 'yaml';

function readYamlFile(filepath) {
  return parse(fse.readFileSync(filepath, { encoding: 'utf8' }));
}

export default readYamlFile;
