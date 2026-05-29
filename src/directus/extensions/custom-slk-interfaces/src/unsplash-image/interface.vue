<template>
  <div class="unsplash-image-interface">
    <!-- Current image preview -->
    <div v-if="props.value" class="preview-wrapper" :class="{ letterbox: props.letterbox }">
      <img :src="previewUrl ?? undefined" alt="" class="preview-img" />
      <div class="preview-actions">
        <button class="action-btn danger" :disabled="props.disabled" @click="removeImage">
          Remove
        </button>
        <a :href="previewUrl ?? undefined" target="_blank" rel="noopener" class="action-btn secondary">
          View
        </a>
      </div>
    </div>

    <!-- Upload / search buttons -->
    <div v-if="!props.disabled" class="button-row">
      <button class="action-btn primary" @click="triggerFileUpload">
        Upload file
      </button>
      <button class="action-btn secondary" @click="openLibrary">
        Select from library
      </button>
      <button class="action-btn secondary" @click="openUnsplash">
        Search Unsplash
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        style="display: none"
        @change="onFileChosen"
      />
    </div>

    <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>

    <!-- Directus library browser modal -->
    <div v-if="libraryOpen" class="modal-overlay" @click.self="closeLibrary">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Select from library</span>
          <button class="close-btn" @click="closeLibrary">&#x2715;</button>
        </div>

        <div class="search-bar">
          <input
            v-model="librarySearch"
            type="text"
            placeholder="Search files…"
            class="search-input"
            @input="onLibrarySearchInput"
          />
        </div>

        <div v-if="libraryLoading" class="loading">Loading…</div>

        <div v-else-if="libraryFiles.length === 0" class="empty">
          No files found.
        </div>

        <div v-if="libraryFiles.length" class="photo-grid">
          <div
            v-for="file in libraryFiles"
            :key="file.id"
            class="photo-card"
            @click="selectLibraryFile(file)"
          >
            <img
              :src="`/assets/${file.id}?fit=cover&width=150&height=150`"
              :alt="file.title || file.filename_download"
              class="photo-thumb"
              loading="lazy"
            />
            <div class="photo-attr">{{ file.title || file.filename_download }}</div>
          </div>
        </div>

        <div v-if="libraryTotalPages > 1" class="pagination">
          <button
            class="action-btn secondary"
            :disabled="libraryPage <= 1 || libraryLoading"
            @click="loadLibraryPage(libraryPage - 1)"
          >
            Previous
          </button>
          <span class="page-info">{{ libraryPage }} / {{ libraryTotalPages }}</span>
          <button
            class="action-btn secondary"
            :disabled="libraryPage >= libraryTotalPages || libraryLoading"
            @click="loadLibraryPage(libraryPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Unsplash modal -->
    <div v-if="modalOpen" class="modal-overlay" @click.self="closeUnsplash">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Search Unsplash</span>
          <button class="close-btn" @click="closeUnsplash">&#x2715;</button>
        </div>

        <div class="search-bar">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search photos…"
            class="search-input"
            @input="onSearchInput"
            @keydown.enter="runSearch(1)"
          />
        </div>

        <div v-if="searchError" class="error-msg">{{ searchError }}</div>

        <div v-if="searching" class="loading">Searching…</div>

        <div v-if="!searching && photos.length === 0 && hasSearched" class="empty">
          No results found.
        </div>

        <div v-if="photos.length" class="photo-grid">
          <div
            v-for="photo in photos"
            :key="photo.id"
            class="photo-card"
            :class="{ loading: importingId === photo.id }"
            @click="selectPhoto(photo)"
          >
            <img :src="photo.urls.small" :alt="photo.description ?? undefined" class="photo-thumb" loading="lazy" />
            <div class="photo-attr">
              <a
                :href="photo.user.link + '?utm_source=stadtlandklima&utm_medium=referral'"
                target="_blank"
                rel="noopener"
                @click.stop
              >{{ photo.user.name }}</a>
              on
              <a
                href="https://unsplash.com/?utm_source=stadtlandklima&utm_medium=referral"
                target="_blank"
                rel="noopener"
                @click.stop
              >Unsplash</a>
            </div>
            <div v-if="importingId === photo.id" class="photo-loading-overlay">Importing…</div>
          </div>
        </div>

        <div v-if="totalPages > 1" class="pagination">
          <button
            class="action-btn secondary"
            :disabled="currentPage <= 1 || searching"
            @click="runSearch(currentPage - 1)"
          >
            Previous
          </button>
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <button
            class="action-btn secondary"
            :disabled="currentPage >= totalPages || searching"
            @click="runSearch(currentPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, type Ref } from 'vue';
