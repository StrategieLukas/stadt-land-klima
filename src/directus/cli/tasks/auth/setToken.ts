import { authentication, createDirectus, readMe, rest, staticToken, updateMe } from "@directus/sdk";
import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import { directusUrl } from "../shared/createDirectusClient.ts";

const envFile = ".env";

export async function setStaticToken() {
  try {
    dotenv.config({ path: envFile });
    const directus = createDirectus(directusUrl).with(authentication()).with(rest());

    console.log("Logging in with admin credentials to get temporary access token...");
    const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
    if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
    await directus.login({ email, password });

    console.log("Generating static token...");
    const newToken = crypto.randomBytes(24).toString("hex").slice(0, 32);

    console.log("Setting static token in Directus...");
    await directus.request(updateMe({ token: newToken }));

    console.log("Setting static token in .env ...");
    let envContent = fs.readFileSync(envFile, "utf8");
    envContent = envContent.replace(/CLI_DIRECTUS_STATIC_TOKEN=.*/, `CLI_DIRECTUS_STATIC_TOKEN=${newToken}`);
    fs.writeFileSync(envFile, envContent);

    console.log("Testing static token...");
    dotenv.config({ path: envFile, override: true });

    await createDirectus(directusUrl).with(staticToken(newToken)).with(rest()).request(readMe());
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
  console.log("\x1b[32m%s\x1b[0m", "Success! Please run:");
  console.log("\x1b[32m%s\x1b[0m", "    source .env");
  process.exit(0);
}
