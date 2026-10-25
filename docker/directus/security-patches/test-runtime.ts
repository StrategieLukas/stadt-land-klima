/** Explicit, offline regressions against the actual rebuilt vendor bytes and resolved dependencies. */
import { dependencyReplacements } from "./dependency-replacements.ts";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createServer, Agent as HttpAgent } from "node:http";
import { isIP } from "node:net";

const require = createRequire("/directus/package.json");
const root = dirname(require.resolve("@directus/api/package.json"));
const api = createRequire(join(root, "package.json"));
const silent = { warn() {}, error() {}, info() {} };
function load(file: string, dependencies: Record<string, unknown> = {}): Record<string, any> {
  const source = readFileSync(join(root, file), "utf8");
  const names = /export \{ ([^}]+) \};/.exec(source)?.[1];
  assert.ok(names, `Expected reviewed exports in ${file}`);
  const code = source
    .replace(/^import .*;\r?\n/gm, "")
    .replace(/export \{ [^}]+ \};/, "")
    .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(join(root, file)).href));
  return runInNewContext(`(function(){${code}; return {${names}};})()`, {
    URL,
    Uint8Array,
    Buffer,
    console,
    setTimeout,
    clearTimeout,
    useEnv: () => ({}),
    useLogger: () => silent,
    ...dependencies,
  }) as Record<string, any>;
}
let passed = 0;
async function check(name: string, run: () => Promise<void> | void) {
  await run();
  passed++;
  console.info(`PASS ${name}`);
}

await check("unauthorized flow/user deletion has no cleanup side effects", async () => {
  for (const [file, name] of [
    ["flows", "FlowsService"],
    ["users", "UsersService"],
  ]) {
    let writes = 0;
    let deny = true;
    const knex = () => ({
      update: () => {
        writes++;
        return { whereIn: async () => {} };
      },
    });
    class ItemsService {
      knex = knex;
      accountability = { user: null, role: null };
      schema = {};
      async deleteMany() {
        return ["id"];
      }
    }
    const validateAccess = async () => {
      if (deny) throw new Error("FORBIDDEN");
    };
    const service = new (load(`dist/services/${file}.js`, {
      ItemsService,
      validateAccess,
      validateRemainingAdminUsers: async () => {},
      getFlowManager: () => ({ reload: async () => {} }),
    })[name])({ knex, accountability: { user: null, role: null } });
    service.clearUserSessions = async () => {};
    await assert.rejects(service.deleteMany(["id"]), /FORBIDDEN/);
    assert.equal(writes, 0);
    deny = false;
    await service.deleteMany(["id"]);
    assert.equal(writes, file === "users" ? 3 : 1);
  }
});

await check("shares flush permissions only after an authorized mutation", async () => {
  let cleared = 0;
  let deny = true;
  class ItemsService {
    async updateMany() {
      if (deny) throw Error("FORBIDDEN");
      return ["id"];
    }
    async deleteMany() {
      if (deny) throw Error("FORBIDDEN");
      return ["id"];
    }
  }
  const { SharesService } = load("dist/services/shares.js", {
    ItemsService,
    clearCache: async () => {
      cleared++;
    },
  });
  for (const method of ["updateMany", "deleteMany"]) {
    deny = true;
    await assert.rejects(new SharesService()[method](["id"], {}), /FORBIDDEN/);
    assert.equal(cleared, method === "updateMany" ? 0 : 1);
    deny = false;
    await new SharesService()[method](["id"], {});
  }
  assert.equal(cleared, 2);
});

await check("settings/deployment side effects follow successful mutations", async () => {
  let reports = 0;
  class ItemsService {
    knex = { select: () => ({ from: () => ({ first: async () => ({ project_id: "id" }) }) }) };
    async upsertSingleton() {
      throw Error("FORBIDDEN");
    }
  }
  const { SettingsService } = load("dist/services/settings.js", {
    ItemsService,
    sendReport: async () => {
      reports++;
    },
    version: "11.17.4",
  });
  await assert.rejects(new SettingsService().setOwner({}), /FORBIDDEN/);
  assert.equal(reports, 0);
  let webhooks = 0;
  class DeploymentItems {
    async deleteOne() {
      throw Error("FORBIDDEN");
    }
  }
  const { DeploymentService } = load("dist/services/deployment.js", {
    ItemsService: DeploymentItems,
    getMilliseconds: () => 1000,
  });
  const service = new DeploymentService();
  service.readByProvider = async () => ({ id: "id", webhook_ids: ["hook"] });
  service.getDriver = async () => ({
    unregisterWebhook: async () => {
      webhooks++;
    },
  });
  await assert.rejects(service.deleteByProvider("provider"), /FORBIDDEN/);
  assert.equal(webhooks, 0);
  let deleted = false;
  service.deleteOne = async () => {
    deleted = true;
    return "id";
  };
  service.getDriver = async () => {
    assert.equal(deleted, false, "resolve credentials before deleting their row");
    return {
      unregisterWebhook: async () => {
        assert.equal(deleted, true);
        webhooks++;
      },
    };
  };
  assert.equal(await service.deleteByProvider("provider"), "id");
  assert.equal(webhooks, 1);
});

