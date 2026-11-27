<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="job-share-dialog border border-(--slk-border) bg-(--slk-surface) text-(--slk-text)"
      :aria-labelledby="titleId"
      @cancel.prevent="emit('close')"
      @click="backdropClick"
    >
      <div class="p-5 sm:p-6">
        <header class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 :id="titleId" class="font-heading text-2xl font-bold text-(--slk-text-strong)">
              {{ t("jobs.share.title") }}
            </h2>
            <p class="mt-2 max-w-2xl text-sm text-(--slk-text-muted)">{{ t("jobs.share.description") }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 cursor-pointer p-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            :aria-label="$t('generic.close')"
            @click="emit('close')"
          >
            <svg
              aria-hidden="true"
              class="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </header>
        <div class="grid items-start gap-6 md:grid-cols-[17rem_minmax(0,1fr)]">
          <div>
            <div
              class="relative mx-auto aspect-9/16 w-full max-w-[17rem] border border-(--slk-border) bg-(--slk-surface-subdued)"
              data-testid="job-share-preview"
            >
              <img
                v-if="displayed"
                :src="displayed.url"
                :alt="t('jobs.share.preview', { ':title': job.role_title })"
                class="h-full w-full object-contain"
              />
              <div
                v-if="guides && displayed?.format === 'story'"
                aria-hidden="true"
                class="pointer-events-none absolute border-2 border-dashed border-orange"
                :style="guideStyle"
              />
            </div>
            <p class="mt-2 min-h-10 text-sm text-(--slk-text-muted)" role="status" aria-live="polite">
              {{ busy ? t("jobs.share.loading") : notice }}
            </p>
            <label class="mt-2 flex items-start gap-2 text-sm">
              <input v-model="guides" type="checkbox" class="checkbox mt-0.5 checkbox-sm" />
              {{ t("jobs.share.safe_areas") }}
            </label>
          </div>
          <div class="min-w-0 space-y-4">
            <div>
              <label :for="formatId" class="mb-2 block text-sm font-semibold">{{ t("jobs.share.format") }}</label>
              <select
                :id="formatId"
                v-model="format"
                class="select w-full border-(--slk-border) bg-(--slk-surface) text-(--slk-text-strong)"
              >
                <option value="story">{{ t("jobs.share.story") }}</option>
                <option value="feed">{{ t("jobs.share.feed") }}</option>
                <option value="link">{{ t("jobs.share.link") }}</option>
              </select>
            </div>
            <div v-if="imageError" role="alert" class="space-y-2 border border-(--slk-border) p-3 text-sm">
              <p>{{ t("jobs.share.error") }}</p>
              <CanonicalButton
                :label="t('jobs.share.retry')"
                icon-slug="mdi:refresh"
                variant="outline"
                color="gray"
                :disabled="busy"
                @click="loadImage"
              />
            </div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CanonicalButton
                :label="t('jobs.share.whatsapp')"
                :href="links.whatsapp"
                icon-slug="mdi:whatsapp"
                external
                variant="outline"
                color="gray"
              />
              <CanonicalButton
                :label="t('jobs.share.linkedin')"
                :href="links.linkedin"
                icon-slug="mdi:linkedin"
                external
                variant="outline"
                color="gray"
              />
              <CanonicalButton
                :label="t('jobs.share.instagram')"
                icon-slug="mdi:instagram"
                variant="outline"
                color="gray"
                :disabled="!ready"
                :busy="busy"
                @click="shareImage"
              />
              <CanonicalButton
                :label="t('jobs.share.download')"
                icon-slug="mdi:download"
                variant="outline"
                color="gray"
                :disabled="!ready"
                @click="download"
              />
              <CanonicalButton
                v-if="nativeShare"
                :label="t('jobs.share.native')"
                icon-slug="mdi:share-variant"
                variant="outline"
                color="gray"
                @click="shareLink"
              />
              <CanonicalButton
                :label="t('jobs.share.copy_link')"
                icon-slug="mdi:link-variant"
                variant="outline"
                color="gray"
                @click="copy(content.url)"
              />
              <CanonicalButton
                :label="t('jobs.share.copy_caption')"
                icon-slug="mdi:content-copy"
                variant="outline"
                color="gray"
                @click="copy(content.caption)"
              />
            </div>
            <p class="text-sm leading-relaxed text-(--slk-text-muted)">{{ t("jobs.share.instagram_hint") }}</p>
            <p v-if="actionError" role="alert" class="text-sm">{{ actionError }}</p>
            <label :for="captionId" class="block text-sm font-semibold">{{ t("jobs.share.caption") }}</label>
            <textarea
              :id="captionId"
              :value="copyFallback || content.caption"
              readonly
              rows="7"
              class="textarea w-full border-(--slk-border) bg-(--slk-surface) text-sm text-(--slk-text)"
            />
          </div>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import type { PublicJobDetail } from "~/shared/contracts/jobs";
import {
  JOB_SHARE_FORMATS,
  jobShareImagePath,
  jobShareLinks,
  jobShareText,
  resolveJobShareContent,
  type JobShareFormat,
  type JobShareMessageKey,
} from "~/shared/jobSharing";
import type { TranslationParams } from "~/shared/i18n";

const props = defineProps<{ job: PublicJobDetail; siteUrl: string }>();
const emit = defineEmits<{ close: [] }>();
const { $locale } = useNuxtApp();
const t = (key: JobShareMessageKey, params?: TranslationParams) => jobShareText($locale, key, params);
const content = computed(() => resolveJobShareContent(props.job, $locale, props.siteUrl));
const links = computed(() => jobShareLinks(content.value.url, content.value.caption));
const dialog = ref<HTMLDialogElement>();
const id = useId();
const titleId = `job-share-${id}`;
const formatId = `${titleId}-format`;
const captionId = `${titleId}-caption`;
const format = ref<JobShareFormat>("story");
const busy = ref(false);
const imageError = ref(false);
const notice = ref("");
const actionError = ref("");
const copyFallback = ref("");
const nativeShare = ref(false);
const guides = ref(false);
const displayed = ref<{ url: string; file: File; format: JobShareFormat; key: string }>();
const key = computed(() =>
  JSON.stringify([
    props.job.id,
    content.value,
    props.job.tasks?.slice(0, 10_000),
    props.job.benefits?.slice(0, 10_000),
    props.job.organisation?.logo?.id,
    $locale,
    format.value,
  ]),
);
const ready = computed(() => !busy.value && !imageError.value && displayed.value?.key === key.value);
const story = JOB_SHARE_FORMATS.story;
const guideStyle = {
  top: `${(100 * story.top) / story.height}%`,
  bottom: `${(100 * story.bottom) / story.height}%`,
  left: `${(100 * story.left) / story.width}%`,
  right: `${(100 * story.right) / story.width}%`,
};
let abort: AbortController | undefined;
let generation = 0;
let previousFocus: HTMLElement | null = null;
let previousOverflow = "";

async function loadImage() {
  abort?.abort();
  abort = new AbortController();
  const request = ++generation;
  const selected = format.value;
  const identity = key.value;
  busy.value = true;
  imageError.value = false;
  notice.value = "";
  let objectUrl: string | undefined;
  try {
    const response = await fetch(jobShareImagePath(props.job.slug, $locale, selected), {
      signal: abort.signal,
      credentials: "omit",
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png"))
      throw new Error("Image unavailable");
    const blob = await response.blob();
    if (blob.size > 4 * 1024 * 1024) throw new Error("Image too large");
    objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (request !== generation) return;
    const previous = displayed.value?.url;
    displayed.value = {
      url: objectUrl,
      file: new File([blob], `job-${props.job.slug.slice(0, 80)}-${selected}.png`, { type: "image/png" }),
      format: selected,
      key: identity,
    };
    objectUrl = undefined;
    if (previous) URL.revokeObjectURL(previous);
  } catch {
    if (request === generation) imageError.value = true;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (request === generation) busy.value = false;
  }
}

function download() {
  if (!ready.value || !displayed.value) return;
  const link = document.createElement("a");
  link.href = displayed.value.url;
  link.download = displayed.value.file.name;
  document.body.append(link);
  link.click();
  link.remove();
}
async function shareImage() {
  if (!ready.value || !displayed.value) return;
  actionError.value = "";
  const file = displayed.value.file;
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    download();
    return;
  }
  try {
    await navigator.share({ files: [file] });
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) actionError.value = t("jobs.share.share_error");
  }
}
async function shareLink() {
  actionError.value = "";
  try {
    await navigator.share({
      title: props.job.role_title,
      text: content.value.caption.replace(`\n${content.value.url}`, ""),
      url: content.value.url,
    });
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) actionError.value = t("jobs.share.share_error");
  }
}
async function copy(value: string) {
  actionError.value = "";
  notice.value = "";
  copyFallback.value = "";
  try {
    await navigator.clipboard.writeText(value);
    notice.value = t("jobs.share.copied");
  } catch {
    copyFallback.value = value;
    actionError.value = t("jobs.share.copy_error");
  }
}
function backdropClick(event: MouseEvent) {
  const rect = dialog.value?.getBoundingClientRect();
  if (
    event.target === dialog.value &&
    rect &&
    (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
  )
    emit("close");
}
watch(key, () => {
  if (import.meta.client) void loadImage();
});
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog.value?.showModal();
  nativeShare.value = typeof navigator.share === "function";
  void loadImage();
});
onBeforeUnmount(() => {
  ++generation;
  abort?.abort();
  if (displayed.value) URL.revokeObjectURL(displayed.value.url);
  dialog.value?.close();
  document.body.style.overflow = previousOverflow;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
});
</script>

<style scoped>
.job-share-dialog {
  width: min(64rem, calc(100% - 2rem));
  max-height: calc(100svh - 2rem);
  margin: auto;
  padding: 0;
  overflow-y: auto;
}
.job-share-dialog::backdrop {
  background: rgb(0 0 0 / 50%);
}
:global(html[data-theme="staedteChallengeDark"]) .job-share-dialog::backdrop {
  background: color-mix(in srgb, var(--slk-backdrop) 50%, transparent);
}
</style>
