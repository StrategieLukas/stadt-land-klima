<template>
  <main ref="content" class="flow-root bg-mild-white font-sans text-neutral">
    <slot />
  </main>
</template>

<script setup lang="ts">
const content = ref<HTMLElement | null>(null);
useWahlcheckEmbed(content);
const { $locale } = useNuxtApp();
useHead({
  htmlAttrs: { lang: $locale },
  titleTemplate: "%s - Stadt.Land.Klima!",
  link: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
});
</script>

<style>
html[data-wahlcheck-embed="resized"],
html[data-wahlcheck-embed="resized"] body {
  overflow: hidden;
}

/* A tall iframe has a tall CSS viewport. Keep explanation dialogs in the part
   currently visible on the host page, while long dialog content can still scroll. */
html[data-wahlcheck-embed="resized"] .elections-flow dialog.modal {
  align-items: start;
  padding-top: calc(var(--wahlcheck-viewport-top, 0px) + 16px);
  padding-bottom: 16px;
}

html[data-wahlcheck-embed="resized"] .elections-flow dialog.modal .modal-box {
  max-height: calc(var(--wahlcheck-viewport-height, 100dvh) - 32px);
}
</style>
