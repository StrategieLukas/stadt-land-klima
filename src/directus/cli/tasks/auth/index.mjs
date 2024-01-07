import {setStaticToken} from "./setToken.mjs";
import {checkAuth} from "./checkAuth.mjs";
import {setFrontendToken} from "./setFrontendToken.mjs";

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

    .command(
      'auth:set-frontend-token',
      'Create a user with role frontend and with token: frontend-dev-token that is configured in the frontends .env file',
      async () => await setFrontendToken()
    )
}
