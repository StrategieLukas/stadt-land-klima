import { createUser, readRoles } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.ts';

export async function setFrontendToken() {
  try {
    if (process.env.SLK_ENV === 'production')
      throw new Error(
        'Development frontend-token provisioning is disabled in production',
      );
    const directus = createDirectusClient();

    console.log('Fetching the frontend role...');
    const roles = await directus.request(
      readRoles({
        filter: {
          name: {
            _eq: 'frontend',
          },
        },
      }),
    );

    if (roles.length !== 1) {
      console.error(
        'Could not uniquely identify the frontend role. You probably have to run import:roles first.',
      );
      process.exit(1);
    }

    console.log('Creating the frontend user...');
    await directus.request(
      createUser({
        first_name: 'Frontend',
        email: 'frontend@example.com',
        token: 'frontend-dev-token',
        role: roles[0].id,
      }),
    );

    console.log('\x1b[32m%s\x1b[0m', 'Success!');
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}
