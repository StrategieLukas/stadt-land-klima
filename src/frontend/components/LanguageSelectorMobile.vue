<template>
  <div class="flex min-h-[44px] w-full items-center bg-orange" :class="{ 'rounded-b-none': dropdownOpen }">
    <button class="flex w-full items-center justify-between" @click="toggleDropdown">
      <div class="flex items-center">
        <img :src="`${baseDirectusUrl}assets/${currentFlag}`" :alt="currentLanguage" class="h-4 w-6 rounded" />
        <span class="ml-2">{{ currentLanguage }}</span>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        fill="currentColor"
        class="h-4 transition-transform duration-300"
        :class="{ 'rotate-180': dropdownOpen }"
      >
        <path
          d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"
        />
      </svg>
    </button>
    <transition name="fade-slide">
      <div v-if="dropdownOpen" class="absolute left-0 top-full z-10 w-full text-sm font-bold shadow-lg">
        <div
          v-for="(lang, idx) in availableLanguages"
          :key="lang.code"
          class="flex h-10 w-full cursor-pointer select-none items-center space-x-2 bg-orange px-4 text-white hover:brightness-110"
          :class="{ 'rounded-b-lg': idx === availableLanguages.length - 1 }"
          @click="switchLanguage(lang)"
        >
          <img :src="`${baseDirectusUrl}assets/${lang.flag}`" :alt="lang.code" class="h-4 w-6 rounded" />
          <label>{{ lang.code }}</label>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { fetchAndApplyTranslations } from "#shared/loadTranslations";

const { $directus, $readItems, $i18n } = useNuxtApp();
const { locale, setLocale } = useI18n();
const runtimeConfig = useRuntimeConfig();
let baseDirectusUrl = runtimeConfig.public.clientDirectusUrl || "http://localhost:8081/";
if (!baseDirectusUrl.endsWith("/")) {
  baseDirectusUrl += "/";
}

const { data: fetchedLanguages } = await fetchLanguages();

const languages = computed(() => {
  return fetchedLanguages.value.map((language) => {
    const parts = language.code.split("-");
    const languageCode = parts[0].toUpperCase();
    return {
      code: languageCode,
      flag: language.flag,
      iso: language.code,
    };
  });
});

const currentLanguage = ref(locale.value.split("-")[0].toUpperCase());
const currentFlag = ref(languages.value.find((lang) => lang.iso === locale.value).flag);
const dropdownOpen = ref(false);

const toggleDropdown = () => {
  dropdownOpen.value = !dropdownOpen.value;
};

const switchLanguage = async (lang) => {
  currentLanguage.value = lang.code;
  currentFlag.value = lang.flag;
  dropdownOpen.value = false;
  console.log("Switching to language: ", lang.iso);
  await setLocale(lang.iso);
  console.log("current locale: ", locale.value);
  await fetchAndApplyTranslations($i18n, $directus);
};

const availableLanguages = computed(() => {
  return languages.value.filter((lang) => lang.code !== currentLanguage.value);
});
</script>

<style scoped>
button {
  transition: background-color 0.3s ease-in-out;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    transform 0.3s ease-in-out,
    opacity 0.3s ease-in-out;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  transform: translateY(-50%);
  opacity: 0;
}
</style>
