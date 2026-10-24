<template>
  <div class="overflow-hidden rounded-lg bg-gray-100">
    <div v-if="loading" class="flex items-center justify-center" style="min-height: 200px">
      <SlkFlowerSpinner :size="28" />
    </div>
    <div v-else-if="error" class="flex items-center justify-center text-xs text-gray-400" style="min-height: 200px">
      Bild konnte nicht geladen werden.
    </div>
    <template v-else-if="imageSrc">
      <img :src="imageSrc" :alt="titleText" class="block h-auto w-full object-cover" />
      <p v-if="captionText" class="px-3 py-2 text-xs text-gray-500 italic">
        {{ captionText }}
      </p>
    </template>
    <div v-else class="flex items-center justify-center text-sm text-gray-400" style="min-height: 200px">
      Kein Bild verfügbar.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ImagePayloadSchema } from "~/shared/contracts/slz";
import { visualizationUrl } from "~/shared/visualizationSafety";
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useSlzLocale } from "~/composables/useSlzLocale";
import type { RenderElement } from "~/types/slz-api";

const props = defineProps<{
  element: RenderElement;
  collectionSlug: string;
  baseUrl: string;
}>();

const { t } = useSlzLocale();

const imageSrc = ref<string | null>(null);
const loading = ref(false);
const error = ref(false);

const titleText = computed(() => t(props.element.title));
const captionText = computed(() => t(props.element.description));

const imageRequest = new AbortController();
onBeforeUnmount(() => {
  imageRequest.abort();
  if (imageSrc.value?.startsWith("blob:")) URL.revokeObjectURL(imageSrc.value);
});
onMounted(async () => {
  const rawSrc = props.element.src_url;
  if (!rawSrc) return;

  // Prepend baseUrl for relative API paths
  const src = rawSrc.startsWith("/") ? `${props.baseUrl}${rawSrc}` : rawSrc;

  loading.value = true;
  try {
    const res = await fetch(visualizationUrl(src, window.location.origin), {
      signal: imageRequest.signal,
      credentials: "omit",
      redirect: "error",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      // API returns { content_type, encoding, data } for binary image fields
      const json = ImagePayloadSchema.parse(await res.json());
      if (imageRequest.signal.aborted) return;
      const mime = json.content_type ?? "image/png";
      imageSrc.value = `data:${mime};base64,${json.data}`;
    } else if (ct.startsWith("image/")) {
      // Direct binary image response
      const blob = await res.blob();
      if (imageRequest.signal.aborted) return;
      imageSrc.value = URL.createObjectURL(blob);
    } else {
      // Fallback: treat src as a static URL
      imageSrc.value = src;
    }
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
});
</script>