await check("manual flow rejects anonymous/share callers and preserves authenticated/webhook execution", async () => {
  const flow = { id: "manual", trigger: "manual", options: { collections: ["articles"], requireSelection: false } };
  class FlowsService {
    async readByQuery() {
      return [flow];
    }
  }
  const { getFlowManager } = load("dist/flows.js", {
    FlowsService,
    PQueue: class {
      pending = 0;
    },
    useBus: () => ({ subscribe() {} }),
    database_default: () => ({}),
    getSchema: async () => ({}),
    constructFlowTree: (value: unknown) => value,
    ForbiddenError: Error,
  });
  const manager = getFlowManager();
  await manager.load();
  let executed = 0;
  manager.executeFlow = async () => {
    executed++;
  };
  for (const accountability of [
    undefined,
    { user: null, role: null, admin: false },
    { share: "share", user: null, role: null },
  ])
    await assert.rejects(
      manager.runWebhookFlow("POST-manual", { body: { collection: "articles" } }, { accountability }),
    );
  assert.equal(executed, 0);
  await manager.runWebhookFlow(
    "POST-manual",
    { body: { collection: "articles" } },
    { accountability: { user: "user", admin: true } },
  );
  assert.equal(executed, 1);
  // Webhook registration remains a separate, unchanged branch, exercised by application mail workflows.
});

await check(
  "minimal AND persisted wildcard settings grants conceal sensitive fields while preserving editor model choices",
  () => {
    const { systemFieldRows, appAccessMinimalPermissions } = api("@directus/system-data");
    const { withAppMinimalPermissions } = load("dist/permissions/lib/with-app-minimal-permissions.js", {
      systemFieldRows,
      appAccessMinimalPermissions,
      cloneDeep: structuredClone,
      filterItems: (items: unknown) => items,
    });
    const permission = { collection: "directus_settings", action: "read", fields: ["*"] };
    for (const app of [true, false]) {
      const result = withAppMinimalPermissions({ app, admin: false }, [permission]);
      for (const row of result.filter((row: any) => row.collection === "directus_settings")) {
        assert.ok(!row.fields.includes("*"));
        assert.ok(!row.fields.includes("ai_openai_compatible_headers"));
        assert.ok(!row.fields.includes("ai_system_prompt"));
        assert.ok(!row.fields.includes("mcp_system_prompt"));
        assert.ok(row.fields.includes("project_name"));
        assert.ok(row.fields.includes("ai_openai_compatible_models"));
      }
    }
    assert.deepEqual(withAppMinimalPermissions({ app: false, admin: true }, [permission]), [permission]);
  },
);