import type { DirectusFile, UnsplashPhoto, UnsplashSearchResponse } from '../types';

const MAX_FILE_SIZE_MB = 10;

const props = defineProps<{
  value?: string | null;
  disabled?: boolean;
  folder?: string | null;
  letterbox?: boolean;
}>();

const emit = defineEmits<{
  (e: 'input', value: string | null): void;
}>();

const api = inject<{
  get: (path: string, config?: { params?: Record<string, unknown> }) => Promise<{ data?: unknown }>;
  post: (path: string, data?: unknown) => Promise<{ data?: { data?: { id?: string } } }>;
}>('api');

// ─── Current image ────────────────────────────────────────────────────────────

const previewUrl = computed((): string | null => {
  if (!props.value) return null;
  return `/assets/${props.value}?fit=cover&width=400&height=300`;
});

function removeImage(): void {
  emit('input', null);
}

// ─── Local file upload ────────────────────────────────────────────────────────

const fileInputRef: Ref<HTMLInputElement | null> = ref(null);
const uploadError: Ref<string | null> = ref(null);

function triggerFileUpload(): void {
  uploadError.value = null;
  fileInputRef.value?.click();
}

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Reset so re-selecting the same file still fires
  input.value = '';
  uploadError.value = null;

  // Client-side validation
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Only image files are supported.';
    return;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    uploadError.value = `File must be under ${MAX_FILE_SIZE_MB} MB.`;
    return;
  }

  try {
    const formData = new FormData();
    if (props.folder) formData.append('folder', props.folder);
    formData.append('file', file);

    const response = await api?.post('/files', formData);
    const fileId = response?.data?.data?.id ?? null;
    emit('input', fileId);
  } catch (err) {
    const apiMessage = (err as { response?: { data?: { errors?: { message?: string }[] } } })
      ?.response?.data?.errors?.[0]?.message;
    uploadError.value = 'Upload failed: ' + (apiMessage ?? (err as Error).message ?? 'Unknown error');
  }
}

// ─── Directus library browser ─────────────────────────────────────────────────

const libraryOpen: Ref<boolean> = ref(false);
const librarySearch: Ref<string> = ref('');
const libraryFiles: Ref<DirectusFile[]> = ref([]);
const libraryLoading: Ref<boolean> = ref(false);
const libraryPage: Ref<number> = ref(1);
const libraryTotalPages: Ref<number> = ref(1);
const libraryPageSize = 24;
let libraryDebounce: ReturnType<typeof setTimeout> | null = null;

function openLibrary(): void {
  libraryOpen.value = true;
  loadLibraryPage(1);
}

function closeLibrary(): void {
  libraryOpen.value = false;
}

function onLibrarySearchInput(): void {
  if (libraryDebounce) clearTimeout(libraryDebounce);
  libraryDebounce = setTimeout(() => loadLibraryPage(1), 400);
}

async function loadLibraryPage(page: number): Promise<void> {
  libraryLoading.value = true;
  libraryPage.value = page;
  try {
    const params: Record<string, unknown> = {
      limit: libraryPageSize,
      offset: (page - 1) * libraryPageSize,
      fields: ['id', 'title', 'filename_download', 'type'],
      sort: ['-uploaded_on'],
      'filter[type][_starts_with]': 'image/',
      meta: 'filter_count',
    };
    if (librarySearch.value.trim()) {
      params['filter[title][_icontains]'] = librarySearch.value.trim();
    }
    const response = await api?.get('/files', { params });
    const body = response?.data as { data?: DirectusFile[]; meta?: { filter_count?: number } } | undefined;
    libraryFiles.value = body?.data ?? [];
    // Use meta.filter_count for the true total across all pages.
    // Fall back to page size only if the meta field is completely absent (shouldn't happen).
    const total = body?.meta?.filter_count ?? null;
    libraryTotalPages.value = total !== null
      ? Math.max(1, Math.ceil(total / libraryPageSize))
      : 1;
  } catch {
    libraryFiles.value = [];
    libraryTotalPages.value = 1;
  } finally {
    libraryLoading.value = false;
  }
}

function selectLibraryFile(file: DirectusFile): void {
  emit('input', file.id);
  closeLibrary();
}

// ─── Unsplash search ──────────────────────────────────────────────────────────

const modalOpen: Ref<boolean> = ref(false);
const searchQuery: Ref<string> = ref('');
const photos: Ref<UnsplashPhoto[]> = ref([]);
const searching: Ref<boolean> = ref(false);
const searchError: Ref<string | null> = ref(null);
const hasSearched: Ref<boolean> = ref(false);
const currentPage: Ref<number> = ref(1);
const totalPages: Ref<number> = ref(1);
const importingId: Ref<string | null> = ref(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function openUnsplash(): void {
  modalOpen.value = true;
}

function closeUnsplash(): void {
  modalOpen.value = false;
}

function onSearchInput(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (searchQuery.value.trim()) runSearch(1);
  }, 400);
}

