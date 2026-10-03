<template>
  <div
    class="inline-flex rounded-md p-1 ring-1 ring-inset"
    :class="themeClasses.wrapper"
    role="group"
    :aria-label="$t('language_selector.aria_label')"
  >
    <button
      v-for="language in languages"
      :key="language.locale"
      type="button"
      class="inline-flex min-w-0 items-center rounded font-bold transition-colors"
      :class="[sizeClasses, selectedLocale === language.locale ? themeClasses.active : themeClasses.inactive]"
      :aria-label="$t(language.labelKey)"
      :aria-pressed="selectedLocale === language.locale"
      @click="changeLanguage(language.locale)"
    >
      <Icon :icon="language.icon" :ssr="true" aria-hidden="true" class="h-3 w-4 flex-shrink-0 ring-1 ring-black/15" />
      <span class="uppercase">{{ language.shortLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Icon, addIcon } from "@iconify/vue";

type LanguageOption = {
  icon: string;
  labelKey: string;
  locale: string;
  shortLabel: string;
};

const languages: LanguageOption[] = [
  { icon: "flag:de-4x3", labelKey: "language_selector.language.de", locale: "de-DE", shortLabel: "DE" },
  { icon: "flag:gb-4x3", labelKey: "language_selector.language.en", locale: "en-GB", shortLabel: "EN" },
  { icon: "flag:it-4x3", labelKey: "language_selector.language.it", locale: "it-IT", shortLabel: "IT" },
];

const flagIconSize = { height: 480, width: 640 };
addIcon("flag:de-4x3", {
  ...flagIconSize,
  body: `<path fill="#fc0" d="M0 320h640v160H0z"/><path fill="#000001" d="M0 0h640v160H0z"/><path fill="red" d="M0 160h640v160H0z"/>`,
});
addIcon("flag:gb-4x3", {
  ...flagIconSize,
  body: `<path fill="#012169" d="M0 0h640v480H0z"/><path fill="#fff" d="m75 0l244 181L562 0h78v62L400 241l240 178v61h-80L320 301L81 480H0v-60l239-178L0 64V0z"/><path fill="#c8102e" d="m424 281l216 159v40L369 281zm-184 20l6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z"/><path fill="#fff" d="M241 0v480h160V0zM0 160v160h640V160z"/><path fill="#c8102e" d="M0 193v96h640v-96zM273 0v480h96V0z"/>`,
});
addIcon("flag:it-4x3", {
  ...flagIconSize,
  body: `<path fill="#fff" d="M0 0h640v480H0z"/><path fill="#009246" d="M0 0h213.3v480H0z"/><path fill="#ce2b37" d="M426.7 0H640v480H426.7z"/>`,
});

const props = withDefaults(
  defineProps<{
    size?: "default" | "compact";
    variant?: "footer" | "header";
  }>(),
  {
    size: "default",
    variant: "footer",
  },
);

const sizeClasses = computed(() =>
  props.size === "compact" ? "h-8 gap-1 px-2 text-xs" : "h-9 gap-1.5 px-2.5 text-sm sm:gap-2 sm:px-3",
);

const themeClasses = computed(() => {
  if (props.variant === "header") {
    return {
      active: "bg-olive-green text-white",
      inactive:
        "text-[var(--slk-text-muted)] hover:bg-[var(--slk-surface-subdued)] hover:text-[var(--slk-text-strong)]",
      wrapper: "bg-[var(--slk-surface)] ring-[var(--slk-border)]",
    };
  }

  return {
    active: "bg-white text-olive-green shadow-sm",
    inactive: "text-white hover:bg-green",
    wrapper: "bg-olive-green ring-white",
  };
});

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
