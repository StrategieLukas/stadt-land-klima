import createDirectusClient from "../shared/createDirectusClient.mjs";
import {createUser, readRoles} from "@directus/sdk";

export async function setFrontendToken() {
  try {
    const directus = createDirectusClient();

    console.log("Fetching the frontend role...")
    const roles = await directus.request(
      readRoles( {
        filter: {
          name: {
            _eq: 'frontend',
          },
        },
      })
    );

    if (roles.length !== 1) {
      console.error("Could not uniquely identify the frontend role. You probably have to run import:roles first.");
      process.exit(1);
    }

    console.log("Creating the frontend user...")
    await directus.request(
      createUser({
        email: 'frontend@example.com',
        token: 'frontend-dev-token',
        role: roles[0].uuid
      }));

    console.log('\x1b[32m%s\x1b[0m', 'Success!');

  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}
