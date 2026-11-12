import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { performStack, runtime } from "./stack.ts";
import { checkCoreData, upgradeCore } from "./core.ts";
import { databaseTransfer, sanitize, migrate, databaseRole, extensions, tests, update } from "./operations.ts";
import { hostEnvironment } from "./host-environment.ts";
import { createBundle, verifyBundle } from "../lib/portable-backup.ts";
import { prepareCmsOrigin, restoreCmsOrigin } from "../lib/cms-origin.ts";
import { run, root, CommandError, type Environment } from "./process.ts";

process.umask(0o077);
const passthrough = (args: unknown): string[] => (Array.isArray(args) ? args.map(String) : []);
const parser = yargs(hideBin(process.argv))
  .scriptName("slk")
  .usage("$0 <group> <action> [options] [-- tool arguments]")
  .option("env", {
    alias: "e",
    choices: ["development", "production"] as const,
    default: "development" as Environment,
    description: "Target deployment",
  })
  .parserConfiguration({ "populate--": true, "boolean-negation": false })
  .strict()
  .demandCommand(1)
  .help()
  .wrap(Math.min(110, process.stdout.columns || 110))
  .command(
    "stack <action> [services..]",
    "Build, run and inspect the rootless Podman stack",
    (p) =>
      p
        .positional("action", {
          choices: [
            "doctor",
            "build",
            "start",
            "prepare",
            "restart",
            "stop",
            "audit",
            "compose",
            "maintenance",
          ] as const,
        })
        .positional("services", { type: "string", array: true, default: [] })
        .option("import", { type: "boolean", default: false, description: "Import YAML after CMS readiness" })
        .option("prepare-only", { type: "boolean", default: false })
        .option("no-directus-build", { type: "boolean", default: false })
        .option("no-frontend-build", { type: "boolean", default: false }),
    async (argv) => {
      const args = [...(argv.services ?? []), ...passthrough(argv["--"])];
      await performStack(argv.env, argv.action!, args, {
        import: argv.import,
        prepareOnly: argv.prepareOnly,
        noDirectusBuild: argv.noDirectusBuild,
        noFrontendBuild: argv.noFrontendBuild,
      });
    },
  )
  .command(
    "database <action>",
    "Backups, SQL, sanitization, role hardening and verified core upgrades",
    (p) =>
      p
        .positional("action", { choices: ["export", "import", "sql", "sanitize", "check", "upgrade", "role"] as const })
        .option("apply", { type: "boolean", default: false, description: "Apply a core upgrade after verification" })
        .option("logical", { type: "boolean", default: false, description: "Restore into new named volumes" }),
    async (argv) => {
      const rt = await runtime(argv.env),
        args = passthrough(argv["--"]);
      switch (argv.action) {
        case "export":
        case "import":
        case "sql":
          await databaseTransfer(rt, argv.action, args);
          break;
        case "sanitize":
          await sanitize(rt);
          break;
        case "check":
          await checkCoreData(rt);
          break;
        case "upgrade":
          await upgradeCore(rt, argv.apply, argv.logical);
          break;
        case "role":
          await databaseRole(rt, args);
          break;
      }
    },
  )
  .command(
    "cms <action>",
    "Import/export YAML, open a shell or apply registered migrations",
    (p) => p.positional("action", { choices: ["import", "export", "shell", "migrate", "cli"] as const }),
    async (argv) => {
      const rt = await runtime(argv.env),
        args = passthrough(argv["--"]);
      if (argv.action === "migrate") await migrate(rt);
      else
        await rt.compose([
          "exec",
          ...(argv.action === "shell" ? [] : ["-T"]),
          "directus",
          ...(argv.action === "shell"
            ? ["bash"]
            : argv.action === "cli"
              ? ["node", "/directus/cli/index.mjs"]
              : [`/directus/cli/${argv.action}-all.sh`]),
          ...args,
        ]);
    },
  )
  .command(
    "frontend <action>",
    "Open the frontend runtime shell",
    (p) => p.positional("action", { choices: ["shell"] as const }),
    async (argv) => {
      await (await runtime(argv.env)).compose(["exec", "frontend", "bash", ...passthrough(argv["--"])]);
    },
  )
  .command(
    "extensions <action>",
    "Check or compile every maintained CMS extension",
    (p) => p.positional("action", { choices: ["check", "build"] as const }),
    async (argv) => {
      await extensions(argv.action === "build");
    },
  )
  .command(
    "test <target>",
    "Run regression, runtime, dependency or deployment checks",
    (p) =>
      p.positional("target", {
        choices: [
          "dev",
          "full",
          "staging",
          "unit",
          "podman",
          "caddy",
          "dependencies",
          "images",
          "logical",
          "runtime",
        ] as const,
      }),
    async (argv) => {
      await tests(argv.target!, passthrough(argv["--"]));
    },
  )
  .command(
    "backup <action> [directory]",
    "Create or verify a complete private Podman recovery bundle",
    (p) =>
      p
        .positional("action", { choices: ["create", "verify"] as const })
        .positional("directory", { type: "string" })
        .option("project", { type: "string" })
        .option("output", { type: "string" })
        .option("config", { type: "string", array: true, default: [] })
        .option("writers-stopped", { type: "boolean", default: false }),
    async (argv) => {
      if (argv.action === "verify") {
        if (!argv.directory) throw new Error("Provide a backup directory to verify");
        await verifyBundle(argv.directory);
        console.log("All backup checksums verified.");
      } else {
        const project = argv.project ?? process.env.SLK_PODMAN_PROJECT;
        if (!project || !argv.output) throw new Error("Provide --project and --output for the stopped source stack");
        console.log(
          await createBundle({
            engine: "podman",
            project,
            output: argv.output,
            configs: argv.config,
            writersStopped: argv.writersStopped,
          }),
        );
      }
    },
  )
  .command(
    "release <action> <config> <tag> <previous>",
    "Stage, back up, activate or roll back an application release",
    (p) =>
      p
        .positional("action", { choices: ["backup", "stage", "stage-prebuilt", "activate", "rollback"] as const })
        .positional("config", { type: "string" })
        .positional("tag", { type: "string" })
        .positional("previous", { type: "string" }),
    async (argv) => {
      if (argv.env !== "production") throw new Error("Release operations require explicit --env production");
      await run("bash", [root + "podman/release/run.sh", argv.config!, argv.action!, argv.tag!, argv.previous!], {
        env: hostEnvironment(argv.config!, false),
      });
    },
  )
  .command(
    "cms-origin <action> <config> <state> [origin]",
    "Checkpoint or restore private CMS origin settings",
    (p) =>
      p
        .positional("action", { choices: ["prepare", "restore"] as const })
        .positional("config", { type: "string" })
        .positional("state", { type: "string" })
        .positional("origin", { type: "string" }),
    async (argv) => {
      try {
        if (argv.action === "prepare") {
          if (!argv.origin) throw new Error("Provide the HTTPS CMS origin");
          console.log(JSON.stringify(prepareCmsOrigin(argv.config!, argv.state!, argv.origin)));
        } else {
          restoreCmsOrigin(argv.config!, argv.state!);
          console.log("Private origin configuration restored");
        }
      } catch {
        throw new Error("CMS origin update failed; private configuration values are withheld");
      }
    },
  )
  .command(
    "deploy <action>",
    "Update a deployment or explicitly deploy the external staging checkout",
    (p) =>
      p
        .positional("action", { choices: ["update", "staging"] as const })
        .option("no-backup", { type: "boolean", default: false })
        .option("no-restart", { type: "boolean", default: false })
        .option("no-directus-build", { type: "boolean", default: false })
        .option("no-frontend-build", { type: "boolean", default: false }),
    async (argv) => {
      if (argv.action === "staging")
        await run("ssh", ["deploy@staging", "cd slk-testing && git pull && ./bin/slk deploy update --env development"]);
      else
        await update(argv.env, {
          noBackup: argv.noBackup,
          noRestart: argv.noRestart,
          noDirectusBuild: argv.noDirectusBuild,
          noFrontendBuild: argv.noFrontendBuild,
        });
    },
  )
  .example("$0 stack build --env production", "Build application/data/maintenance images")
  .example("$0 stack start --env production --import", "Start and import YAML")
  .example("$0 stack restart frontend --env production", "Reload edited runtime settings")
  .example("$0 stack compose --env development -- exec -T directus node --version", "Forward provider options after --")
  .example("$0 database export --env production > backup.sql", "Export through the bootstrap operator")
  .example("$0 test dev", "Run the required development regression suite")
  .showHelpOnFail(false)
  .fail((message, error) => {
    throw error ?? new Error(message);
  })
  .exitProcess(false);
try {
  await parser.parseAsync();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Command failed");
  process.exitCode = error instanceof CommandError ? error.code : 1;
}
