<template>
  <img v-if="customLogoUrl" :src="customLogoUrl" :alt="alt" :class="resolvedLogoClass" />
  <template v-else-if="fallback === 'full'">
    <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" :alt="alt" :class="[fallbackClass, 'dark:hidden']" />
    <img
      src="~/assets/images/Stadt-Land-Klima-Logo-dark.svg"
      :alt="alt"
      :class="[fallbackClass, 'hidden dark:block']"
    />
  </template>
  <img
    v-else-if="fallback === 'flower'"
    src="~/assets/images/Stadt-Land-Klima-Blume.svg"
    :alt="alt"
    :class="fallbackClass"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    logo?: string | { id?: string | null } | null;
    fallback?: "full" | "flower" | "none";
    alt?: string;
    logoClass?: string;
    fallbackClass?: string;
  }>(),
  {
    logo: null,
    fallback: "none",
    alt: "",
    logoClass: "",
    fallbackClass: "",
  },
);

const config = useRuntimeConfig();

const logoId = computed(() => {
  if (!props.logo) return null;
  if (typeof props.logo === "string") return props.logo;
  return props.logo.id || null;
});

const customLogoUrl = computed(() => {
  if (!logoId.value) return null;
  const directusUrl = config.public.clientDirectusUrl || "http://127.0.0.1:8081";
  return `${directusUrl}/assets/${logoId.value}`;
});

const resolvedLogoClass = computed(() => props.logoClass || props.fallbackClass);
</script>
