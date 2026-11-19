<template>
  <span
    v-if="lightAsset?.id"
    class="inline-flex shrink-0 items-center justify-center overflow-hidden"
    :class="{ 'dark:bg-white': !darkAsset?.id && !legacyDarkSource }"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <SmartImg
      :asset-id="lightAsset.id"
      :is-raster="!!lightAsset.type && isRaster(lightAsset.type)"
      :alt="alt"
      :width="size * 2"
      :height="size * 2"
      fit="contain"
      img-class="h-full w-full object-contain"
      :class="{ 'dark:hidden': !!darkAsset?.id || !!legacyDarkSource }"
    />
    <SmartImg
      v-if="darkAsset?.id"
      :asset-id="darkAsset.id"
      :is-raster="!!darkAsset.type && isRaster(darkAsset.type)"
      :alt="alt"
      :width="size * 2"
      :height="size * 2"
      fit="contain"
      class="hidden dark:block"
      img-class="h-full w-full object-contain"
    />
    <img
      v-else-if="legacyDarkSource"
      :src="legacyDarkSource"
      :alt="alt"
      :width="size"
      :height="size"
      loading="lazy"
      class="hidden h-full w-full object-contain dark:block"
    />
  </span>
</template>

<script setup lang="ts">
import type { Asset } from "~/types/components/content";
import { isRaster } from "~/shared/utils";
import localZeroLogoDark from "~/assets/images/LocalZero-logo-small-dark.png";

const props = withDefaults(
  defineProps<{
    logo?: Asset | undefined;
    darkLogo?: Asset | undefined;
    alt?: string | undefined;
    size?: number | undefined;
  }>(),
  { alt: "", size: 48 },
);

function asset(value: Asset | undefined) {
  return typeof value === "string" ? { id: value, type: null } : value;
}

const lightAsset = computed(() => asset(props.logo || props.darkLogo));
const darkAsset = computed(() => asset(props.darkLogo));
// Preserve the existing LocalZero dark artwork until its CMS variant is populated.
const legacyDarkSource = computed(() =>
  lightAsset.value?.id === "85624177-21f4-43c7-9b13-b53087ba2401" ? localZeroLogoDark : "",
);
</script>
