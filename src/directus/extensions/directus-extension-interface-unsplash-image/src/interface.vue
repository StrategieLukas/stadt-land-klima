<template>
  <div class="unsplash-image-interface">
    <!-- Current image preview -->
    <div v-if="props.value" class="preview-wrapper" :class="{ letterbox: props.letterbox }">
      <img :src="previewUrl" alt="" class="preview-img" />
      <div class="preview-actions">
        <button class="action-btn danger" :disabled="props.disabled" @click="removeImage">
          Remove
        </button>
        <a :href="previewUrl" target="_blank" rel="noopener" class="action-btn secondary">
          View
        </a>
      </div>
    </div>

    <!-- Upload / search buttons -->
    <div v-if="!props.disabled" class="button-row">
      <button class="action-btn primary" @click="triggerFileUpload">
        Upload file
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

    <!-- Unsplash modal overlay -->
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
            <img :src="photo.urls.small" :alt="photo.description" class="photo-thumb" loading="lazy" />
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

<script setup>
import { ref, computed, inject } from 'vue';

const props = defineProps({
  value: { type: String, default: null },
  disabled: { type: Boolean, default: false },
  folder: { type: String, default: null },
  letterbox: { type: Boolean, default: false },
});

const emit = defineEmits(['input']);

const api = inject('api');

// ─── Current image ───────────────────────────────────────────────────────────

const previewUrl = computed(() => {
  if (!props.value) return null;
  return `/assets/${props.value}?fit=cover&width=400&height=300`;
});

function removeImage() {
  emit('input', null);
}

// ─── Local file upload ────────────────────────────────────────────────────────

const fileInputRef = ref(null);
const uploadError = ref(null);

function triggerFileUpload() {
  uploadError.value = null;
  fileInputRef.value?.click();
}

async function onFileChosen(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Reset input so re-selecting same file still fires change
  event.target.value = '';

  uploadError.value = null;
  try {
    const formData = new FormData();
    if (props.folder) formData.append('folder', props.folder);
    formData.append('file', file);

    const response = await api.post('/files', formData);
    emit('input', response.data?.data?.id ?? null);
  } catch (err) {
    uploadError.value = 'Upload failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
  }
}

// ─── Unsplash modal ───────────────────────────────────────────────────────────

const modalOpen = ref(false);
const searchQuery = ref('');
const photos = ref([]);
const searching = ref(false);
const searchError = ref(null);
const hasSearched = ref(false);
const currentPage = ref(1);
const totalPages = ref(1);
const importingId = ref(null);

let debounceTimer = null;

function openUnsplash() {
  modalOpen.value = true;
}

function closeUnsplash() {
  modalOpen.value = false;
}

function onSearchInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (searchQuery.value.trim()) runSearch(1);
  }, 400);
}

async function runSearch(page) {
  const q = searchQuery.value.trim();
  if (!q) return;

  searching.value = true;
  searchError.value = null;
  hasSearched.value = true;

  try {
    const response = await api.get('/unsplash/search', {
      params: { q, page, per_page: 24 },
    });
    const data = response.data;
    photos.value = data.results || [];
    currentPage.value = data.page;
    totalPages.value = data.total_pages || 1;
  } catch (err) {
    searchError.value = 'Search failed: ' + (err.response?.data?.error || err.message);
    photos.value = [];
  } finally {
    searching.value = false;
  }
}

async function selectPhoto(photo) {
  if (importingId.value) return;
  importingId.value = photo.id;
  uploadError.value = null;

  try {
    // Import the photo into Directus files
    const importPayload = {
      url: photo.urls.regular,
      data: {
        title: photo.description || `Unsplash photo by ${photo.user.name}`,
        ...(props.folder ? { folder: props.folder } : {}),
      },
    };
    const response = await api.post('/files/import', importPayload);
    const fileId = response.data?.data?.id;
    if (fileId) {
      emit('input', fileId);
      closeUnsplash();
    }

    // Trigger attribution download (Unsplash API requirement — fire-and-forget)
    api.post('/unsplash/trigger-download', { download_location: photo.download_location }).catch(() => {});
  } catch (err) {
    uploadError.value = 'Import failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
  } finally {
    importingId.value = null;
  }
}
</script>

<style scoped>
.unsplash-image-interface {
  font-family: var(--theme--fonts--sans--font-family);
  color: var(--theme--foreground);
}

/* ── Preview ─────────────────────────────────────────────────── */
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

/* ── Buttons ─────────────────────────────────────────────────── */
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

/* ── Error / loading ─────────────────────────────────────────── */
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

/* ── Modal overlay ───────────────────────────────────────────── */
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

/* ── Search bar ──────────────────────────────────────────────── */
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

/* ── Photo grid ──────────────────────────────────────────────── */
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

/* ── Pagination ──────────────────────────────────────────────── */
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
