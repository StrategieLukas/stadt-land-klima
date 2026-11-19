<template>
  <span
    ref="preview"
    class="tour-media-preview"
    :class="{ 'tour-media-preview--natural': preserveAspectRatio && previewFile }"
  >
    <SmartImg
      v-if="previewFile"
      :key="previewKey"
      asset-base-url="/api/tour-media"
      :editor-preview="editorPreview"
      :asset-id="relationId(previewFile)"
      :is-raster="isRaster(typeof previewFile === 'string' ? 'image/jpeg' : previewFile.type || 'image/jpeg')"
      :alt="item.alt"
      :width="900"
      :height="preserveAspectRatio ? undefined : 448"
      :fit="preserveAspectRatio ? 'contain' : 'cover'"
      img-class="tour-media-preview__image"
      @load="onLoad"
      @error="onError"
    />
    <span v-else class="tour-media-preview__placeholder">{{ $t("tour.video") }}</span>
    <span v-if="isVideoMedia(item)" class="tour-media-preview__play" aria-hidden="true">▶</span>
  </span>
</template>
<script setup lang="ts">
import { isVideoMedia } from "~/shared/tourMedia";
import type { TourMedia, TourMediaPreviewStatus } from "~/shared/tourMedia";
import { relationId } from "~/shared/tour";
import { isRaster } from "~/shared/utils";
const props = defineProps<{
  item: TourMedia;
  editorPreview?: boolean | undefined;
  preserveAspectRatio?: boolean | undefined;
}>();
const { $t } = useNuxtApp();
const emit = defineEmits<{ status: [status: TourMediaPreviewStatus] }>();
const preview = ref<HTMLElement | null>(null);
const previewFile = computed(() => (isVideoMedia(props.item) ? props.item.poster : props.item.file));
const previewKey = computed(() =>
  JSON.stringify([relationId(previewFile.value), props.editorPreview, props.preserveAspectRatio, previewFile.value]),
);
let generation = 0;

async function decodeImage(image: HTMLImageElement) {
  const currentGeneration = generation;
  try {
    await image.decode();
    if (currentGeneration === generation && image === preview.value?.querySelector("img")) {
      emit("status", image.naturalWidth > 0 ? "ready" : "error");
    }
  } catch {
    if (currentGeneration === generation && image === preview.value?.querySelector("img")) emit("status", "error");
  }
}
function onLoad(event: Event) {
  if (event.target instanceof HTMLImageElement) void decodeImage(event.target);
}
function onError(event: Event) {
  if (event.target === preview.value?.querySelector("img")) emit("status", "error");
}
watch(
  previewKey,
  async (_key, _previous, onCleanup) => {
    const currentGeneration = ++generation;
    onCleanup(() => generation++);
    emit("status", previewFile.value ? "loading" : "ready");
    await nextTick();
    if (currentGeneration !== generation) return;
    // Cached images can finish before the load listener is attached during hydration.
    const image = preview.value?.querySelector("img");
    if (image?.complete) {
      if (image.naturalWidth > 0) void decodeImage(image);
      else emit("status", "error");
    }
  },
  { immediate: true, flush: "post" },
);
</script>
<style scoped>
.tour-media-preview {
  position: relative;
  display: block;
  width: 100%;
  height: 14rem;
  overflow: hidden;
  background: var(--slk-surface-subdued, #e6f1f4);
}
.tour-media-preview :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tour-media-preview--natural {
  width: auto;
  height: auto;
}
.tour-media-preview--natural :deep(img) {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: min(25rem, calc(var(--scene-height, 37rem) - 14rem));
  object-fit: contain;
}
.tour-media-preview__placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--slk-text, #505050);
  font-weight: 700;
}
.tour-media-preview__play {
  position: absolute;
  top: 50%;
  left: 50%;
  padding: 0.6rem 0.9rem;
  transform: translate(-50%, -50%);
  background: #182127;
  color: white;
}
</style>
