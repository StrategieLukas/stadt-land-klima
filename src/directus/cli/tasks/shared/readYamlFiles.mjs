import fse from 'fse';
import path from 'path';
import { parse } from 'yaml';

// Substitute ${VAR_NAME} placeholders with process.env values before parsing.
// Unset variables are left as-is to avoid breaking unrelated YAML.
function substituteEnvVars(content) {
  return content.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name) =>
    process.env[name] !== undefined ? process.env[name] : match
  );
}

function readYamlFiles(dir) {
  const yamls = [];

  if (!fse.existsSync(dir) || !fse.statSync(dir).isDirectory()) {
    return yamls;
  }

  fse.readdirSync(dir)
  .forEach((filename) => {
    const fullPath = path.join(dir, filename);
    if (fse.statSync(fullPath).isDirectory()) {
      yamls.push(...readYamlFiles(fullPath));
    } else if (path.extname(filename).toLowerCase() === '.yaml') {
      const raw = fse.readFileSync(fullPath, { encoding: 'utf8' });
      const yaml = parse(substituteEnvVars(raw));
      yamls.push(yaml);
    }
  });

  return yamls;
}

export default readYamlFiles;
