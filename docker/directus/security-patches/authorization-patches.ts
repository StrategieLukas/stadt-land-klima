/** Exact-source backports for Directus 11.17.4. See SECURITY_HARDENING.md. */
export const authorizationPatches: { file: string; sha256: string; replacements: [string, string][] }[] = [
  {
    file: "dist/services/flows.js",
    sha256: "83e0926c0b1a1ec43afa3166a60544e5622d31096addfd8334244d528fcda744",
    replacements: [
      [
        'import { ItemsService } from "./items.js";',
        'import { ItemsService } from "./items.js";\nimport { validateAccess } from "../permissions/modules/validate-access/validate-access.js";',
      ],
      [
        "\tasync deleteMany(keys, opts) {",
        '\tasync deleteMany(keys, opts) {\n\t\tif (this.accountability) await validateAccess({ accountability: this.accountability, action: "delete", collection: "directus_flows", primaryKeys: keys }, { knex: this.knex, schema: this.schema });',
      ],
    ],
  },
  {
    file: "dist/services/users.js",
    sha256: "b52f89d0c43b9fe5d713ec1b76b2141ff23fd1f049109bdb932b624b803b4b62",
    replacements: [
      [
        'import { ItemsService } from "./items.js";',
        'import { ItemsService } from "./items.js";\nimport { validateAccess } from "../permissions/modules/validate-access/validate-access.js";',
      ],
      [
        "\tasync deleteMany(keys, opts = {}) {",
        '\tasync deleteMany(keys, opts = {}) {\n\t\tif (this.accountability) await validateAccess({ accountability: this.accountability, action: "delete", collection: "directus_users", primaryKeys: keys }, { knex: this.knex, schema: this.schema });',
      ],
    ],
  },
  {
    file: "dist/services/shares.js",
    sha256: "719256eddbb3cc19c4ea4378129552221c615f3a174211e7569ef3bfe7ae7d5b",
    replacements: [
      [
        "\t\tawait clearCache();\n\t\treturn super.updateMany(keys, data, opts);",
        "\t\tconst result = await super.updateMany(keys, data, opts);\n\t\tawait clearCache();\n\t\treturn result;",
      ],
      [
        "\t\tawait clearCache();\n\t\treturn super.deleteMany(keys, opts);",
        "\t\tconst result = await super.deleteMany(keys, opts);\n\t\tawait clearCache();\n\t\treturn result;",
      ],
    ],
  },
  {
    file: "dist/services/settings.js",
    sha256: "c6bfeac86b1da5df3920bd88d11b3dfacc89729cab0f9b76bae35789b6fb99dc",
    replacements: [
      [
        '\t\tsendReport({\n\t\t\t...data,\n\t\t\tproject_id,\n\t\t\tversion\n\t\t}).catch(async () => {\n\t\t\tawait this.knex.update("project_status", "pending").from("directus_settings");\n\t\t});\n',
        "",
      ],
      ["\t\treturn await this.upsertSingleton({", "\t\tconst result = await this.upsertSingleton({"],
      [
        "\t\t\tproject_status: null\n\t\t});",
        '\t\t\tproject_status: null\n\t\t});\n\t\tsendReport({\n\t\t\t...data,\n\t\t\tproject_id,\n\t\t\tversion\n\t\t}).catch(async () => {\n\t\t\tawait this.knex.update("project_status", "pending").from("directus_settings");\n\t\t});\n\t\treturn result;',
      ],
    ],
  },
  {
    file: "dist/services/deployment.js",
    sha256: "c7b5e171b710058b663cdbe41135827fccb17056570914622b22923fa719438c",
    replacements: [
      [
        "\t\tconst deployment = await this.readByProvider(provider);\n\t\tif (deployment.webhook_ids",
        "\t\tconst deployment = await this.readByProvider(provider);\n\t\tconst slkDriver = deployment.webhook_ids && deployment.webhook_ids.length > 0 ? await this.getDriver(provider) : null;\n\t\tconst primaryKey = await this.deleteOne(deployment.id);\n\t\tif (deployment.webhook_ids",
      ],
      ["\t\treturn this.deleteOne(deployment.id);", "\t\treturn primaryKey;"],
      [
        "await (await this.getDriver(provider)).unregisterWebhook(deployment.webhook_ids);",
        "await slkDriver.unregisterWebhook(deployment.webhook_ids);",
      ],
    ],
  },
  {
    file: "dist/flows.js",
    sha256: "c4313f7e5ce2618c4a63d72862690a4a17a990ec8e4265257547e1d0b9a0c1f7",
    replacements: [
      [
        "\t\t\t\t\tif (!accountability) {",
        "\t\t\t\t\tif (!accountability || (!accountability.user && !accountability.role)) {",
      ],
    ],
  },
  {
    file: "dist/permissions/lib/with-app-minimal-permissions.js",
    sha256: "1b0f36d465cf849a34a7652ece47b976555bfb642fd4d6cc4c8637d9d2dc6888",
    replacements: [
      ["import { appAccessMinimalPermissions }", "import { appAccessMinimalPermissions, systemFieldRows }"],
      [
        "\t\treturn [...permissions, ...filteredAppMinimalPermissions];",
        "\t\tpermissions = [...permissions, ...filteredAppMinimalPermissions];",
      ],
      [
        "\treturn permissions;",
        "\n  if (accountability && accountability.admin !== true) {\n    const allowed = systemFieldRows.filter(row => row.collection === 'directus_settings' && !['ai_openai_compatible_headers', 'ai_openai_compatible_base_url', 'ai_system_prompt', 'mcp_system_prompt', 'mcp_prompts_collection', 'mcp_prompts_collection_validation'].includes(row.field)).map(row => row.field);\n    permissions = permissions.map(permission => {\n      if (permission.collection !== 'directus_settings' || permission.action !== 'read') return permission;\n      const fields = permission.fields || [];\n      return { ...permission, fields: fields.includes('*') ? allowed : fields.filter(field => allowed.includes(field)) };\n    });\n  }\n\treturn permissions;",
      ],
    ],
  },
  {
    file: "dist/services/mail/index.js",
    sha256: "1cf3247f94657f2263a4aa29298b5424c4c193467f84a5c1dabf14ffa05d0b26",
    replacements: [
      [
        "\tasync renderTemplate(template, variables) {",
        "\tasync renderTemplate(template, variables) {\n    if (typeof template !== 'string' || !/^[A-Za-z0-9_-]+$/.test(template)) throw new InvalidPayloadError({ reason: 'Invalid mail template name' });\n",
      ],
      [
        '\t\tconst templateString = await fse.readFile(templatePath, "utf8");',
        "\n    const realTemplatePath = await fse.realpath(templatePath);\n    const roots = await Promise.all([env['EMAIL_TEMPLATES_PATH'], path.join(__dirname, 'templates')].map(root => fse.realpath(root).catch(error => { if (error.code === 'ENOENT') return null; throw error; })));\n    if (!roots.some(root => { if (!root) return false; const relative = path.relative(root, realTemplatePath); return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); })) throw new InvalidPayloadError({ reason: 'Mail template is outside the templates directory' });\n\t\tconst templateString = await fse.readFile(realTemplatePath, \"utf8\");",
      ],
    ],
  },
  {
    file: "dist/request/is-denied-ip.js",
    sha256: "ae7ded6364a6c1022c8352371ec63540eed58fec2a01befd60801b30bf69e3ef",
    replacements: [
      [
        '\t\tif (blockNetwork === "0.0.0.0") {',
        "\t\tif (blockNetwork === \"0.0.0.0\") {\n\t\t\tblockList.parseSubnet('0.0.0.0/8');\n\t\t\tblockList.parseAddress('::');",
      ],
    ],
  },
  {
    file: "dist/ai/chat/lib/create-ui-stream.js",
    sha256: "526b9d58c4c021d26fa785612de50c68915845a3033b19d3176922a6b47bf063",
    replacements: [
      [
        "import { getDevToolsMiddleware }",
        'import { getAxios } from "../../../request/index.js";\nimport { getDevToolsMiddleware }',
      ],
      [
        "\treturn streamText({",
        "\treturn streamText({\n    // Never use the AI SDK's plain fetch for user-controlled attachments.\n    experimental_download: async (requests) => Promise.all(requests.map(async ({url, isUrlSupportedByModel}) => {\n      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid AI attachment URL');\n      if (isUrlSupportedByModel) return null;\n      const response = await (await getAxios()).get(url.toString(), { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 10485760, maxBodyLength: 10485760, maxRedirects: 5, proxy: false });\n      return {data: new Uint8Array(response.data), mediaType: response.headers['content-type']};\n    })),",
      ],
    ],
  },
];
