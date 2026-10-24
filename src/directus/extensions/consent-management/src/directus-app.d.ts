import "vue";

// Directus provides the Vue I18n translation function to Data Studio extensions.
declare module "vue" {
  interface ComponentCustomProperties {
    $t: (key: string) => string;
  }
}
