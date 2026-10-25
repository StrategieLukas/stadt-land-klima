/** Keep native error diagnostics useful without serializing SQL, provider errors or credentials. */
export const loggingPatches: { file: string; sha256: string; replacements: [string, string][] }[] = [
  {
    file: "dist/middleware/error-handler.js",
    sha256: "e378ba6c737ea809d73c2808d98484305018b4b036f8f6747580873f3f1c2ae0",
    replacements: [
      ["logger.debug(error);", "// Expected Directus errors are recorded by the sanitized HTTP completion logger."],
      [
        "logger.error(error);",
        'logger.error({ event: "directus.internal_error", userId: req.accountability?.user ?? null, actorType: req.accountability?.user ? "user" : "anonymous", requestId: req.slkLogRequestId ?? null, severity: "error" }, "Directus request failed");',
      ],
      [
        'useLogger().error(error, "Unexpected error in error handler");',
        'useLogger().error({ event: "directus.error_handler.failed", userId: req.accountability?.user ?? null, actorType: req.accountability?.user ? "user" : "anonymous", requestId: req.slkLogRequestId ?? null, severity: "error" }, "Directus error handler failed");',
      ],
    ],
  },
  {
    file: "dist/emitter.js",
    sha256: "cedcaa4ea47f38c254a861c0c9ed4c6eb54ffa128b76b3785fbd2a07dc665e2e",
    replacements: [
      [
        'logger.warn(`An error was thrown while executing action "${event$1}"`);\n\t\t\tlogger.warn(err);',
        `const slkContext = globalThis[Symbol.for("stadt-land-klima.security-log-context.v1")]?.getStore();
        const slkUser = context?.accountability?.user ?? slkContext?.authenticatedUser ?? slkContext?.user() ?? null;
        const slkStatus = typeof err?.status === "number" ? err.status : typeof err?.statusCode === "number" ? err.statusCode : 500;
        const slkLevel = slkStatus >= 500 ? "error" : [401, 403, 409, 429].includes(slkStatus) ? "warn" : "info";
        logger[slkLevel]({event: "directus.action.failed", userId: slkUser, actorType: slkUser ? "user" : slkContext ? "anonymous" : "system", requestId: slkContext?.requestId ?? null, status: slkStatus, severity: slkLevel}, "Directus action failed");`,
      ],
      [
        'logger.warn(`An error was thrown while executing init "${event}"`);\n\t\t\tlogger.warn(err);',
        'logger.error({event: "directus.initialization.failed", userId: null, actorType: "system", severity: "error"}, "Directus initialization failed");',
      ],
    ],
  },
  {
    file: "dist/flows.js",
    sha256: "c4313f7e5ce2618c4a63d72862690a4a17a990ec8e4265257547e1d0b9a0c1f7",
    replacements: [
      [
        "logger.error(error);",
        `const slkStatus = typeof error?.status === "number" ? error.status : 500;
      const slkLevel = slkStatus >= 500 ? "error" : [401, 403, 409, 429].includes(slkStatus) ? "warn" : "info";
      logger[slkLevel]({event: "directus.scheduled_flow.failed", userId: null, actorType: "system", resource: "directus_flows", resourceId: flow.id, status: slkStatus, severity: slkLevel}, "Directus scheduled flow failed");`,
      ],
    ],
  },
  {
    file: "dist/services/mail/index.js",
    sha256: "1cf3247f94657f2263a4aa29298b5424c4c193467f84a5c1dabf14ffa05d0b26",
    replacements: [
      [
        "logger.warn(`Email connection failed:`);\n\t\t\t\tlogger.warn(error);",
        'logger.error({event: "directus.mail.connection_failed", userId: this.accountability?.user ?? null, actorType: this.accountability?.user ? "user" : "system", severity: "error"}, "Directus mail connection failed");',
      ],
    ],
  },
];
