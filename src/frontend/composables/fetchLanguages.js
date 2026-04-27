import { useNuxtApp, useAsyncData } from "#app";

export async function fetchLanguages() {
  const { $directus, $readItems } = useNuxtApp();
  return useAsyncData("fetchedLanguages", () => {
    return $directus.request(
      $readItems("languages", {
        limit: -1,
      }),
    );
  });
}
