/** Legacy environment names mapped to Nuxt runtime overrides on every process start. */
export const FRONTEND_RUNTIME_ALIASES: Readonly<Record<string, string>> = {
  CONTENT_TRANSLATION_ENABLED: "NUXT_CONTENT_TRANSLATION_ENABLED",
  CONTENT_TRANSLATION_GENERATION_ENABLED: "NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED",
  CONTENT_TRANSLATION_WORKER_TOKEN: "NUXT_CONTENT_TRANSLATION_WORKER_TOKEN",
  DEEPL_API_KEY: "NUXT_DEEPL_API_KEY",
  DEEPL_API_ENDPOINT: "NUXT_DEEPL_API_ENDPOINT",
  DEEPL_MODEL: "NUXT_DEEPL_MODEL",
  DEEPL_GLOSSARY_EN: "NUXT_DEEPL_GLOSSARY_EN",
  DEEPL_GLOSSARY_IT: "NUXT_DEEPL_GLOSSARY_IT",
  DEEPL_POLICY_REVISION: "NUXT_DEEPL_POLICY_REVISION",
  MEILISEARCH_URL: "NUXT_MEILISEARCH_URL",
  EDITOR_SESSION_SECRET: "NUXT_EDITOR_SESSION_SECRET",
  CANDIDATE_SESSION_SECRET: "NUXT_CANDIDATE_SESSION_SECRET",
  ALTCHA_SECRET: "NUXT_ALTCHA_SECRET",
  DIRECTUS_FLOW_REGISTER_MUNICIPALITY: "NUXT_DIRECTUS_FLOW_REGISTER_MUNICIPALITY",
  DIRECTUS_FLOW_NOTIFY_ADMIN: "NUXT_DIRECTUS_FLOW_NOTIFY_ADMIN",
  DIRECTUS_FLOW_WELCOME_EMAIL: "NUXT_DIRECTUS_FLOW_WELCOME_EMAIL",
  LISTMONK_ENDPOINT: "NUXT_LISTMONK_ENDPOINT",
  LISTMONK_API_USERNAME: "NUXT_LISTMONK_API_USERNAME",
  LISTMONK_API_TOKEN: "NUXT_LISTMONK_API_TOKEN",
  LISTMONK_LIST_ID: "NUXT_LISTMONK_LIST_ID",
  SERVER_DIRECTUS_URL: "NUXT_DIRECTUS_SERVER_URL",
  DIRECTUS_ADMIN_TOKEN: "NUXT_DIRECTUS_ADMIN_TOKEN",
  DIRECTUS_FRONTEND_SERVER_TOKEN: "NUXT_DIRECTUS_FRONTEND_SERVER_TOKEN",
  DIRECTUS_PREVIEW_TOKEN: "NUXT_DIRECTUS_PREVIEW_TOKEN",
  PUBLIC_URL: "NUXT_APP_PUBLIC_URL",
  CLIENT_DIRECTUS_URL: "NUXT_DIRECTUS_PUBLIC_URL",
  ADMIN_NOTIFICATION_EMAIL: "NUXT_ADMIN_NOTIFICATION_EMAIL",
  ERFOLGSPROJEKTE_NOTIFICATION_EMAIL: "NUXT_ERFOLGSPROJEKTE_NOTIFICATION_EMAIL",
  WELCOME_EMAIL_TUTORIAL_URL: "NUXT_WELCOME_EMAIL_TUTORIAL_URL",
  WELCOME_EMAIL_CALENDAR_URL: "NUXT_WELCOME_EMAIL_CALENDAR_URL",
  WELCOME_EMAIL_SIGNAL_URL: "NUXT_WELCOME_EMAIL_SIGNAL_URL",
  STADTLANDZAHL_BASE_URL: "NUXT_STADTLANDZAHL_BASE_URL",
  STADTLANDZAHL_SERVER_BASE_URL: "NUXT_STADTLANDZAHL_SERVER_BASE_URL",
  STADTLANDZAHL_BASE_HTTP_BASIC_AUTH_USER: "NUXT_STADTLANDZAHL_BASIC_AUTH_USER",
  STADTLANDZAHL_BASE_HTTP_BASIC_AUTH_PASSWORD: "NUXT_STADTLANDZAHL_BASIC_AUTH_PASSWORD",
  FRONTEND_BASIC_AUTH_USERNAME: "NUXT_FRONTEND_BASIC_AUTH_USERNAME",
  FRONTEND_BASIC_AUTH_PASSWORD: "NUXT_FRONTEND_BASIC_AUTH_PASSWORD",
  CARTO_BASEMAP_API_KEY: "NUXT_CARTO_BASEMAP_API_KEY",
};

