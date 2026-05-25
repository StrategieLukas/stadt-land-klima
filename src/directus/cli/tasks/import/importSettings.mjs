import path from 'path';
import {
  updateSettings,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFile from '../shared/readYamlFile.mjs';

// Map of environment variable names to Directus setting field names
// These will be merged into the settings before import
const ENV_TO_SETTING_MAP = {
  DIRECTUS_MAPBOX_KEY: 'mapbox_key',
  DIRECTUS_AI_OPENAI_API_KEY: 'ai_openai_api_key',
  DIRECTUS_AI_ANTHROPIC_API_KEY: 'ai_anthropic_api_key',
  DIRECTUS_AI_GOOGLE_API_KEY: 'ai_google_api_key',
  DIRECTUS_AI_OPENAI_COMPATIBLE_API_KEY: 'ai_openai_compatible_api_key',
  DIRECTUS_AI_OPENAI_COMPATIBLE_BASE_URL: 'ai_openai_compatible_base_url',
  DIRECTUS_AI_OPENAI_COMPATIBLE_NAME: 'ai_openai_compatible_name',
  DIRECTUS_AI_OPENAI_COMPATIBLE_HEADERS: 'ai_openai_compatible_headers',
  DIRECTUS_AI_OPENAI_COMPATIBLE_MODELS: 'ai_openai_compatible_models',
};

/**
 * Merges environment variables into settings for sensitive fields
 */
function mergeEnvSettings(settings) {
  const merged = { ...settings };
  for (const [envVar, settingField] of Object.entries(ENV_TO_SETTING_MAP)) {
    const envValue = process.env[envVar];
    if (envValue !== undefined && envValue !== null && envValue !== '') {
      merged[settingField] = envValue;
      if (process.env.VERBOSE || process.env.NODE_ENV === 'development') {
        console.info(`Merged ${settingField} from ${envVar} environment variable`);
      }
    }
  }
  return merged;
}

async function importSettings(src, options = {verbose: false}) {
  const client = createDirectusClient();

  try {
    const settings = readYamlFile(path.join(src, 'settings.yaml'));
    
    // Merge environment variables for sensitive fields
    const settingsWithEnv = mergeEnvSettings(settings);

    await client.request(updateSettings(settingsWithEnv));

    if (options.verbose) {
      console.info('Settings imported');
      const mergedCount = Object.values(ENV_TO_SETTING_MAP).filter(
        field => settingsWithEnv[field] !== settings[field]
      ).length;
      if (mergedCount > 0) {
        console.info(`Merged ${mergedCount} sensitive field(s) from environment variables`);
      }
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importSettings;
