<template>
  <div class="relative inline-block">
    <button
      class="flex h-10 w-full items-center justify-between space-x-2 bg-orange px-4 py-2 text-sm font-bold text-white hover:brightness-110"
      @click="toggleDropdown"
    >
      <div class="flex items-center space-x-2">
        <img :src="`${baseDirectusUrl}assets/${currentFlag}`" :alt="currentLanguage" class="h-4 w-6 rounded" />
        <span class="font-medium text-white">{{ currentLanguage }}</span>
      </div>
      <FontAwesomeIcon
        :icon="['fas', 'chevron-down']"
        class="h-4 w-4 text-white transition-transform duration-300"
        :class="{ 'rotate-180': dropdownOpen }"
      />
    </button>
    <transition name="fade-slide">
      <div v-if="dropdownOpen" class="absolute left-0 top-full z-10 w-full text-sm font-bold shadow-lg">
        <div
          v-for="lang in availableLanguages"
          :key="lang.code"
          class="flex h-10 w-full cursor-pointer select-none items-center space-x-2 px-4 bg-orange text-white hover:brightness-110"
          @click="switchLanguage(lang)"
        >
          <img :src="`${baseDirectusUrl}assets/${lang.flag}`" :alt="lang.code" class="h-4 w-6 rounded" />
          <label class="font-medium">{{ lang.code }}</label>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { fetchAndApplyTranslations } from "#shared/loadTranslations";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

const { $directus, $readItems, $i18n } = useNuxtApp();
const { locale, setLocale } = useI18n();
const runtimeConfig = useRuntimeConfig();
let baseDirectusUrl = runtimeConfig.public.clientDirectusUrl || "http://localhost:8081/";
if (!baseDirectusUrl.endsWith("/")) {
  baseDirectusUrl += "/";
}

const { data: fetchedLanguages } = await useAsyncData("fetchedLanguages", () => {
  return $directus.request(
    $readItems("languages", {
      limit: -1,
    }),
  );
});

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
  transition:
    border-radius 0.3s ease-in-out,
    background-color 0.3s ease-in-out;
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
