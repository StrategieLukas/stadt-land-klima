import createDirectusClient from "./createDirectusClient.js";
import { clearCache } from '@directus/sdk';

interface ClearDirectusCacheOptions {
  verbose?: boolean;
}

async function clearDirectusCache(options: ClearDirectusCacheOptions = { verbose: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    if (options.verbose) {
      console.info('Clearing cache');
    }

    await client.request(clearCache());
  } catch (err) {
    console.error(err);
  }
}

export default clearDirectusCache;
