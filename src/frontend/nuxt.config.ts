// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/leaflet'
  ],
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
      // Listmonk Newsletter Configuration
      listmonkEndpoint: process.env.NUXT_PUBLIC_LISTMONK_ENDPOINT,
      listmonkApiToken: process.env.NUXT_PUBLIC_LISTMONK_API_TOKEN,
      listmonkListId: process.env.NUXT_PUBLIC_LISTMONK_LIST_ID || '1',
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
     server: {
       hmr: {
         protocol: 'ws',
         host: '0.0.0.0',
         port: 24678,
       },
       watch: {
         usePolling: true,
       },
     },
  },
})
