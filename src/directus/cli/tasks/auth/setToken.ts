import { authentication, createDirectus, readMe, rest, updateMe, staticToken } from '@directus/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import { directusUrl } from "../shared/createDirectusClient.js";

const envFile = '.env';

export async function setStaticToken(): Promise<void> {
  try {
    dotenv.config({ path: envFile });
    const directus = createDirectus(directusUrl).with(authentication()).with(rest());

    console.log("Logging in with admin credentials to get temporary access token...");
    await directus.login({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });

    console.log("Generating static token...");
    const newToken = crypto.randomBytes(24).toString('hex').slice(0, 32);

    console.log("Setting static token in Directus...");
    await directus.request(updateMe({ token: newToken }));

    console.log("Setting static token in .env ...");
    let envContent = fs.readFileSync(envFile, 'utf8');
    envContent = envContent.replace(/CLI_DIRECTUS_STATIC_TOKEN=.*/, `CLI_DIRECTUS_STATIC_TOKEN=${newToken}`);
    fs.writeFileSync(envFile, envContent);

    console.log("Testing static token...");
    dotenv.config({ path: envFile, override: true });

    await createDirectus(directusUrl)
      .with(staticToken(process.env.CLI_DIRECTUS_STATIC_TOKEN!))
      .with(rest())
      .request(readMe());

  } catch (error: any) {
    console.log(error);
    process.exit(1);
  }
  console.log('\x1b[32m%s\x1b[0m', 'Success! Please run:');
  console.log('\x1b[32m%s\x1b[0m', '    source .env');
  process.exit(0);
}
