<template>
  <div class="footer-nav-editor">
    <!-- Empty state -->
    <p v-if="columns.length === 0" class="empty-hint">
      Noch keine Spalten. Klicken Sie unten auf „Spalte hinzufügen".
    </p>

    <!-- Columns list -->
    <div
      v-for="(col, ci) in columns"
      :key="col.id"
      class="column-block"
    >
      <!-- Column header row -->
      <div class="column-header">
        <span class="column-label">
          Spalte {{ ci + 1 }}: <strong>{{ col.title || '(kein Titel)' }}</strong>
          <em class="link-count"> — {{ col.links.length }} Link(s)</em>
        </span>
        <div class="actions">
          <button :disabled="ci === 0 || disabled" @click="moveColumn(ci, -1)" title="Nach oben">↑</button>
          <button :disabled="ci === columns.length - 1 || disabled" @click="moveColumn(ci, 1)" title="Nach unten">↓</button>
          <button :disabled="disabled" @click="toggleEditColumn(ci)" title="Bearbeiten">✏</button>
          <button class="danger" :disabled="disabled" @click="removeColumn(ci)" title="Entfernen">×</button>
        </div>
      </div>

      <!-- Column edit form -->
      <div v-if="editingColumn === ci" class="edit-form column-edit-form">
        <label>
          Spaltenüberschrift
          <input v-model="columnBuffer.title" placeholder="z.B. Kommunen & Bewertung" />
        </label>
        <div class="form-actions">
          <button class="btn-save" @click="saveColumn(ci)">Speichern</button>
          <button class="btn-cancel" @click="cancelEditColumn">Abbrechen</button>
        </div>
      </div>

      <!-- Links list -->
      <div class="links-list">
        <div
          v-for="(link, li) in col.links"
          :key="link.id"
          class="link-row"
        >
          <div class="link-info">
            <span
              class="type-badge"
              :class="link.link_type === 'page' ? 'badge-page' : 'badge-ext'"
            >
              {{ link.link_type === 'page' ? 'Seite' : 'Extern' }}
            </span>
            <span class="link-label" :title="link.label || ''">{{ link.label || '(kein Label)' }}</span>
            <span
              class="link-target"
              :title="link.link_type === 'page' ? '/' + link.page_slug : link.external_url"
            >
              {{ link.link_type === 'page' ? '/' + link.page_slug : link.external_url }}
            </span>
          </div>
          <div class="actions">
            <button :disabled="li === 0 || disabled" @click="moveLink(ci, li, -1)" title="Nach oben">↑</button>
            <button :disabled="li === col.links.length - 1 || disabled" @click="moveLink(ci, li, 1)" title="Nach unten">↓</button>
            <button :disabled="disabled" @click="toggleEditLink(ci, li)" title="Bearbeiten">✏</button>
            <button class="danger" :disabled="disabled" @click="removeLink(ci, li)" title="Entfernen">×</button>
          </div>
        </div>

        <!-- Link edit form — guard uses optional chaining to avoid null[0] crash -->
        <div
          v-if="editingLink?.[0] === ci"
          class="edit-form link-edit-form"
        >
          <div class="form-grid">
            <label>
              Label
              <input v-model="linkBuffer.label" placeholder="z.B. Gemeinden" />
            </label>

            <label>
              Link-Typ
              <select v-model="linkBuffer.link_type">
                <option value="page">Interne Seite</option>
                <option value="external">Externe URL</option>
              </select>
            </label>

            <label v-if="linkBuffer.link_type === 'page'" class="slug-wrapper">
              Seiten-Slug
              <input
                v-model="linkBuffer.page_slug"
                placeholder="z.B. municipalities"
                @input="onSlugInput"
              />
              <ul v-if="pageResults.length" class="autocomplete">
                <li
                  v-for="p in pageResults"
                  :key="p.slug"
                  @mousedown.prevent="handleSelectPage(p)"
                >
                  {{ p.name }} <span class="slug-hint">/{{ p.slug }}</span>
                </li>
              </ul>
            </label>

            <label v-if="linkBuffer.link_type === 'external'">
              Externe URL
              <input v-model="linkBuffer.external_url" placeholder="https://..." />
            </label>

            <label v-if="linkBuffer.link_type === 'external'" class="checkbox-label">
              <input type="checkbox" v-model="linkBuffer.open_new_tab" />
              In neuem Tab öffnen
            </label>
          </div>

          <div class="form-actions">
            <button class="btn-save" @click="saveLink(ci, editingLink![1])">Speichern</button>
            <button class="btn-cancel" @click="cancelEditLink">Abbrechen</button>
          </div>
        </div>

        <button v-if="!disabled" class="btn-add-link" @click="addLink(ci)">+ Link hinzufügen</button>
      </div>
    </div>

    <!-- Add column button -->
    <button v-if="!disabled" class="btn-add-column" @click="addColumn">+ Spalte hinzufügen</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, inject, type Ref } from 'vue';
