<template>
  <dialog
    ref="dialog"
    class="tour-media-viewer"
    :aria-label="title || $t('tour.media')"
    @close="finishClose"
    @cancel="close"
    @keydown="onKeydown"
    @click="onBackdropClick"
  >
    <div v-if="current" class="tour-media-viewer__body">
      <header>
        <h2>{{ title }}</h2>
        <button type="button" @click="close">{{ $t("generic.close") }} ✕</button>
      </header>
      <div class="tour-media-viewer__stage">
        <video
          v-if="isVideoMedia(current)"
          :key="current.id"
          ref="video"
          :src="assetUrl(current.file)"
          :poster="current.poster ? assetUrl(current.poster) : undefined"
          controls
          playsinline
          preload="metadata"
          :aria-label="current.alt"
          @error="failed = true"
        />
        <img
          v-else
          :key="`image-${current.id}`"
          :src="assetUrl(current.file)"
          :alt="current.alt"
          @error="failed = true"
        />
        <p v-if="failed" role="status">{{ $t("tour.media_error") }}</p>
      </div>
      <div class="tour-media-viewer__details">
        <p v-if="current.caption" class="tour-media-viewer__caption">{{ current.caption }}</p>
        <small v-if="current.credit">{{ current.credit }}</small>
      </div>
      <nav :aria-label="$t('tour.media')">
        <button
          type="button"
          :disabled="activeIndex === 0"
          :aria-label="$t('tour.previous')"
          @click="select(activeIndex - 1)"
        >
          ←
        </button>
        <span aria-live="polite">{{
          $t("tour.media_position", { ":current": activeIndex + 1, ":total": items.length })
        }}</span>
        <button
          type="button"
          :disabled="activeIndex === items.length - 1"
          :aria-label="$t('tour.next')"
          @click="select(activeIndex + 1)"
        >
          →
        </button>
      </nav>
    </div>
  </dialog>
</template>
<script setup lang="ts">
import { isVideoMedia } from "~/shared/tourMedia";
import type { MediaFile, TourMedia } from "~/shared/tourMedia";
import { relationId } from "~/shared/tour";
const props = defineProps<{ editorPreview?: boolean | undefined }>();
const emit = defineEmits<{ change: [open: boolean] }>();
const { $t } = useNuxtApp();
const dialog = ref<HTMLDialogElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const items = ref<TourMedia[]>([]);
const title = ref("");
const activeIndex = ref(0);
const failed = ref(false);
const current = computed(() => items.value[activeIndex.value]);
let opener: HTMLElement | null = null;
let previousOverflow: string | null = null;
let previousScroll = { x: 0, y: 0 };
const assetUrl = (file: MediaFile) =>
  `${props.editorPreview ? "/api/editor/cms/assets" : "/api/tour-media"}/${relationId(file)}`;
function select(index: number) {
  if (index < 0 || index >= items.value.length) return;
  video.value?.pause();
  failed.value = false;
  activeIndex.value = index;
}
async function open(media: TourMedia[], index = 0, stopTitle = "") {
  if (!media.length) return;
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  items.value = media;
  title.value = stopTitle;
  select(Math.max(0, Math.min(index, media.length - 1)));
  await nextTick();
  if (!dialog.value?.open) {
    previousScroll = { x: window.scrollX, y: window.scrollY };
    emit("change", true);
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.value?.showModal();
  }
}
function close() {
  video.value?.pause();
  dialog.value?.close();
  finishClose();
}
function finishClose() {
  video.value?.pause();
  if (previousOverflow === null) return;
  document.body.style.overflow = previousOverflow;
  previousOverflow = null;
  window.scrollTo({ left: previousScroll.x, top: previousScroll.y, behavior: "instant" });
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
  emit("change", false);
}
function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLVideoElement || event.target instanceof HTMLInputElement) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    select(activeIndex.value + (event.key === "ArrowLeft" ? -1 : 1));
  }
}
function onBackdropClick(event: MouseEvent) {
  if (event.target !== dialog.value) return;
  const bounds = dialog.value?.getBoundingClientRect();
  if (
    bounds &&
    (event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom)
  )
    close();
}
onUnmounted(finishClose);
defineExpose({ open, close });
</script>
<style scoped>
.tour-media-viewer {
  width: min(70rem, 96vw);
  height: min(52rem, 94svh);
  max-height: 94svh;
  padding: clamp(0.75rem, 2vw, 1.25rem);
  border: 3px solid #505050;
  background: var(--slk-surface, white);
  color: var(--slk-text, #505050);
}
.tour-media-viewer::backdrop {
  background: rgb(0 0 0 / 0.8);
}
.tour-media-viewer__body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) 6rem auto;
  height: 100%;
  gap: 0.65rem;
}
header,
nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
h2 {
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 700;
}
header button {
  flex-shrink: 0;
}
button {
  padding: 0.5rem 0.75rem;
  border: 2px solid currentColor;
}
button:disabled {
  opacity: 0.4;
}
button:focus-visible {
  outline: 3px solid var(--slk-accent, #16bae7);
  outline-offset: 2px;
}
.tour-media-viewer__stage {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 0;
  overflow: hidden;
  background: var(--slk-surface, white);
}
.tour-media-viewer__stage img,
video {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
}
.tour-media-viewer__stage p {
  position: absolute;
  padding: 1rem;
  background: var(--slk-surface, white);
  color: var(--slk-text, #505050);
}
.tour-media-viewer__details {
  min-height: 0;
  overflow-y: auto;
}
.tour-media-viewer__details small {
  display: block;
  margin-top: 0.35rem;
}
</style>
