import fse from 'fse';
import parser from '@pushcorn/hocon-parser';

// Substitute ${VAR_NAME} placeholders with process.env values before parsing.
// Unset variables are left as-is (no substitution) to avoid breaking unrelated HOCON.
function substituteEnvVars(content) {
  return content.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name) =>
    process.env[name] !== undefined ? process.env[name] : match
  );
}

async function readHoconFile(filepath) {
  const raw = fse.readFileSync(filepath, { encoding: 'utf8' });
  const substituted = substituteEnvVars(raw);
  // parser.parse expects an options object with url or text
  return await parser.parse({ text: substituted });
}

export default readHoconFile;
