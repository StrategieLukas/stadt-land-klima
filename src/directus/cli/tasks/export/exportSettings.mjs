import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readSettings } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

// Explicitly known sensitive fields that should NOT be exported to version control
// These will be populated from environment variables during import
const SENSITIVE_SETTINGS_FIELDS = [
  'mapbox_key',
  'ai_openai_api_key',
  'ai_anthropic_api_key',
  'ai_google_api_key',
  'ai_openai_compatible_api_key',
  'ai_openai_compatible_base_url',
  'ai_openai_compatible_headers',
  'ai_openai_compatible_name',
  'ai_openai_compatible_models',
];

// Wildcard pattern to catch any field containing "key" (case-insensitive)
// This provides a safety net for new API key fields added in future Directus versions
const WILDCARD_PATTERNS = [
  /key/i,  // Matches any field name containing "key" (case-insensitive)
];

/**
 * Checks if a field name matches any wildcard pattern
 */
function matchesWildcardPattern(fieldName) {
  for (const pattern of WILDCARD_PATTERNS) {
    if (pattern.test(fieldName)) {
      return true;
    }
  }
  return false;
}

/**
 * Filters out sensitive fields from settings that should not be committed to version control
 */
function filterSensitiveSettings(settings) {
  const filtered = { ...settings };
  
  // Remove explicitly known sensitive fields
  for (const field of SENSITIVE_SETTINGS_FIELDS) {
    if (field in filtered) {
      delete filtered[field];
    }
  }
  
  // Remove any field matching wildcard patterns (e.g., containing "key")
  for (const fieldName of Object.keys(filtered)) {
    if (matchesWildcardPattern(fieldName)) {
      delete filtered[fieldName];
    }
  }
  
  return filtered;
}

async function exportSettings(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const settings = await client.request(readSettings());
    
    // Filter out sensitive fields before exporting
    const safeSettings = filterSensitiveSettings(settings);

    fse.mkdirSync(dest);

    const destPath = path.join(dest, 'settings.yaml');

    if (!options.overwrite && fse.existsSync(destPath)) {
      if (options.verbose) {
        console.info(`File ${destPath} already exists.`);
      }
      return;
    }

    fse.writeFileSync(
      destPath,
      stringify(safeSettings),
      { encoding: 'utf8' }
    );

    if (options.verbose) {
      console.info(`Exported setting ${destPath}`);
      
      // Count explicitly filtered fields
      const explicitFilteredCount = SENSITIVE_SETTINGS_FIELDS.filter(f => f in settings).length;
      
      // Count wildcard-matched fields that were filtered
      const wildcardFilteredFields = Object.keys(settings).filter(
        fieldName => !SENSITIVE_SETTINGS_FIELDS.includes(fieldName) &&
                     matchesWildcardPattern(fieldName)
      );
      const wildcardFilteredCount = wildcardFilteredFields.length;
      
      const totalFiltered = explicitFilteredCount + wildcardFilteredCount;
      if (totalFiltered > 0) {
        console.info(`Filtered out ${totalFiltered} sensitive field(s) from export`);
        if (explicitFilteredCount > 0 && wildcardFilteredCount > 0) {
          console.info(`  - ${explicitFilteredCount} from explicit list`);
          console.info(`  - ${wildcardFilteredCount} from wildcard patterns (containing "key")`);
        }
      }
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportSettings;
