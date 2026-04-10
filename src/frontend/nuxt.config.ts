// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/leaflet',
    '@blokkli/editor',
  ],
  
  // blökkli configuration
  blokkli: {
    itemEntityType: 'block',
    defaultLanguage: 'de',
    // Block components location pattern
    pattern: ['components/Blokkli/**/*.vue'],
  },
  runtimeConfig: {
    // The private keys which are only available within server-side
    meilisearchUrl: process.env.MEILISEARCH_URL,
    meilisearchMasterKey: process.env.MEILISEARCH_MASTER_KEY,
    altchaSecret: process.env.ALTCHA_SECRET,
    directusFlowRegisterMunicipality: process.env.DIRECTUS_FLOW_REGISTER_MUNICIPALITY,
    // Keys within public, will be also exposed to the client-side
    public: {
      directusToken: process.env.DIRECTUS_TOKEN,
      clientDirectusUrl: process.env.CLIENT_DIRECTUS_URL,
      serverDirectusUrl: process.env.SERVER_DIRECTUS_URL,
      appEnv: process.env.APP_ENV,
      plausibleAnalyticsUrl: process.env.PLAUSIBLE_ANALYTICS_URL,
      plausibleAnalyticsDomain: process.env.PLAUSIBLE_ANALYTICS_DOMAIN,
      stadtlandzahlUrl: process.env.STADTLANDZAHL_URL,
    },
  },
  devtools: { enabled: true },
  app: {
    rootAttrs: {
      id: 'nuxt-root',
    },
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },
  css: ["~/assets/css/main.css"],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  nitro: {
    preset: 'node-server',
    workers: 1, // Avoid spawning too many workers in limited environments
    routeRules: {
      '/**': {
        headers: { 'Referrer-Policy': 'strict-origin-when-cross-origin' },
      },
    },
    rollupConfig: {
      plugins: [
        {
          name: 'svg-raw-loader',
          transform(code: string, id: string) {
            if (id.endsWith('.svg')) {
              return { code: `export default ${JSON.stringify(code)}`, map: null }
            }
          },
        },
      ],
    },
  },
  vite: {
     define: {
          __VUE_OPTIONS_API__: false,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        },
  },
  vue: {
    compilerOptions: {
      // Treat altcha-widget as a native custom element so Vue doesn't try to resolve it as a component
      isCustomElement: (tag: string) => tag === 'altcha-widget',
    },
  },
})
