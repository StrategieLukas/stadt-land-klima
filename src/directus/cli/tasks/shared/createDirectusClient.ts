import dotenv from 'dotenv';
import { createDirectus, rest, staticToken, DirectusClient } from '@directus/sdk';

dotenv.config();

export const directusUrl = process.env.FRONTEND_DIRECTUS_URL || 'http://directus:8055';
const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;

function createDirectusClient(): DirectusClient<any, any> {
  if (!token) {
    console.error('You must provide a CLI_DIRECTUS_STATIC_TOKEN');
    process.exit(1);
  }

  return createDirectus(directusUrl).with(rest()).with(staticToken(token));
}

export default createDirectusClient;
