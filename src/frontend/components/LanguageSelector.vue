<template>
  <label class="form-control w-full max-w-48 text-left">
    <span class="label py-0 pb-1">
      <span class="label-text text-xs text-current opacity-80">Sprache / Language</span>
    </span>
    <select
      v-model="selectedLocale"
      class="select select-bordered select-sm min-h-9 bg-white text-neutral"
      aria-label="Sprache / Language"
      @change="changeLanguage"
    >
      <option
        v-for="language in languages"
        :key="language.locale"
        :value="language.locale"
      >
        {{ language.label }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
type LanguageOption = {
  label: string;
  locale: string;
};

const languages: LanguageOption[] = [
  { label: "Deutsch", locale: "de-DE" },
  { label: "English", locale: "en-US" },
];

const localeCookie = useCookie<string>("slk_locale", {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
const { $locale } = useNuxtApp() as unknown as { $locale: string };
const selectedLocale = ref(
  languages.some((language) => language.locale === $locale) ? $locale : "de-DE",
);

function changeLanguage() {
  if (selectedLocale.value === $locale) {
    return;
  }

  localeCookie.value = selectedLocale.value;

  if (import.meta.client) {
    window.location.reload();
  }
}
</script>