import type { Page } from '../types';
import { usePageSearch } from '../usePageSearch';

interface ColumnLink {
  id: string;
  label: string;
  link_type: 'page' | 'external';
  page_slug: string;
  external_url: string;
  open_new_tab: boolean;
}

interface Column {
  id: string;
  title: string;
  links: ColumnLink[];
}

interface LinkBuffer {
  label: string;
  link_type: 'page' | 'external';
  page_slug: string;
  external_url: string;
  open_new_tab: boolean;
}

const props = defineProps<{
  value?: string | Column[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'input', value: Column[]): void;
}>();

const api = inject<{
  get: (path: string, config?: Record<string, unknown>) => Promise<{ data?: { data?: unknown } }>;
}>('api');

// ─── State ───────────────────────────────────────────────────────────────────

const columns: Ref<Column[]> = ref([]);
const editingColumn: Ref<number | null> = ref(null);
const columnBuffer: Ref<{ title: string }> = ref({ title: '' });
const editingLink: Ref<[number, number] | null> = ref(null);
const linkBuffer: Ref<LinkBuffer> = ref(newLinkDefaults());

const { pageResults, search, selectPage, clear: clearPageResults } = usePageSearch(api);

// ─── Parse incoming value ─────────────────────────────────────────────────────

watch(
  () => props.value,
  (val) => {
    if (!val) { columns.value = []; return; }
    try {
      columns.value = JSON.parse(typeof val === 'string' ? val : JSON.stringify(val));
    } catch {
      columns.value = [];
    }
  },
  { immediate: true },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return 'col-' + Math.random().toString(36).slice(2, 9);
}

function newLinkDefaults(): LinkBuffer {
  return { label: '', link_type: 'page', page_slug: '', external_url: '', open_new_tab: false };
}

function emitUpdate(): void {
  emit('input', JSON.parse(JSON.stringify(columns.value)));
}

// ─── Slug autocomplete ────────────────────────────────────────────────────────

function onSlugInput(): void {
  search(linkBuffer.value.page_slug?.trim() ?? '');
}

function handleSelectPage(page: Page): void {
  selectPage(page, linkBuffer.value);
}

// ─── Column CRUD ──────────────────────────────────────────────────────────────

function addColumn(): void {
  columns.value.push({ id: uid(), title: '', links: [] });
  const ci = columns.value.length - 1;
  columnBuffer.value = { title: '' };
  editingColumn.value = ci;
  editingLink.value = null;
  // Intentionally not emitting until the user saves the column title
}

function removeColumn(ci: number): void {
  columns.value.splice(ci, 1);
  editingColumn.value = null;
  editingLink.value = null;
  emitUpdate();
}

function moveColumn(ci: number, dir: number): void {
  const arr = columns.value;
  const j = ci + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[ci], arr[j]] = [arr[j], arr[ci]];
  emitUpdate();
}

function toggleEditColumn(ci: number): void {
  if (editingColumn.value === ci) {
    editingColumn.value = null;
    return;
  }
  editingLink.value = null;
  columnBuffer.value = { title: columns.value[ci].title };
  editingColumn.value = ci;
}

function saveColumn(ci: number): void {
  columns.value[ci].title = columnBuffer.value.title;
  editingColumn.value = null;
  emitUpdate();
}

