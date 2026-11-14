// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { resolveSiteOrigin } from "./shared/serviceUrl";
import { frontendRuntimeEnvironment } from "./shared/runtimeEnvironment";

import { staticIconStyleHashes } from "./scripts/securityStyles.mts";

if (process.env.NODE_ENV !== "production") Object.assign(process.env, frontendRuntimeEnvironment(process.env));

export default defineNuxtConfig({
  telemetry: false,
  typescript: {
    strict: true,
    typeCheck: "build",
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        allowJs: false,
      },
      vueCompilerOptions: {
        strictTemplates: true,
        htmlAttributes: ["aria-*", "data-*", "title"],
        fallthroughAttributes: true,
        checkUnknownEvents: true,
      },
    },
  },
  // Preserve the existing source layout for Nuxt 4 compatibility
  srcDir: ".",
  dir: {
    app: "app",
  },
  modules: ["@nuxtjs/leaflet", "@blokkli/editor", "nuxt-security"],
  security: {
    enabled: process.env.NODE_ENV === "production" || process.env.SLK_ENV === "production",
    nonce: true,
    sri: true,
    removeLoggers: false,
    // API routes enforce their own bounded bodies (including 50 MB editor uploads).
    rateLimiter: false,
    requestSizeLimiter: false,
    xssValidator: false,
    corsHandler: false,
    allowedMethodsRestricter: false,
    csrf: false,
    hidePoweredBy: false,
    headers: {
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
      originAgentCluster: false,
      referrerPolicy: false,
      strictTransportSecurity: false,
      xContentTypeOptions: false,
      xDNSPrefetchControl: false,
      xDownloadOptions: false,
      xFrameOptions: false,
      xPermittedCrossDomainPolicies: false,
      xXSSProtection: false,
      permissionsPolicy: false,
      contentSecurityPolicy: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'self'"],
        "script-src": ["'self'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
        "script-src-attr": ["'none'"],
        "style-src": ["'self'", "'nonce-{{nonce}}'", ...staticIconStyleHashes()],
        // Vue/map/chart sizing uses style attributes, not executable scripts.
        "style-src-attr": ["'unsafe-inline'"],
        "img-src": ["'self'", "https:", "data:", "blob:"],
        "font-src": ["'self'", "https:", "data:"],
        "media-src": ["'self'", "https:", "blob:"],
        "connect-src": ["'self'", "https:", "wss:"],
        "worker-src": ["'self'", "blob:"],
        "frame-src": [
          "'self'",
          "https://www.betterplace-widget.org",
          "https://www.youtube-nocookie.com",
          "https://www.youtube.com",
          "https://player.vimeo.com",
          "https://app.cal.com",
          "https://cal.com",
        ],
        "report-uri": ["/api/security/csp"],
        "upgrade-insecure-requests": false,
      },
    },
  },

  // Blökkli 2 uses the custom Directus adapter and the existing block bundles.
  blokkli: {
    itemEntityType: "block",
    defaultLanguage: "de",
    globalOptions: {
      anchor: {
        type: "text",
        label: "Anker",
        default: "",
        inputType: "text",
        group: "Link & Anker",
      },
    },
    // Block components location pattern
    pattern: ["~/components/Blokkli/**/*.vue"],
  },
  runtimeConfig: {
    contentTranslationEnabled: false,
    contentTranslationGenerationEnabled: false,
    contentTranslationWorkerToken: "",
    deeplApiKey: "",
    deeplApiEndpoint: "auto",
    deeplModel: "prefer_quality_optimized",
    deeplGlossaryEn: "",
    deeplGlossaryIt: "",
    deeplPolicyRevision: "v1",
    // The private keys which are only available within server-side
    meilisearchUrl: "",
    meilisearchMasterKey: "",
    editorSessionSecret: "",
    candidateSessionSecret: "",
    altchaSecret: "",
    directusFlowRegisterMunicipality: "",
    directusFlowNotifyAdmin: "",
    directusFlowWelcomeEmail: "",
    listmonkEndpoint: "",
    listmonkApiUsername: "",
    listmonkApiToken: "",
    listmonkListId: "",
    directusServerUrl: "http://directus:8055",
    directusAdminToken: "",
    directusFrontendServerToken: "",
    directusPreviewToken: "",
    appPublicUrl: "",
    directusPublicUrl: "",
    adminNotificationEmail: "",
    erfolgsprojekteNotificationEmail: "presse@stadt-land-klima.de",
    formResponseNotificationEmail: "info@stadt-land-klima.de",
    welcomeEmailTutorialUrl: "",
    welcomeEmailCalendarUrl: "",
    welcomeEmailSignalUrl: "",
    // Private Stadtlandzahl upstream configuration. Browser requests use the
    // same-origin proxy exposed through public.stadtlandzahlBaseUrl below.
    stadtlandzahlBaseUrl: "",
    // Server-side base URL for stadtlandzahl backend (container name/URL, no path).
    stadtlandzahlServerBaseUrl: "",
    stadtlandzahlBasicAuthUser: "",
    stadtlandzahlBasicAuthPassword: "",
    frontendBasicAuthUsername: "",
    frontendBasicAuthPassword: "",
    cartoBasemapApiKey: "",
    // Keys within public, will be also exposed to the client-side
    public: {
      siteUrl: resolveSiteOrigin(undefined),
      // Browser Directus tokens removed — all content data is served through Nuxt server routes.
      // The Frontend-Public policy is limited to directus_files/directus_folders read only.
      clientDirectusUrl: "",
      serverDirectusUrl: "",
      appEnv: "production",
      captchaDevBypass: false,
      plausibleAnalyticsUrl: "",
      plausibleAnalyticsDomain: "",
      // Same-origin browser proxy. The real upstream URL and credentials stay private.
      stadtlandzahlBaseUrl: "/api/stadtlandzahl",
    },
  },
  hooks: {
    "app:resolve"(app) {
      // Nuxt's development overlay forwards raw browser messages/stacks over HMR
      // and prints them on the server. Fixed security diagnostics replace it.
      app.plugins = app.plugins.filter(
        (plugin) =>
          !/\/nuxt\/dist\/app\/plugins\/dev-error-overlay\.client(?:\.js)?$/.test(plugin.src.replaceAll("\\", "/")),
      );
      // Vendor DevTools eagerly import storage-dependent code. Keep their order,
      // but load them only in a top-level development page with usable storage.
      for (const plugin of app.plugins) {
        const source = plugin.src.replaceAll("\\", "/");
        if (/(?:^|\/)(?:runtime\.)?vue-devtools-client(?:\.[^/]+)?\.js$/.test(source)) {
          plugin.src = fileURLToPath(new URL("./app/optionalVueDevtools.client.ts", import.meta.url));
        } else if (/\/@nuxt\/devtools\/dist\/runtime\/plugins\/devtools\.client\.js$/.test(source)) {
          plugin.src = fileURLToPath(new URL("./app/optionalNuxtDevtools.client.ts", import.meta.url));
        }
      }
    },
  },
  devtools: {
    enabled:
      process.env.NODE_ENV !== "production" &&
      process.env.SLK_ENV !== "production" &&
      process.env.APP_ENV !== "production",
  },
  app: {
    rootAttrs: {
      id: "nuxt-root",
    },
    head: {
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
      script: [
        {
          innerHTML: `(function(){try{var key='slk_theme_preference';var light='staedteChallemgeTheme';var dark='staedteChallengeDark';var pref=localStorage.getItem(key);var mode=pref==='light'||pref==='dark'?pref:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.dataset.theme=mode==='dark'?dark:light;root.classList.remove('dark');root.style.colorScheme=mode;}catch(e){}})();`,
        },
      ],
    },
  },
  css: [
    "maplibre-gl/dist/maplibre-gl.css",
    "~/assets/css/vega-embed.css",
    "~/assets/css/vega-tooltip.css",
    "~/assets/css/main.css",
  ],
  routeRules: {
    "/api/**": { security: { enabled: false } },
    "/embed/wahlcheck/*": {
      security: {
        headers: {
          contentSecurityPolicy: {
            "frame-ancestors": [
              "'self'",
              "https://localzero.net",
              "https://www.localzero.net",
              "https://germanzero.de",
              "https://www.germanzero.de",
            ],
          },
        },
      },
    },
    "/**": {
      headers: { "Referrer-Policy": "strict-origin-when-cross-origin" },
    },
    "/api/area-children": { isr: 86400 },
    // The HTML hydration payload can contain an authorized draft too.
    "/municipalities/**": {
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    },
  },
  nitro: {
    errorHandler: fileURLToPath(new URL("./server/errorHandler.ts", import.meta.url)),
    preset: "node-server",
    rollupConfig: {
      plugins: [
        {
          // Handles `import foo from '~/...svg?raw'` in the Nitro/SSR bundle.
          // Regular .svg imports (used as <img src>) now use /public/icons/ paths instead.
          name: "svg-raw-loader",
          transform(code: string, id: string) {
            if (id.includes(".svg")) {
              return { code: `export default ${JSON.stringify(code)}`, map: null };
            }
            return undefined;
          },
        },
      ],
    },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^zod$/, replacement: fileURLToPath(new URL("./shared/zod.ts", import.meta.url)) },
        { find: /^@vue\/devtools-api$/, replacement: fileURLToPath(new URL("./app/devtoolsApi.ts", import.meta.url)) },
      ],
    },
    optimizeDeps: {
      // These app libraries are also used inside virtual editor components,
      // which the dependency scanner cannot read from disk.
      include: [
        "@apollo/client/core",
        "@directus/sdk",
        "@iconify/vue",
        "altcha/external",
        "entities",
        "zod/v4",
        "@vue-leaflet/vue-leaflet",
        "@maplibre/maplibre-gl-style-spec",
        "graphql-tag",
        "html-to-image",
        "leaflet",
        "linkify-string",
        "lodash",
        "maplibre-gl",
        "markdown-it",
        "ml-pca",
        "sanitize-html",
        "vega-embed",
        "vue-chartjs",
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "blokkli-editing-files",
        enforce: "pre",
        resolveId: {
          order: "pre",
          async handler(id, importer, options) {
            // Vite 8's dependency scanner reads Vue files directly from disk.
            // Blökkli's editing variants are virtual files served by its loader;
            // skip them only during scanning, keeping normal dev/build loading.
            const editing = id.includes("__blokkli_editing__") || /[?&]blokkliEditing=true(?:&|$)/.test(id);
            if (!editing) return undefined;
            if ("scan" in options && options.scan === true) {
              return { id, external: true };
            }
            // Vite's browser URLs are relative to the project root. Resolve
            // virtual Vue files (including their script/style requests) before
            // plugin-vue can mistake those URLs for absolute filesystem paths.
            if (/^\/(?:components|node_modules)\//.test(id)) {
              const url = new URL(`.${id}`, import.meta.url);
              const filename = fileURLToPath(url);
              const root = fileURLToPath(new URL(".", import.meta.url));
              if (filename.startsWith(root)) {
                return this.resolve(filename + url.search, importer, { ...options, skipSelf: true });
              }
            }
            return undefined;
          },
        },
      },
    ],
    server: {
      // Directus reaches the development proxy over the Podman service hostname.
      allowedHosts: ["frontend"],
    },
    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    },
  },
  vue: {
    compilerOptions: {
      // Treat altcha-widget as a native custom element so Vue doesn't try to resolve it as a component
      isCustomElement: (tag: string) => tag === "altcha-widget",
    },
  },
});
