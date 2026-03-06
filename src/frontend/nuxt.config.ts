// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/leaflet',
    '@blokkli/editor',
  ],
  
  // blökkli configuration
  blokkli: {
    // Directory where block components are located
    blocksDir: 'components/blocks',
    // Auto-import block components
    autoImport: true,
    // Enable SSR support
    ssr: true,
    // Define available features
    features: [
      'block-add-list',
      'clipboard',
      'command-palette',
      'comments',
      'conversions',
      'debug',
      'delete',
      'diff',
      'dragging-overlay',
      'duplicate',
      'edit',
      'editable-field',
      'edit-form',
      'entity-title',
      'exit',
      'field-areas',
      'fragments',
      'grid',
      'artboard',
      'help',
      'history',
      'import',
      'library',
      'media-library',
      'multiselect',
      'options',
      'ownership',
      'preview',
      'preview-grant',
      'proxy-view',
      'publish',
      'responsive-preview',
      'revert',
      'search',
      'selection',
      'settings',
      'structure',
      'theme',
      'tour',
      'touch-action-bar',
      'transform',
      'translations',
      'validations',
    ],
  },
  runtimeConfig: {
    // The private keys which are only available within server-side
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
  },
  vite: {
     define: {
          __VUE_OPTIONS_API__: false,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        },
  },
})
