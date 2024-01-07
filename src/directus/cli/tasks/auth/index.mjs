import {setStaticToken} from "./setToken.mjs";
import {checkAuth} from "./checkAuth.mjs";

export default function index(yargs) {
  return yargs
    .command(
      'auth:set-token',
      'Generate a new static token and set it in Directus and .env',
      async () => await setStaticToken()
    )

    .command(
      'auth:test',
      'Test if this tool can authenticate with Directus',
      async () => await checkAuth()
    )
    .completion('completion');
}