await check("mail rendering rejects traversal/symlinks and preserves layouts and bundled templates", async () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-vendor-mail-"));
  try {
    const templates = join(directory, "templates");
    mkdirSync(templates);
    writeFileSync(join(directory, "private.liquid"), "PRIVATE");
    symlinkSync(join(directory, "private.liquid"), join(templates, "escape.liquid"));
    writeFileSync(join(templates, "base.liquid"), "Welcome {% block body %}{% endblock %}");
    writeFileSync(join(templates, "safe.liquid"), '{% layout "base" %}{% block body %}{{name}}{% endblock %}');
    const { MailService } = load("dist/services/mail/index.js", {
      useEnv: () => ({ EMAIL_TEMPLATES_PATH: templates }),
      path,
      fileURLToPath,
      Liquid: api("liquidjs").Liquid,
      fse: api("fs-extra"),
      InvalidPayloadError: Error,
      getMailer: () => ({}),
      database_default: () => ({}),
    });
    const mail = new MailService({ schema: {} });
    assert.match(await mail.renderTemplate("safe", { name: "Grüße" }), /Welcome Grüße/);
    for (const name of ["../../private", "/tmp/private", "..\\private", "escape", "safe/../private", "safe\0"])
      await assert.rejects(mail.renderTemplate(name, {}));
    const { MailService: DefaultMail } = load("dist/services/mail/index.js", {
      useEnv: () => ({ EMAIL_TEMPLATES_PATH: join(directory, "missing-custom-root") }),
      path,
      fileURLToPath,
      Liquid: api("liquidjs").Liquid,
      fse: api("fs-extra"),
      InvalidPayloadError: Error,
      getMailer: () => ({}),
      database_default: () => ({}),
    });
    assert.ok(
      (
        await new DefaultMail({ schema: {} }).renderTemplate("password-reset", {
          projectName: "Test",
          url: "https://example.org/reset",
        })
      ).length > 0,
    );
    const engine = new (api("liquidjs").Liquid)();
    assert.doesNotMatch(await engine.parseAndRender("{%assign r=1|valueOf%}{{r|inspect}}"), /context|renderer|scopes/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

await check("AI downloads use validated HTTP agents, bounded transfers and no environment proxy", async () => {
  let options: any;
  const calls: any[] = [];
  const { createUiStream } = load("dist/ai/chat/lib/create-ui-stream.js", {
    getDevToolsMiddleware: () => null,
    buildProviderConfigs: () => [{ type: "test" }],
    createAIProviderRegistry: () => ({ languageModel: () => ({}) }),
    getProviderOptions: () => ({}),
    getAITelemetryConfig: () => null,
    SYSTEM_PROMPT: "",
    applyAnthropicToolSearch: (_p: unknown, _m: unknown, tools: unknown) => tools,
    convertToModelMessages: async (messages: unknown) => messages,
    transformFilePartsForProvider: (messages: unknown) => messages,
    stepCountIs: () => ({}),
    streamText: (value: unknown) => {
      options = value;
    },
    getAxios: async () => ({
      get: async (url: string, config: unknown) => {
        calls.push({ url, config });
        return { data: Buffer.from("safe"), headers: { "content-type": "text/plain" } };
      },
    }),
  });
  await createUiStream([], { provider: "test", model: "test", tools: {}, aiSettings: {} });
  const downloaded = await options.experimental_download([
    { url: new URL("https://example.org/file"), isUrlSupportedByModel: false },
  ]);
  assert.equal(Buffer.from(downloaded[0].data).toString(), "safe");
  assert.equal(calls[0].config.proxy, false);
  assert.equal(calls[0].config.maxContentLength, 10485760);
  assert.equal(calls[0].config.maxRedirects, 5);
  for (const url of ["file:///etc/passwd", "http://user:password@example.org/"])
    await assert.rejects(options.experimental_download([{ url: new URL(url), isUrlSupportedByModel: false }]));
  assert.equal(calls.length, 1);
  // Exercise the REAL Directus connection-time IP validator, including redirects/DNS.
  process.env.IMPORT_IP_DENY_LIST =
    "0.0.0.0,127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.169.254,::1/128,fc00::/7,fe80::/10";
  const { getAxios } = await import(pathToFileURL(join(root, "dist/request/index.js")).href);
  let reached = 0;
  const server = createServer((_req, res) => {
    reached++;
    res.end("PRIVATE");
  });
  await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    for (const host of ["127.0.0.1", "localhost", "0.0.0.0"])
      await assert.rejects((await getAxios()).get(`http://${host}:${address.port}`, { proxy: false, timeout: 3000 }));
    assert.equal(reached, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

await check("HTTP redirects cannot escape connection-time IP validation", async () => {
  const { agentWithIpValidation } = load("dist/request/agent-with-ip-validation.js", {
    isIP,
    isDeniedIp: (address: string) => address === "127.0.0.2",
  });
  let secretReads = 0;
  const server = createServer((request, response) => {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: `http://127.0.0.2:${address.port}/secret` });
      response.end();
    } else {
      secretReads++;
      response.end("PRIVATE");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
  const agent = agentWithIpValidation(new HttpAgent());
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const axios = api("axios").default;
    await assert.rejects(
      axios.get(`http://127.0.0.1:${address.port}/redirect`, { httpAgent: agent, proxy: false, timeout: 3000 }),
      /denied IP/,
    );
    assert.equal(secretReads, 0);
    const dnsAgent = agentWithIpValidation(
      new HttpAgent({
        lookup: ((_host: string, options: { all?: boolean }, done: (...args: any[]) => void) => {
          if (options.all) setImmediate(() => done(null, [{ address: "127.0.0.2", family: 4 }]));
          else setImmediate(() => done(null, "127.0.0.2", 4));
        }) as any,
      }),
    );
    try {
      await assert.rejects(
        axios.get(`http://public-looking.invalid:${address.port}/secret`, {
          httpAgent: dnsAgent,
          proxy: false,
          timeout: 3000,
        }),
        /denied IP/,
      );
      assert.equal(secretReads, 0);
    } finally {
      dnsAgent.destroy();
    }
  } finally {
    agent.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

await check("patched image processing and mail APIs preserve maintained operations", async () => {
  const sharp = api("sharp");
  const output = await sharp(
    Buffer.from('<svg width="20" height="10"><rect width="20" height="10" fill="green"/></svg>'),
  )
    .resize(10, 5)
    .png()
    .toBuffer();
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 10);
  assert.equal(metadata.height, 5);
  const transport = api("nodemailer").createTransport({
    jsonTransport: true,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const message = await transport.sendMail({
    from: "test@example.org",
    to: "recipient@example.org",
    subject: "Grüße",
    html: "<p>Safe message</p>",
  });
  assert.equal(JSON.parse(message.message).subject, "Grüße");
  const streamTransport = api("nodemailer").createTransport({
    streamTransport: true,
    buffer: true,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  await assert.rejects(
    streamTransport.sendMail({ from: "test@example.org", to: "recipient@example.org", raw: { path: "/etc/passwd" } }),
  );
});

await check("streamed JSON preserves hostile property names as data and bounds nested parser/filter work", async () => {
  const { pipeline } = await import("node:stream/promises");
  const { Readable, Writable } = await import("node:stream");
  const assemblerRequire = createRequire(join(root, "package.json"));
  const streamJson = assemblerRequire("stream-json");
  const Assembler = assemblerRequire("stream-json/Assembler.js");
  const assembler = new Assembler();
  const parser = streamJson.parser();
  assembler.connectTo(parser);
  await pipeline(
    Readable.from(['{"__proto__":{"polluted":true},"value":1}']),
    parser,
    new Writable({
      objectMode: true,
      write(_chunk, _encoding, done) {
        done();
      },
    }),
  );
  assert.ok(Object.hasOwn(assembler.current, "__proto__"));
  assert.equal(assembler.current.polluted, undefined);
  assert.equal(assembler.current.value, 1);
  await assert.rejects(
    pipeline(
      Readable.from(["[".repeat(140) + "0" + "]".repeat(140)]),
      streamJson.parser(),
      new Writable({
        objectMode: true,
        write(_chunk, _encoding, done) {
          done();
        },
      }),
    ),
    /nesting limit/,
  );
});

await check("every bundled vulnerable-library location resolves to the reviewed replacement", async () => {
  const { readdirSync } = await import("node:fs");
  for (const { name, original, version } of dependencyReplacements) {
    const prefix = `${name.replace("/", "+")}@${original}`;
    const entries = readdirSync("/directus/node_modules/.pnpm").filter(
      (entry) => entry === prefix || entry.startsWith(prefix + "_"),
    );
    assert.ok(entries.length);
    for (const entry of entries)
      assert.equal(
        JSON.parse(readFileSync(`/directus/node_modules/.pnpm/${entry}/node_modules/${name}/package.json`, "utf8"))
          .version,
        version,
      );
  }
  const proxy = api("proxy-addr");
  assert.equal(proxy.compile("::ffff:10.0.0.0/8")("203.0.113.1"), false);
  const replacement = createRequire("/opt/slk-directus-runtime-security/package.json");
  const git = replacement("simple-git").simpleGit();
  assert.equal(typeof (await git.version()).installed, "boolean");
  const unsafeVisual = replacement("simple-git")
    .simpleGit()
    .env({ ...process.env, VISUAL: "echo unsafe" });
  await assert.rejects(unsafeVisual.raw(["var", "GIT_EDITOR"]), /unsafe|allowUnsafeEditor/i);
  await assert.rejects(
    git.raw(["-c", "trailer.test.cmd=echo unsafe", "interpret-trailers"]),
    /unsafe|allowUnsafeCommandBinaries/i,
  );
});
console.info(`Pinned Directus image: ${passed}/${passed} security regressions passed`);
