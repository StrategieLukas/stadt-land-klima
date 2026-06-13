<template>
  <div
    class="inline-flex rounded-md bg-white/10 p-1 shadow-sm ring-1 ring-inset ring-white/25"
    role="group"
    :aria-label="$t('language_selector.aria_label')"
  >
    <button
      v-for="language in languages"
      :key="language.locale"
      type="button"
      class="inline-flex h-9 min-w-0 items-center gap-1.5 rounded px-2.5 text-sm font-bold transition-colors sm:gap-2 sm:px-3"
      :class="
        selectedLocale === language.locale ? 'bg-white text-olive-green shadow-sm' : 'text-white hover:bg-white/15'
      "
      :aria-label="$t(language.labelKey)"
      :aria-pressed="selectedLocale === language.locale"
      @click="changeLanguage(language.locale)"
    >
      <span aria-hidden="true" class="text-base leading-none">{{ language.flag }}</span>
      <span class="uppercase">{{ language.shortLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
type LanguageOption = {
  flag: string;
  labelKey: string;
  locale: string;
  shortLabel: string;
};

const languages: LanguageOption[] = [
  { flag: "🇩🇪", labelKey: "language_selector.language.de", locale: "de-DE", shortLabel: "DE" },
  { flag: "🇬🇧", labelKey: "language_selector.language.en", locale: "en-GB", shortLabel: "EN" },
  { flag: "🇮🇹", labelKey: "language_selector.language.it", locale: "it-IT", shortLabel: "IT" },
];

const localeCookie = useCookie<string>("slk_locale", {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
const { $locale, $t } = useNuxtApp() as unknown as {
  $locale: string;
  $t: (key: string) => string;
};
const selectedLocale = ref(languages.some((language) => language.locale === $locale) ? $locale : "de-DE");

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
