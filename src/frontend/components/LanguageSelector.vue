<template>
  <div
    class="inline-flex rounded-md p-1 shadow-sm ring-1 ring-inset"
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
      <Icon :icon="language.icon" :ssr="true" aria-hidden="true" class="h-5 w-5 flex-shrink-0" />
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
  { icon: "circle-flags:de", labelKey: "language_selector.language.de", locale: "de-DE", shortLabel: "DE" },
  { icon: "circle-flags:gb", labelKey: "language_selector.language.en", locale: "en-GB", shortLabel: "EN" },
  { icon: "circle-flags:it", labelKey: "language_selector.language.it", locale: "it-IT", shortLabel: "IT" },
];

const flagIconSize = { height: 512, width: 512 };
addIcon("circle-flags:de", {
  ...flagIconSize,
  body: `<mask id="SVGuywqVbel"><circle cx="256" cy="256" r="256" fill="#fff"/></mask><g mask="url(#SVGuywqVbel)"><path fill="#ffda44" d="m0 345l256.7-25.5L512 345v167H0z"/><path fill="#d80027" d="m0 167l255-23l257 23v178H0z"/><path fill="#333" d="M0 0h512v167H0z"/></g>`,
});
addIcon("circle-flags:gb", {
  ...flagIconSize,
  body: `<mask id="SVGuywqVbel"><circle cx="256" cy="256" r="256" fill="#fff"/></mask><g mask="url(#SVGuywqVbel)"><path fill="#eee" d="m0 0l8 22l-8 23v23l32 54l-32 54v32l32 48l-32 48v32l32 54l-32 54v68l22-8l23 8h23l54-32l54 32h32l48-32l48 32h32l54-32l54 32h68l-8-22l8-23v-23l-32-54l32-54v-32l-32-48l32-48v-32l-32-54l32-54V0l-22 8l-23-8h-23l-54 32l-54-32h-32l-48 32l-48-32h-32l-54 32L68 0z"/><path fill="#0052b4" d="M336 0v108L444 0Zm176 68L404 176h108zM0 176h108L0 68ZM68 0l108 108V0Zm108 512V404L68 512ZM0 444l108-108H0Zm512-108H404l108 108Zm-68 176L336 404v108z"/><path fill="#d80027" d="M0 0v45l131 131h45zm208 0v208H0v96h208v208h96V304h208v-96H304V0zm259 0L336 131v45L512 0zM176 336L0 512h45l131-131zm160 0l176 176v-45L381 336z"/></g>`,
});
addIcon("circle-flags:it", {
  ...flagIconSize,
  body: `<mask id="SVGuywqVbel"><circle cx="256" cy="256" r="256" fill="#fff"/></mask><g mask="url(#SVGuywqVbel)"><path fill="#eee" d="M167 0h178l25.9 252.3L345 512H167l-29.8-253.4z"/><path fill="#6da544" d="M0 0h167v512H0z"/><path fill="#d80027" d="M345 0h167v512H345z"/></g>`,
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
      active: "bg-olive-green text-white shadow-sm",
      inactive: "text-gray-600 hover:bg-light-green/15 hover:text-olive-green",
      wrapper: "bg-white ring-gray-200",
    };
  }

  return {
    active: "bg-white text-olive-green shadow-sm",
    inactive: "text-white hover:bg-white/15",
    wrapper: "bg-white/10 ring-white/25",
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
