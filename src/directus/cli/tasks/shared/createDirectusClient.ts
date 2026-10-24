import { createDirectus, rest, staticToken } from "@directus/sdk";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const directusUrl = process.env.FRONTEND_DIRECTUS_URL || "http://directus:8055";
const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;

function createDirectusClient<Schema extends object = {}>() {
  let client = createDirectus<Schema>(directusUrl).with(rest());

  if (!token) {
    throw new Error("You must provide a CLI_DIRECTUS_STATIC_TOKEN");
  }

  return client.with(staticToken(token));
}

export default createDirectusClient;