function cancelEditColumn(): void {
  // If the column was just added and has no title, remove it
  if (editingColumn.value !== null && columns.value[editingColumn.value]?.links.length === 0 && !columns.value[editingColumn.value]?.title) {
    columns.value.splice(editingColumn.value, 1);
  }
  editingColumn.value = null;
}

// ─── Link CRUD ────────────────────────────────────────────────────────────────

function addLink(ci: number): void {
  const newLink: ColumnLink = { id: uid(), ...newLinkDefaults() };
  columns.value[ci].links.push(newLink);
  const li = columns.value[ci].links.length - 1;
  editingColumn.value = null;
  linkBuffer.value = { ...newLinkDefaults() };
  editingLink.value = [ci, li];
  clearPageResults();
  // Intentionally not emitting until the user saves the link
}

function removeLink(ci: number, li: number): void {
  columns.value[ci].links.splice(li, 1);
  editingLink.value = null;
  emitUpdate();
}

function moveLink(ci: number, li: number, dir: number): void {
  const arr = columns.value[ci].links;
  const j = li + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[li], arr[j]] = [arr[j], arr[li]];
  emitUpdate();
}

function toggleEditLink(ci: number, li: number): void {
  if (editingLink.value?.[0] === ci && editingLink.value?.[1] === li) {
    editingLink.value = null;
    return;
  }
  editingColumn.value = null;
  const link = columns.value[ci].links[li];
  linkBuffer.value = {
    label: link.label || '',
    link_type: link.link_type || 'page',
    page_slug: link.page_slug || '',
    external_url: link.external_url || '',
    open_new_tab: link.open_new_tab || false,
  };
  editingLink.value = [ci, li];
  clearPageResults();
}

function saveLink(ci: number, li: number): void {
  const link = columns.value[ci].links[li];
  link.label = linkBuffer.value.label;
  link.link_type = linkBuffer.value.link_type;
  link.page_slug = linkBuffer.value.link_type === 'page' ? linkBuffer.value.page_slug : '';
  link.external_url = linkBuffer.value.link_type === 'external' ? linkBuffer.value.external_url : '';
  link.open_new_tab = linkBuffer.value.open_new_tab;
  editingLink.value = null;
  clearPageResults();
  emitUpdate();
}

function cancelEditLink(): void {
  // If the link was just added and is empty, remove it
  if (editingLink.value) {
    const [ci, li] = editingLink.value;
    const link = columns.value[ci]?.links[li];
    if (link && !link.label && !link.page_slug && !link.external_url) {
      columns.value[ci].links.splice(li, 1);
    }
  }
  editingLink.value = null;
  clearPageResults();
}
</script>

