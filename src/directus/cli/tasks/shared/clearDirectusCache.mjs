import createDirectusClient from "./createDirectusClient.mjs";
import {
  clearCache,
} from '@directus/sdk';

async function clearDirectusCache(options = {verbose: false}) {
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
