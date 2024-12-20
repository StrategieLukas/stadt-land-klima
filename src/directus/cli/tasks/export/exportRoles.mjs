import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readRoles, readPermissions, readPolicies } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

// Exports roles, policies and permissions
async function exportRoles(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const roles = await client.request(readRoles({limit: -1}));
    const permissions = await client.request(readPermissions({limit: -1}));
    const policies = await client.request(readPolicies({limit: -1}));
    // console.log(policies[0]);

    fse.mkdirSync(dest);

    const c = roles.map((role) => role.id)
    console.log(c)

    console.log(roles[0]);

    roles.forEach((role) => {
      const destPath = path.join(dest, slugify(role.name, '_') + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      delete role.users;

      // console.log(role);

      // console.log(policies[0]);
      // const a = policies.find((policy) => policy.id === '930a3639-6e21-4d4b-990c-fbe66aefafde')
      // console.log(a)
      // const b = policies.filter((policy) => policy.id === '930a3639-6e21-4d4b-990c-fbe66aefafde')
      // console.log(b)
      // const c = policies.map((policy) => policy.id)
      // console.log(c)



      role.policies.map((policy_id) => {
        return policies.find((policy) => policy.id === policy_id)
      })

      // role.permissions = permissions.filter((permission) => {
      //   return permission.role === role.id;
      // }).map((permission) => {
      //   delete permission.id;
      //   delete permission.role;
      //   return permission;
      // });

      // delete role.id;

      fse.writeFileSync(
        destPath,
        stringify(role),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported role ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info('All roles exported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportRoles;
