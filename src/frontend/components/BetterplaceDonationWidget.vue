<template>
  <div class="w-full">
    <iframe
      :src="widgetUrl"
      :title="$t('donate.widget.iframe_title')"
      class="block w-full rounded-md border border-solid-gray-20 bg-white shadow-sm"
      :height="height"
      loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"
    >
      <a :href="BETTERPLACE_PROJECT_URL" target="_blank" rel="noopener noreferrer">
        {{ $t("donate.widget.iframe_fallback") }}
      </a>
    </iframe>

    <p class="mt-3 text-sm text-gray-500 dark:text-[var(--slk-text-muted)]">
      <a
        :href="BETTERPLACE_PROJECT_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-orange underline underline-offset-4"
      >
        {{ $t("donate.page.open_betterplace") }}
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { BETTERPLACE_PROJECT_URL, getBetterplaceWidgetUrl } from "~/shared/donation";

const props = withDefaults(
  defineProps<{
    height?: number;
  }>(),
  {
    height: 320,
  },
);

const { $locale, $t } = useNuxtApp();

const widgetUrl = computed(() => getBetterplaceWidgetUrl($locale));
const height = computed(() => Math.max(260, Math.min(640, props.height)));
</script>