<style scoped>
.footer-nav-editor {
  font-family: var(--theme--fonts--sans--font-family, sans-serif);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-hint {
  color: var(--theme--foreground-subdued, #999);
  font-style: italic;
  padding: 8px 0;
}

.column-block {
  border: 1px solid var(--theme--border-color, #e0e0e0);
  border-radius: var(--theme--border-radius, 6px);
  overflow: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--theme--background-subdued, #f5f5f5);
  border-bottom: 1px solid var(--theme--border-color, #e0e0e0);
}

.column-label {
  font-weight: 500;
  color: var(--theme--foreground, #333);
}

.column-label strong {
  color: var(--theme--primary, #1a56db);
}

.link-count {
  font-size: 11px;
  color: var(--theme--foreground-subdued, #888);
  font-style: normal;
}

.links-list {
  padding: 8px 12px;
  background: var(--theme--background, #fff);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  background: var(--theme--background-subdued, #fafafa);
  border-radius: var(--theme--border-radius, 4px);
  border: 1px solid var(--theme--border-color-subdued, #ebebeb);
}

.link-info {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.link-label {
  font-weight: 500;
  color: var(--theme--foreground, #222);
}

.link-target {
  font-size: 11px;
  color: var(--theme--foreground-subdued, #888);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.type-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-page {
  background: var(--theme--primary-background, #dbeafe);
  color: var(--theme--primary, #1d4ed8);
}

.badge-ext {
  background: var(--theme--warning-background, #fef3c7);
  color: var(--theme--warning, #b45309);
}

.actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.actions button {
  padding: 2px 6px;
  border: 1px solid var(--theme--border-color, #ccc);
  border-radius: 3px;
  background: var(--theme--background, #fff);
  cursor: pointer;
  font-size: 12px;
  color: var(--theme--foreground, #444);
  line-height: 1.4;
}

.actions button:hover:not(:disabled) {
  background: var(--theme--background-subdued, #f0f0f0);
}

.actions button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.actions button.danger {
  color: var(--theme--danger, #dc2626);
  border-color: var(--theme--danger-light, #fca5a5);
}

.actions button.danger:hover:not(:disabled) {
  background: var(--theme--danger-background, #fee2e2);
}

/* Edit forms */
.edit-form {
  background: var(--theme--primary-background, #f0f7ff);
  border-top: 1px solid var(--theme--primary-subdued, #bfdbfe);
  padding: 12px;
}

.link-edit-form {
  margin: 4px 0;
  border-radius: var(--theme--border-radius, 4px);
}

.column-edit-form {
  border-top: 1px solid var(--theme--primary-subdued, #bfdbfe);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.edit-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--theme--foreground-subdued, #555);
  font-weight: 500;
  position: relative;
}

/* slug-wrapper gives the autocomplete dropdown a positioned ancestor */
.slug-wrapper {
  position: relative;
}

.edit-form input,
.edit-form select {
  padding: 5px 8px;
  border: 1px solid var(--theme--border-color, #ccc);
  border-radius: var(--theme--border-radius, 4px);
  font-size: 13px;
  background: var(--theme--background, #fff);
  color: var(--theme--foreground, #333);
}

.edit-form input:focus,
.edit-form select:focus {
  outline: none;
  border-color: var(--theme--primary, #1a56db);
  box-shadow: 0 0 0 2px var(--theme--primary-background, rgba(26, 86, 219, 0.1));
}

.checkbox-label {
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
}

.checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  margin: 0;
}

.autocomplete {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  background: var(--theme--background, #fff);
  border: 1px solid var(--theme--border-color, #ccc);
  border-radius: var(--theme--border-radius, 4px);
  margin-top: 2px;
  list-style: none;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 280px;
}

.autocomplete li {
  padding: 7px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--theme--foreground, #333);
}

.autocomplete li:hover {
  background: var(--theme--primary-background, #f0f7ff);
}

.slug-hint {
  font-size: 11px;
  color: var(--theme--foreground-subdued, #888);
  font-family: monospace;
  margin-left: 6px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.btn-save {
  padding: 5px 14px;
  background: var(--theme--primary, #1a56db);
  color: #fff;
  border: none;
  border-radius: var(--theme--border-radius, 4px);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.btn-save:hover {
  background: var(--theme--primary-accent, #1e40af);
}

.btn-cancel {
  padding: 5px 14px;
  background: var(--theme--background, #fff);
  color: var(--theme--foreground-subdued, #555);
  border: 1px solid var(--theme--border-color, #ccc);
  border-radius: var(--theme--border-radius, 4px);
  cursor: pointer;
  font-size: 12px;
}

.btn-cancel:hover {
  background: var(--theme--background-subdued, #f5f5f5);
}

.btn-add-link {
  margin-top: 6px;
  padding: 5px 10px;
  background: transparent;
  border: 1px dashed var(--theme--border-color, #aaa);
  border-radius: var(--theme--border-radius, 4px);
  color: var(--theme--foreground-subdued, #666);
  cursor: pointer;
  font-size: 12px;
  width: 100%;
  text-align: left;
}

.btn-add-link:hover {
  border-color: var(--theme--primary, #1a56db);
  color: var(--theme--primary, #1a56db);
  background: var(--theme--primary-background, #f0f7ff);
}

.btn-add-column {
  padding: 8px 16px;
  background: transparent;
  border: 2px dashed var(--theme--border-color, #aaa);
  border-radius: var(--theme--border-radius, 6px);
  color: var(--theme--foreground-subdued, #666);
  cursor: pointer;
  font-size: 13px;
  width: 100%;
  text-align: center;
}

.btn-add-column:hover {
  border-color: var(--theme--primary, #1a56db);
  color: var(--theme--primary, #1a56db);
  background: var(--theme--primary-background, #f0f7ff);
}
</style>
