import fse from 'fse';
import { parse } from 'yaml';

// Substitute ${VAR_NAME} placeholders with process.env values before parsing.
// Unset variables are left as-is (no substitution) to avoid breaking unrelated YAML.
function substituteEnvVars(content) {
  return content.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name) =>
    process.env[name] !== undefined ? process.env[name] : match
  );
}

function readYamlFile(filepath) {
  const raw = fse.readFileSync(filepath, { encoding: 'utf8' });
  return parse(substituteEnvVars(raw));
}

export default readYamlFile;
