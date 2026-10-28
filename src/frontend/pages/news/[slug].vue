<template>
  <BlokkliPageProvider
    v-if="item"
    entity-type="news_items"
    entity-bundle="news_item"
    :entity-uuid="item.id"
    :can-edit="canEdit"
    :entity="item"
  >
    <template #default>
      <div class="flex w-full flex-col items-center px-4 py-8">
        <div class="w-full max-w-3xl">
          <div class="mb-4">
            <NuxtLink :to="backHref" class="inline-flex items-center gap-1 text-sm text-[#006e94] hover:underline">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              {{ backLabel }}
            </NuxtLink>
          </div>
          <article class="prose max-w-none">
            <time v-if="displayDate" class="not-prose mb-1 block text-sm text-gray-500" :datetime="displayDate">{{
              formatDate(displayDate)
            }}</time>
            <p v-if="item.author" class="not-prose mb-3 text-sm text-gray-600 italic">
              {{ $t("article.author_date", { ":author": item.author, ":date": formatDate(displayDate) }) }}
            </p>
            <p v-else-if="displayDate && !item.author" class="not-prose mb-3" />
            <h1>{{ item.title }}</h1>
            <p v-if="item.teaser" class="lead text-gray-600">{{ item.teaser }}</p>

            <!-- Header: image, title, teaser -->
            <div v-if="item.image" class="not-prose mb-6 overflow-hidden rounded-xl">
              <SmartImg
                :asset-id="item.image.id"
                :is-raster="isRaster(item.image.type)"
                :alt="item.title"
                :width="900"
                img-class="w-full h-auto block"
              />
            </div>
            <p v-if="item.image_credits" class="not-prose mb-4 text-center text-xs text-gray-500 italic">
              {{ item.image_credits }}
            </p>

            <!-- blokkli content blocks -->
            <BlokkliField name="content" :list="newsBlocks" />
            <div
              v-if="item.report_event"
              class="not-prose mt-10 rounded-xl border border-solid-stats-dark-20 bg-solid-stats-dark-05 p-5"
            >
              <NuxtLink
                :to="`/events/${item.report_event.slug}`"
                class="block font-semibold text-stats-dark hover:underline"
              >
                {{ $t("tour.event_details") }}: {{ item.report_event.title }} →
              </NuxtLink>
              <NuxtLink
                v-if="item.report_event.series"
                :to="`/events/series/${item.report_event.series.slug}#stop-${item.report_event.slug}`"
                class="mt-2 block text-stats-dark hover:underline"
              >
                {{ $t("tour.back_to_series", { ":title": item.report_event.series.title }) }} →
              </NuxtLink>
              <div v-if="reportProjects.length" class="mt-4 flex flex-wrap gap-2">
                <NuxtLink
                  v-for="project in reportProjects"
                  :key="project.id"
                  :to="`/projects/${project.slug}`"
                  class="btn border-stats-dark btn-outline text-stats-dark btn-sm"
                >
                  {{ project.title }}
                </NuxtLink>
              </div>
            </div>
          </article>

          <!-- Metadata edit panel (visible to authenticated editors only) -->
          <div v-if="canEdit" class="not-prose mt-8 border-t border-gray-200 pt-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-sm font-semibold tracking-wide text-gray-500 uppercase">
                {{ $t("news.editor.metadata") }}
              </h2>
              <button
                type="button"
                class="rounded-full border border-[#16BAE7] px-3 py-1.5 text-xs text-[#16BAE7] transition-colors hover:bg-[#E8F7FD]"
                @click="editOpen = !editOpen"
              >
                {{ editOpen ? $t("generic.close") : $t("generic.edit") }}
              </button>
            </div>

            <form
              v-if="editOpen"
              class="flex flex-col gap-4 rounded-lg border border-gray-100 bg-[#f5fafb] p-5"
              @submit.prevent="saveMetadata"
            >
              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-600">{{
                  $t("news.editor.title_required")
                }}</label>
                <input
                  v-model="editForm.title"
                  type="text"
                  required
                  class="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm focus:border-[#16BAE7] focus:outline-hidden"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-600">{{ $t("news.editor.teaser") }}</label>
                <textarea
                  v-model="editForm.teaser"
                  rows="3"
                  class="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm focus:border-[#16BAE7] focus:outline-hidden"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-600">{{ $t("news.editor.author") }}</label>
                <input
                  v-model="editForm.author"
                  type="text"
                  :placeholder="$t('news.editor.author_placeholder')"
                  class="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm focus:border-[#16BAE7] focus:outline-hidden"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-xs font-semibold text-gray-600">{{
                    $t("news.editor.published_at")
                  }}</label>
                  <input
                    v-model="editForm.date_published"
                    type="datetime-local"
                    class="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm focus:border-[#16BAE7] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-semibold text-gray-600">{{ $t("news.editor.status") }}</label>
                  <select
                    v-model="editForm.status"
                    class="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm focus:border-[#16BAE7] focus:outline-hidden"
                  >
                    <option value="draft">{{ $t("status.draft") }}</option>
                    <option value="published">{{ $t("status.published") }}</option>
                    <option value="archived">{{ $t("status.archived") }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-600">{{ $t("news.editor.image_id") }}</label>
                <input
                  v-model="editForm.image"
                  type="text"
                  :placeholder="$t('news.editor.image_id_placeholder')"
                  class="w-full rounded-sm border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#16BAE7] focus:outline-hidden"
                />
                <p class="mt-1 text-xs text-gray-400">
                  {{ $t("news.editor.image_id_hint_prefix") }}
                  <a :href="`${directusUrl}/admin/files`" target="_blank" class="underline">{{
                    $t("news.editor.directus_file_manager")
                  }}</a
                  >.
                </p>
              </div>
              <div class="flex items-center gap-3">
                <button
                  type="submit"
                  :disabled="saving"
                  class="rounded-sm bg-[#006e94] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#005a7a] disabled:opacity-50"
                >
                  {{ saving ? $t("generic.saving") : $t("generic.save") }}
                </button>
                <span v-if="saveSuccess" class="text-sm font-medium text-green-600">✓ {{ $t("generic.saved") }}</span>
                <span v-if="saveError" class="text-sm text-red-600">{{ saveError }}</span>
              </div>
            </form>
          </div>
          <!-- /.canEdit -->
        </div>
        <!-- /.max-w-3xl -->
      </div>
      <!-- /.flex -->
    </template>
  </BlokkliPageProvider>

  <p v-else-if="authChecked" class="prose py-8">
    {{ $t("page_not_found") }}
  </p>
  <!-- placeholder while waiting for client-side auth check -->
  <div v-else class="py-8" />
</template>

<script setup lang="ts">
import { clientFailure } from "~/shared/securityLog";

import { routeSlug } from "~/shared/routeValues";
import { useAuth } from "~/composables/useAuth";
import { useReferrer } from "~/composables/useReferrer";
import { formatBerlinDate } from "~/shared/eventDateTime";
import { getBlokkliDataKey, mapBlokkliBlocks } from "~/shared/blokkliPersistence";

import { requestErrorMessage } from "~/shared/requestError";
import type { z } from "zod";
import type { NewsDetailSchema } from "~/shared/contracts/content";
import { isRaster } from "~/shared/utils";
const fetchContent = useContentFetch();

const { $t, $locale } = useNuxtApp();
const { backHref, backLabel } = useReferrer("/news", $t("news.back_to_overview"));

const { isAuthenticated, initialize } = useAuth();
const editor = useNewsEditor();
const canEdit = ref(false);

const directusUrl = useRuntimeConfig().public.clientDirectusUrl;
const route = useRoute();
const slug = routeSlug(route.params.slug);
if (!slug) throw createError({ statusCode: 404, statusMessage: "Not found" });

// Use server route — $directus is only available during SSR, not on client
const { data: newsResult } = await useAsyncData(`news-item-${slug}`, async () =>
  fetchContent(`/api/public/news/${slug}`),
);
// Draft metadata stays in a browser-local ref, outside serialized/cached Nuxt data.
const editorItem = shallowRef<z.output<typeof NewsDetailSchema> | null>(null);
const item = computed(() => editorItem.value ?? newsResult.value?.item ?? null);

if (item.value?.is_tour_redirect && item.value.tour_stop?.tour?.slug) {
  await navigateTo(
    `/projects/tours/${item.value.tour_stop.tour.slug}/${item.value.tour_stop.slug}${route.fullPath.slice(route.path.length)}`,
    { redirectCode: 301, replace: true },
  );
}

const reportProjects = computed<{ id: string; slug: string; title: string }[]>(() => []);

// Do not throw a fatal 404 on SSR — drafts are only visible to authenticated users
// and auth state is only known client-side. onMounted will check auth.
const authChecked = ref(false);
onMounted(async () => {
  await initialize();
  if (isAuthenticated.value) {
    try {
      editorItem.value = await editor.detail(slug!);
    } catch {
      /* Keep the public view if access is denied. */
    }
  }
  canEdit.value = isAuthenticated.value && !item.value?.is_tour_redirect;
  watchEffect(() => {
    canEdit.value = isAuthenticated.value && !item.value?.is_tour_redirect;
    if (!isAuthenticated.value) editorItem.value = null;
  });
  if (item.value?.is_tour_redirect && item.value.tour_stop?.tour?.slug) {
    await navigateTo(
      `/projects/tours/${item.value.tour_stop.tour.slug}/${item.value.tour_stop.slug}${route.fullPath.slice(route.path.length)}`,
      { replace: true },
    );
  }
  authChecked.value = true;
});

const blocksKey = getBlokkliDataKey("news_items", String(item.value?.id || `missing-${slug}`));

const { data: blocksData } = await useAsyncData(
  blocksKey,
  async () => {
    if (!item.value) return [];
    try {
      const result = await fetchContent("/api/public/blocks", {
        query: {
          entityType: "news_items",
          entityUuid: item.value.id,
          fieldName: "content",
        },
      });
      return mapBlokkliBlocks(result.blocks ?? []);
    } catch (error) {
      clientFailure("app.pages.news._slug_.failed", error);
      return [];
    }
  },
  { watch: [item] },
);
const newsBlocks = computed(() => blocksData.value || []);

const displayDate = computed(() => item.value?.date_published || item.value?.date_created);

function formatDate(iso?: string | null) {
  return formatBerlinDate(iso, $locale);
}

// ── Metadata editing ───────────────────────────────────────────────────────────

const editOpen = ref(false);
const saving = ref(false);
const saveSuccess = ref(false);
const saveError = ref<string | null>(null);

// Convert ISO datetime to datetime-local input format (strips seconds + timezone)
function toDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const editForm = reactive({
  title: "",
  teaser: "",
  author: "",
  date_published: "",
  status: "draft",
  image: "",
});

// Sync form when item loads or editOpen changes
watch(
  [() => item.value, editOpen],
  () => {
    if (!item.value || !editOpen.value) return;
    editForm.title = item.value.title || "";
    editForm.teaser = item.value.teaser || "";
    editForm.author = item.value.author || "";
    editForm.date_published = toDatetimeLocal(item.value.date_published);
    editForm.status = item.value.status || "draft";
    editForm.image = item.value.image?.id || "";
  },
  { immediate: true },
);

async function saveMetadata() {
  if (!item.value?.id) return;
  saving.value = true;
  saveSuccess.value = false;
  saveError.value = null;
  try {
    await editor.save(item.value.id, {
      title: editForm.title,
      teaser: editForm.teaser || null,
      author: editForm.author || null,
      date_published: editForm.date_published ? new Date(editForm.date_published).toISOString() : null,
      status: editForm.status,
      image: editForm.image || null,
    });
    editorItem.value = await editor.detail(slug!);
    await refreshNuxtData(`news-item-${slug}`);
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err) {
    saveError.value = requestErrorMessage(err, $t("news.editor.save_error"));
  } finally {
    saving.value = false;
  }
}

usePageSeo({
  title: () => item.value?.title || $t("news.type.news"),
  description: () => item.value?.teaser,
  image: () => item.value?.image,
  type: "article",
});
</script>
