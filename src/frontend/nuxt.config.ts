// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxtjs/leaflet", "@nuxtjs/i18n"],

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

  i18n: {
    strategy: "prefix",
    defaultLocale: "de-DE",
    locales: [
      {
        code: "de-DE",
      },
      {
        code: "it-IT",
      },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: "root",
    },
  },

  plugins: [
    "~/plugins/directus.server.js",
    "~/plugins/directus.client.js",
    "~/plugins/i18n.init.js",
    "~/plugins/embed-calender.client.js",
  ],

  nitro: {
    preset: "node-server"
  },

  compatibilityDate: "2025-09-13",
});