/** Build profile and deployment target are separate: staging can run production builds. */
export function translationDeploymentTarget(profile: string | undefined, target?: string): string {
  if (target !== undefined && !["production", "staging", "future", "development"].includes(target))
    throw new Error("Invalid SLK_DEPLOYMENT_TARGET");
  return profile === "production" ? (target ?? "production") : "development";
}

export function frontendRuntimeEnvironment(input: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const environment = { ...input };
  const set = (key: string, value: string | undefined) => {
    if (environment[key] === undefined && value !== undefined) environment[key] = value;
  };
  for (const [key, alias] of Object.entries(FRONTEND_RUNTIME_ALIASES)) {
    const value = input[key];
    const boolean = key === "CONTENT_TRANSLATION_ENABLED" || key === "CONTENT_TRANSLATION_GENERATION_ENABLED";
    set(alias, boolean && value !== undefined ? String(value === "true") : value);
  }
  if (translationDeploymentTarget(input.SLK_ENV, input.SLK_DEPLOYMENT_TARGET) !== "production")
    environment.NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED = "false";
  set("NUXT_MEILISEARCH_MASTER_KEY", input.MEILISEARCH_MASTER_KEY ?? input.MEILI_MASTER_KEY);
  set(
    "NUXT_FORM_RESPONSE_NOTIFICATION_EMAIL",
    input.FORM_RESPONSE_NOTIFICATION_EMAIL ?? input.ADMIN_NOTIFICATION_EMAIL,
  );
  set("NUXT_PUBLIC_SITE_URL", input.PUBLIC_URL);
  set("NUXT_PUBLIC_CLIENT_DIRECTUS_URL", input.CLIENT_DIRECTUS_URL);
  set("NUXT_PUBLIC_SERVER_DIRECTUS_URL", input.SERVER_DIRECTUS_URL);
  set("NUXT_PUBLIC_PLAUSIBLE_ANALYTICS_URL", input.PLAUSIBLE_ANALYTICS_URL);
  set("NUXT_PUBLIC_PLAUSIBLE_ANALYTICS_DOMAIN", input.PLAUSIBLE_ANALYTICS_DOMAIN);
  // Nuxt Security reads these runtime overrides too; CMS origin changes must
  // retain asset access without compiling an environment-specific CSP.
  try {
    const cms = new URL(environment.NUXT_PUBLIC_CLIENT_DIRECTUS_URL || "");
    if (["http:", "https:"].includes(cms.protocol) && !cms.username && !cms.password) {
      set(
        "NUXT_SECURITY_HEADERS_CONTENT_SECURITY_POLICY_IMG_SRC",
        JSON.stringify(["'self'", "https:", "data:", "blob:", cms.origin]),
      );
      set(
        "NUXT_SECURITY_HEADERS_CONTENT_SECURITY_POLICY_MEDIA_SRC",
        JSON.stringify(["'self'", "https:", "blob:", cms.origin]),
      );
    }
  } catch {
    /* An invalid CMS origin must not enter security headers. */
  }
  const production = input.NODE_ENV === "production" || input.SLK_ENV === "production";
  set("NUXT_PUBLIC_APP_ENV", production ? "production" : (input.APP_ENV ?? input.SLK_ENV ?? "production"));
  environment.NUXT_PUBLIC_CAPTCHA_DEV_BYPASS = String(
    !production &&
      (input.SLK_ENV === "development" || input.APP_ENV === "development") &&
      (!input.ALTCHA_SECRET || input.ALTCHA_SECRET === "dev-secret-change-in-production"),
  );
  return environment;
}
