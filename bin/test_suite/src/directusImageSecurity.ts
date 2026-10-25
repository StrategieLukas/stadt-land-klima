import { execFileSync } from "node:child_process";
const image = process.env.SLK_SECURITY_IMAGE || "stadt-land-klima-directus";
if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(image)) throw new Error("Invalid security image reference");
execFileSync(
  "docker",
  [
    "run",
    "--rm",
    "--network=none",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--entrypoint=node",
    image,
    "/opt/slk-directus-runtime-security/test-runtime.ts",
  ],
  { stdio: "inherit", timeout: 120_000 },
);
