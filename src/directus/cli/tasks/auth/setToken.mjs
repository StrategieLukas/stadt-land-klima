import {authentication, createDirectus, readMe, rest, updateMe, staticToken} from '@directus/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import {directusUrl} from "../shared/createDirectusClient.mjs";

const envFile = '.env';

export async function setStaticToken() {
  try {
    dotenv.config({path: envFile});
    const directus = createDirectus(directusUrl).with(authentication()).with(rest());

    console.log("Logging in with admin credentials to get temporary access token...");
    await directus.login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, {});

    console.log("Generating static token...");
    const newToken = crypto.randomBytes(24).toString('hex').slice(0, 32);

    console.log("Setting static token in Directus...");
    await directus.request(updateMe({token: newToken}));

    console.log("Setting static token in .env ...");
    let envContent = fs.readFileSync(envFile, 'utf8');
    envContent = envContent.replace(/CLI_DIRECTUS_STATIC_TOKEN=.*/, `CLI_DIRECTUS_STATIC_TOKEN=${newToken}`);
    fs.writeFileSync(envFile, envContent);

    console.log("Testing static token...");
    dotenv.config({path: envFile, override: true});

    await createDirectus(directusUrl)
      .with(staticToken(process.env.CLI_DIRECTUS_STATIC_TOKEN))
      .with(rest())
      .request(readMe());

  } catch (error) {
    console.log(error);
    process.exit(1);
  }
  console.log('\x1b[32m%s\x1b[0m', 'Success!');
  process.exit(0);
}
