<template>
  <div
    class="inline-flex rounded-md bg-white/10 p-1 shadow-sm ring-1 ring-inset ring-white/25"
    role="group"
    aria-label="Sprache / Language"
  >
    <button
      v-for="language in languages"
      :key="language.locale"
      type="button"
      class="inline-flex h-9 min-w-0 items-center gap-2 rounded px-3 text-sm font-bold transition-colors"
      :class="selectedLocale === language.locale
        ? 'bg-white text-olive-green shadow-sm'
        : 'text-white hover:bg-white/15'"
      :aria-pressed="selectedLocale === language.locale"
      @click="changeLanguage(language.locale)"
    >
      <span aria-hidden="true" class="text-base leading-none">{{ language.flag }}</span>
      <span>{{ language.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
type LanguageOption = {
  flag: string;
  label: string;
  locale: string;
};

const languages: LanguageOption[] = [
  { flag: "🇩🇪", label: "Deutsch", locale: "de-DE" },
  { flag: "🇬🇧", label: "English", locale: "en-GB" },
];

const localeCookie = useCookie<string>("slk_locale", {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
const { $locale } = useNuxtApp() as unknown as { $locale: string };
const selectedLocale = ref(
  languages.some((language) => language.locale === $locale) ? $locale : "de-DE",
);

function changeLanguage(locale: string) {
  if (locale === $locale) {
    return;
  }

  selectedLocale.value = locale;
  localeCookie.value = locale;

  if (import.meta.client) {
    window.location.reload();
  }
}
</script>
