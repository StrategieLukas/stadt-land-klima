// filter-openapi.js
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { createDirectus, staticToken, rest, schemaSnapshot } from "@directus/sdk";

/**
 * Read CLI_DIRECTUS_STATIC_TOKEN from a .env file at a fixed path
 */
function readTokenFromEnv() {
  const envPath = path.resolve("../.env");
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/^CLI_DIRECTUS_STATIC_TOKEN\s*=\s*(.+)$/m);
  if (!match) {
    throw new Error(`❌ CLI_DIRECTUS_STATIC_TOKEN not found in ${envPath}`);
  }
  return match[1].trim().replace(/^['"]|['"]$/g, ""); // remove optional quotes
}

/**
 * Fetch JSON from a URL (supports HTTP/HTTPS)
 */
async function fetchJSON(url, token) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            // Clean invisible Unicode separators and normalize line endings
            const cleaned = data
              .replace(/[\u2028\u2029\u0085\u000B\u000C]/g, "")
              .replace(/\r\n?/g, "\n");
            resolve(JSON.parse(cleaned));
          } catch (err) {
            reject(new Error("Invalid JSON response from " + url));
          }
        });
      }
    );
    req.on("error", reject);
  });
}

(async () => {
  // Read admin token from the directus .env file
  const ADMIN_TOKEN = readTokenFromEnv();

  const url = "http://localhost:8081/server/specs/oas";
  const fullPath = "openapi.json";
  const filteredPath = "erfolgsprojekte-openapi.json";

  console.log("📥 Fetching authenticated OpenAPI spec from:", url);

  const fullSpec = await fetchJSON(url, ADMIN_TOKEN);
  fs.writeFileSync(fullPath, JSON.stringify(fullSpec, null, 2));
  console.log(`💾 Full spec saved to ${fullPath}`);

  // Define the exact endpoints and methods you want
  const erfolgsprojekteApiEndpoints = {
    "/items/organisations": ["get"],
    "/items/organisations/{id}": ["get"],
    "/items/articles": ["get"],
    "/items/articles/{id}": ["get"],
    "/items/external_projects": ["get"],
    "/items/external_projects/{id}": ["get"],
  };

  const newPaths = {};
  for (const [pathKey, methods] of Object.entries(fullSpec.paths || {})) {
    if (erfolgsprojekteApiEndpoints[pathKey]) {
      newPaths[pathKey] = {};
      for (const method of erfolgsprojekteApiEndpoints[pathKey]) {
        if (methods[method]) {
          newPaths[pathKey][method] = methods[method];
        }
      }
    }
  }

  // Create a minimal, clean spec
  const filtered = {
    openapi: fullSpec.openapi,
    info: fullSpec.info,
    paths: newPaths,
  };

  fs.writeFileSync(filteredPath, JSON.stringify(filtered, null, 2));
  console.log(`✅ Filtered spec saved to ${filteredPath}`);


  console.log("📦 Fetching Directus schema snapshot via SDK...");

  const client = createDirectus("http://localhost:8081")
    .with(staticToken(ADMIN_TOKEN))
    .with(rest());

  const snapshot = await client.request(schemaSnapshot());
  fs.writeFileSync("schema.json", JSON.stringify(snapshot, null, 2));

  console.log("✅ Schema snapshot saved to schema.json");

  // --- Filter & restructure schema snapshot (simplified) ---
  const erfolgsprojekteCollections = ["articles", "organisations", "external_projects"];

  // Build collections from top-level fields array
  const collectionsMap = {};
  for (const field of snapshot.fields || []) {
    if (!erfolgsprojekteCollections.includes(field.collection)) continue;
    if (field.type === "alias") continue; // skip fields with type=alias entirely (blocks/groups for better viewing in the backend)

    if (!collectionsMap[field.collection]) {
      collectionsMap[field.collection] = { fields: [] };
    }

    const f = {
      name: field.field,
      type: field.type,
      required: field.meta?.required ?? false,
      is_nullable: field.schema?.is_nullable ?? false
    };

    const iface = field.meta?.interface ?? "";
    const rawOptions = field.meta?.options ?? null;

    // Handle options filtering
    if (rawOptions && !iface.startsWith("input-")) {
      const allowedOptionKeys = ["choices", "min", "max"];
      const filteredOptions = Object.fromEntries(
        Object.entries(rawOptions).filter(([key]) =>
          allowedOptionKeys.includes(key)
        )
      );

      if (Object.keys(filteredOptions).length > 0) {
        f.options = filteredOptions;
      }
    }

    // Add other optional fields only if not null
    if (field.meta?.validation != null) f.validation = field.meta.validation;
    if (field.meta?.validation_message != null)
      f.validation_message = field.meta.validation_message;
    if (field.schema?.max_length != null) f.max_length = field.schema.max_length;
    if (field.schema?.default_value != null)
      f.default_value = field.schema.default_value;

    collectionsMap[field.collection].fields.push(f);
  }



  // Filter relations only for relevant collections
  // const filteredRelations = (snapshot.relations || []).filter(
  //   (rel) =>
  //     erfolgsprojekteCollections.includes(rel.collection) ||
  //     erfolgsprojekteCollections.includes(rel.related_collection)
  // );

  // Final structured result
  const filteredSnapshot = {
    // version: snapshot.version,
    // directus: snapshot.directus,
    // vendor: snapshot.vendor,
    collections: collectionsMap,
    // relations: filteredRelations
  };

  // Write clean JSON (remove hidden separators + normalize line endings)
  fs.writeFileSync(
    "erfolgsprojekte-schema.json",
    JSON.stringify(filteredSnapshot, null, 2)
      .replace(/[\u2028\u2029\u0085\u000B\u000C]/g, "")
      .replace(/\r\n?/g, "\n")
  );

  console.log("✅ Filtered & simplified schema saved to erfolgsprojekte-schema.json");


})();
