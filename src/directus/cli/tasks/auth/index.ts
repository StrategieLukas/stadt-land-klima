import type { CliArguments } from "../shared/models.ts";
import { checkAuth } from "./checkAuth.ts";
import { setFrontendToken } from "./setFrontendToken.ts";
import { setStaticToken } from "./setToken.ts";

export default function index(yargs: CliArguments) {
  return yargs
    .command(
      "auth:set-token",
      "Generate a new static token and set it in Directus and .env",
      () => {},
      async () => await setStaticToken(),
    )

    .command(
      "auth:test",
      "Test if this tool can authenticate with Directus",
      () => {},
      async () => await checkAuth(),
    )

    .command(
      "auth:set-frontend-token",
      "Create a user with role frontend and with token: frontend-dev-token that is configured in the frontends .env file",
      () => {},
      async () => await setFrontendToken(),
    );
}
