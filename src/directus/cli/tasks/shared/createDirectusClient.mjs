import dotenv from 'dotenv';
import { createDirectus } from '@directus/sdk';
import { rest } from '@directus/sdk/rest';
import { staticToken } from '@directus/sdk/auth';

dotenv.config();

const directusUrl = process.env.FRONTEND_DIRECTUS_URL || 'http://directus:8055';
const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;

function createDirectusClient() {
  let client = createDirectus(directusUrl).with(rest());

  if (!token) {
    console.error('You must provide a CLI_DIRECTUS_STATIC_TOKEN');
    return process.exit(1);
  }

  client = client.with(staticToken(token));

  return client;
}

export default createDirectusClient;
