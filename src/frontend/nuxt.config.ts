// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { resolveSiteOrigin } from "./shared/serviceUrl";
import { staticIconStyleHashes } from "./scripts/securityStyles.mts";

const publicCmsOrigins = (() => {
  try {
    const url = new URL(process.env.CLIENT_DIRECTUS_URL || "");
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? [url.origin] : [];
  } catch {
    return [];
  }
})();
export default defineNuxtConfig({
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
        "img-src": ["'self'", "https:", "data:", "blob:", ...publicCmsOrigins],
        "font-src": ["'self'", "https:", "data:"],
        "media-src": ["'self'", "https:", "blob:", ...publicCmsOrigins],
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
    contentTranslationEnabled: process.env.CONTENT_TRANSLATION_ENABLED === "true",
    contentTranslationGenerationEnabled: process.env.CONTENT_TRANSLATION_GENERATION_ENABLED === "true",
    contentTranslationWorkerToken: process.env.CONTENT_TRANSLATION_WORKER_TOKEN ?? "",
    deeplApiKey: process.env.DEEPL_API_KEY ?? "",
    deeplApiEndpoint: process.env.DEEPL_API_ENDPOINT ?? "auto",
    deeplModel: process.env.DEEPL_MODEL ?? "prefer_quality_optimized",
    deeplGlossaryEn: process.env.DEEPL_GLOSSARY_EN ?? "",
    deeplGlossaryIt: process.env.DEEPL_GLOSSARY_IT ?? "",
    deeplPolicyRevision: process.env.DEEPL_POLICY_REVISION ?? "v1",
    // The private keys which are only available within server-side
    meilisearchUrl: process.env.MEILISEARCH_URL ?? "",
    meilisearchMasterKey: process.env.MEILISEARCH_MASTER_KEY ?? process.env.MEILI_MASTER_KEY ?? "",
    editorSessionSecret: process.env.EDITOR_SESSION_SECRET ?? "",
    candidateSessionSecret: process.env.CANDIDATE_SESSION_SECRET ?? "",
    altchaSecret: process.env.ALTCHA_SECRET ?? "",
    directusFlowRegisterMunicipality: process.env.DIRECTUS_FLOW_REGISTER_MUNICIPALITY ?? "",
    directusFlowNotifyAdmin: process.env.DIRECTUS_FLOW_NOTIFY_ADMIN ?? "",
    directusFlowWelcomeEmail: process.env.DIRECTUS_FLOW_WELCOME_EMAIL ?? "",
    listmonkEndpoint: process.env.LISTMONK_ENDPOINT ?? "",
    listmonkApiUsername: process.env.LISTMONK_API_USERNAME ?? "",
    listmonkApiToken: process.env.LISTMONK_API_TOKEN ?? "",
    listmonkListId: process.env.LISTMONK_LIST_ID ?? "",
    directusServerUrl: process.env.SERVER_DIRECTUS_URL ?? "http://directus:8055",
    directusAdminToken: process.env.DIRECTUS_ADMIN_TOKEN ?? "",
    directusFrontendServerToken: process.env.DIRECTUS_FRONTEND_SERVER_TOKEN ?? "",
    directusPreviewToken: process.env.DIRECTUS_PREVIEW_TOKEN ?? "",
    appPublicUrl: process.env.PUBLIC_URL ?? "",
    directusPublicUrl: process.env.CLIENT_DIRECTUS_URL ?? "",
    adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
    erfolgsprojekteNotificationEmail: process.env.ERFOLGSPROJEKTE_NOTIFICATION_EMAIL ?? "presse@stadt-land-klima.de",
    formResponseNotificationEmail:
      process.env.FORM_RESPONSE_NOTIFICATION_EMAIL ??
      process.env.ADMIN_NOTIFICATION_EMAIL ??
      "info@stadt-land-klima.de",
    welcomeEmailTutorialUrl: process.env.WELCOME_EMAIL_TUTORIAL_URL ?? "",
    welcomeEmailCalendarUrl: process.env.WELCOME_EMAIL_CALENDAR_URL ?? "",
    welcomeEmailSignalUrl: process.env.WELCOME_EMAIL_SIGNAL_URL ?? "",
    // Private Stadtlandzahl upstream configuration. Browser requests use the
    // same-origin proxy exposed through public.stadtlandzahlBaseUrl below.
    stadtlandzahlBaseUrl: process.env.STADTLANDZAHL_BASE_URL ?? "",
    // Server-side base URL for stadtlandzahl backend (Docker container name/URL, no path).
    stadtlandzahlServerBaseUrl: process.env.STADTLANDZAHL_SERVER_BASE_URL ?? "",
    stadtlandzahlBasicAuthUser: process.env.STADTLANDZAHL_BASE_HTTP_BASIC_AUTH_USER ?? "",
    stadtlandzahlBasicAuthPassword: process.env.STADTLANDZAHL_BASE_HTTP_BASIC_AUTH_PASSWORD ?? "",
    frontendBasicAuthUsername: process.env.FRONTEND_BASIC_AUTH_USERNAME ?? "",
    frontendBasicAuthPassword: process.env.FRONTEND_BASIC_AUTH_PASSWORD ?? "",
    cartoBasemapApiKey: process.env.CARTO_BASEMAP_API_KEY ?? "",
    // Keys within public, will be also exposed to the client-side
    public: {
      siteUrl: resolveSiteOrigin(process.env.PUBLIC_URL),
      // Browser Directus tokens removed — all content data is served through Nuxt server routes.
      // The Frontend-Public policy is limited to directus_files/directus_folders read only.
      clientDirectusUrl: process.env.CLIENT_DIRECTUS_URL ?? "",
      serverDirectusUrl: process.env.SERVER_DIRECTUS_URL ?? "",
      appEnv:
        process.env.SLK_ENV === "production"
          ? "production"
          : (process.env.APP_ENV ?? process.env.SLK_ENV ?? "production"),
      captchaDevBypass:
        process.env.NODE_ENV !== "production" &&
        process.env.SLK_ENV !== "production" &&
        (process.env.SLK_ENV === "development" || process.env.APP_ENV === "development") &&
        (!process.env.ALTCHA_SECRET || process.env.ALTCHA_SECRET === "dev-secret-change-in-production"),
      plausibleAnalyticsUrl: process.env.PLAUSIBLE_ANALYTICS_URL ?? "",
      plausibleAnalyticsDomain: process.env.PLAUSIBLE_ANALYTICS_DOMAIN ?? "",
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
    resolve: { alias: [{ find: /^zod$/, replacement: fileURLToPath(new URL("./shared/zod.ts", import.meta.url)) }] },
    optimizeDeps: {
      // These app libraries are also used inside virtual editor components,
      // which the dependency scanner cannot read from disk.
      include: [
        "@apollo/client/core",
        "@directus/sdk",
        "@iconify/vue",
        "altcha",
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
      // Directus reaches the development proxy over the Docker service hostname.
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
