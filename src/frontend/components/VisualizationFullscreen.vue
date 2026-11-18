<template>
  <div class="h-full w-full min-w-0">
    <dialog
      v-if="enabled"
      ref="dialog"
      class="visualization-fullscreen"
      :aria-label="label"
      @cancel.prevent="collapse"
      @close="finishClose"
    />
    <Teleport :to="dialog || 'body'" :disabled="!expanded">
      <div class="relative flex h-full min-h-0 w-full flex-col">
        <header
          v-if="expanded"
          class="flex shrink-0 items-center justify-between gap-4 border-b border-(--slk-border) p-2"
        >
          <h2 class="min-w-0 truncate px-2 font-semibold">{{ label }}</h2>
          <button
            ref="closeButton"
            type="button"
            class="btn btn-square min-h-11 min-w-11 shrink-0 btn-ghost btn-sm"
            :title="$t('data.chart.exit_fullscreen')"
            :aria-label="$t('data.chart.exit_fullscreen')"
            @click="collapse"
          >
            <Icon icon="mdi:fullscreen-exit" class="h-5 w-5" />
          </button>
        </header>
        <div class="relative min-h-0 flex-1">
          <slot />
          <button
            v-if="enabled"
            v-show="!expanded"
            ref="expandButton"
            type="button"
            class="btn absolute top-2 z-20 btn-square min-h-11 min-w-11 btn-ghost text-(--slk-text-subtle) btn-sm"
            :class="controlPosition === 'left' ? 'left-2' : 'right-2'"
            :title="$t('data.chart.fullscreen')"
            :aria-label="$t('data.chart.fullscreen')"
            aria-haspopup="dialog"
            @click.stop="expand"
          >
            <Icon icon="mdi:fullscreen" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { nextTick, onBeforeUnmount, ref } from "vue";

withDefaults(defineProps<{ label: string; enabled?: boolean; controlPosition?: "left" | "right" }>(), {
  enabled: true,
  controlPosition: "right",
});
const { $t } = useNuxtApp();
const dialog = ref<HTMLDialogElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const expandButton = ref<HTMLButtonElement | null>(null);
const expanded = ref(false);
let opener: HTMLElement | null = null;
let previousOverflow: string | null = null;
let previousRootOverflow = "";
let previousScrollbarGutter = "";
let previousScroll = { x: 0, y: 0 };

async function expand() {
  if (!dialog.value || expanded.value) return;
  opener = expandButton.value;
  previousScroll = { x: window.scrollX, y: window.scrollY };
  previousOverflow = document.body.style.overflow;
  previousRootOverflow = document.documentElement.style.overflow;
  previousScrollbarGutter = document.documentElement.style.scrollbarGutter;
  dialog.value.showModal();
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  document.documentElement.style.scrollbarGutter = "auto";
  expanded.value = true;
  await nextTick();
  closeButton.value?.focus({ preventScroll: true });
}

function collapse() {
  dialog.value?.close();
  void finishClose();
}

function restorePage() {
  if (previousOverflow === null) return;
  document.body.style.overflow = previousOverflow;
  document.documentElement.style.overflow = previousRootOverflow;
  document.documentElement.style.scrollbarGutter = previousScrollbarGutter;
  previousOverflow = null;
  window.scrollTo({ left: previousScroll.x, top: previousScroll.y, behavior: "instant" });
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}

async function finishClose() {
  if (!expanded.value) return;
  expanded.value = false;
  await nextTick();
  restorePage();
}

onBeforeUnmount(() => {
  dialog.value?.close();
  restorePage();
});
</script>

<style scoped>
.visualization-fullscreen {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  border: 0;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  overflow: hidden;
  background: var(--slk-surface);
  color: var(--slk-text);
}
</style>
