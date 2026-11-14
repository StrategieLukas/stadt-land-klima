import { execFileSync } from "node:child_process";
const image = process.env.SLK_SECURITY_IMAGE || "localhost/slk-podman-directus-runtime:local";
if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(image)) throw new Error("Invalid security image reference");
execFileSync(
  "podman",
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