async function runSearch(page: number): Promise<void> {
  const q = searchQuery.value.trim();
  if (!q) return;

  searching.value = true;
  searchError.value = null;
  hasSearched.value = true;

  try {
    const response = await api?.get('/unsplash/search', {
      params: { q, page, per_page: 24 },
    });
    const data = response?.data as UnsplashSearchResponse;
    photos.value = data.results ?? [];
    currentPage.value = data.page;
    totalPages.value = data.total_pages || 1;
  } catch (err) {
    const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    searchError.value = 'Search failed: ' + (apiError ?? (err as Error).message ?? 'Unknown error');
    photos.value = [];
  } finally {
    searching.value = false;
  }
}

async function selectPhoto(photo: UnsplashPhoto): Promise<void> {
  // Ignore clicks while another import is in-flight
  if (importingId.value) return;

  importingId.value = photo.id;
  uploadError.value = null;

  try {
    const importPayload = {
      url: photo.urls.regular,
      data: {
        title: photo.description || `Unsplash photo by ${photo.user.name}`,
        ...(props.folder ? { folder: props.folder } : {}),
      },
    };
    const response = await api?.post('/files/import', importPayload);
    const fileId = response?.data?.data?.id;
    if (fileId) {
      emit('input', fileId);
      closeUnsplash();
    } else {
      uploadError.value = 'Import succeeded but no file ID was returned.';
    }

    // Unsplash API requirement: trigger download attribution (fire-and-forget)
    api?.post('/unsplash/trigger-download', { download_location: photo.download_location }).catch(() => {});
  } catch (err) {
    const apiMessage = (err as { response?: { data?: { errors?: { message?: string }[] } } })
      ?.response?.data?.errors?.[0]?.message;
    uploadError.value = 'Import failed: ' + (apiMessage ?? (err as Error).message ?? 'Unknown error');
  } finally {
    // Always clear the importing state, even on error, so the UI doesn't get stuck
    importingId.value = null;
  }
}
</script>

<style scoped>
.unsplash-image-interface {
  font-family: var(--theme--fonts--sans--font-family);
  color: var(--theme--foreground);
}

.preview-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 12px;
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  overflow: hidden;
}

.preview-wrapper.letterbox {
  background: var(--theme--background-subdued);
}

.preview-img {
  display: block;
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
}

.preview-actions {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: var(--theme--background-subdued);
}

.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 6px 14px;
  border-radius: var(--theme--border-radius);
  border: 1px solid var(--theme--border-color);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: opacity 0.15s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.action-btn.primary {
  background: var(--theme--primary);
  color: #fff;
  border-color: var(--theme--primary);
}

.action-btn.secondary {
  background: var(--theme--background-subdued);
  color: var(--theme--foreground);
}

.action-btn.danger {
  background: var(--theme--danger, #e35169);
  color: #fff;
  border-color: transparent;
}

.error-msg {
  margin-top: 8px;
  color: var(--theme--danger, #e35169);
  font-size: 13px;
}

.loading {
  padding: 24px;
  text-align: center;
  color: var(--theme--foreground-subdued);
}

.empty {
  padding: 24px;
  text-align: center;
  color: var(--theme--foreground-subdued);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal {
  background: var(--theme--background);
  border-radius: var(--theme--border-radius);
  width: min(900px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--theme--border-color);
}

.modal-title {
  font-weight: 600;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: var(--theme--foreground-subdued);
  padding: 4px 8px;
}

.close-btn:hover {
  color: var(--theme--foreground);
}

.search-bar {
  padding: 16px 20px 8px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  background: var(--theme--background-subdued);
  color: var(--theme--foreground);
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.search-input:focus {
  outline: 2px solid var(--theme--primary);
  outline-offset: 1px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
  padding: 12px 20px;
  overflow-y: auto;
  flex: 1;
}

.photo-card {
  position: relative;
  border-radius: var(--theme--border-radius);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}

.photo-card:hover {
  border-color: var(--theme--primary);
}

.photo-card.loading {
  pointer-events: none;
}

.photo-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
}

.photo-attr {
  padding: 4px 6px;
  font-size: 10px;
  color: var(--theme--foreground-subdued);
  background: var(--theme--background-subdued);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.photo-attr a {
  color: var(--theme--primary);
  text-decoration: none;
}

.photo-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--theme--border-color);
}

.page-info {
  font-size: 13px;
  color: var(--theme--foreground-subdued);
}
</style>
