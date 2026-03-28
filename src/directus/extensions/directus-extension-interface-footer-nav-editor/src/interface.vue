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
          <button :disabled="ci === 0" @click="moveColumn(ci, -1)" title="Nach oben">↑</button>
          <button :disabled="ci === columns.length - 1" @click="moveColumn(ci, 1)" title="Nach unten">↓</button>
          <button @click="toggleEditColumn(ci)" title="Bearbeiten">✏</button>
          <button class="danger" @click="removeColumn(ci)" title="Entfernen">×</button>
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
            <span class="link-label">{{ link.label || '(kein Label)' }}</span>
            <span class="link-target">
              {{ link.link_type === 'page' ? '/' + link.page_slug : link.external_url }}
            </span>
          </div>
          <div class="actions">
            <button :disabled="li === 0" @click="moveLink(ci, li, -1)" title="Nach oben">↑</button>
            <button :disabled="li === col.links.length - 1" @click="moveLink(ci, li, 1)" title="Nach unten">↓</button>
            <button @click="toggleEditLink(ci, li)" title="Bearbeiten">✏</button>
            <button class="danger" @click="removeLink(ci, li)" title="Entfernen">×</button>
          </div>
        </div>

        <!-- Link edit form -->
        <div v-if="editingLink && editingLink[0] === ci && editingLink[1] !== null" class="edit-form link-edit-form">
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

            <label v-if="linkBuffer.link_type === 'page'">
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
                  @mousedown.prevent="selectPage(p)"
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
            <button class="btn-save" @click="saveLink(ci, editingLink[1])">Speichern</button>
            <button class="btn-cancel" @click="cancelEditLink">Abbrechen</button>
          </div>
        </div>

        <button class="btn-add-link" @click="addLink(ci)">+ Link hinzufügen</button>
      </div>
    </div>

    <!-- Add column button -->
    <button class="btn-add-column" @click="addColumn">+ Spalte hinzufügen</button>
  </div>
</template>

<script setup>
import { ref, watch, inject } from 'vue'

const props = defineProps({
  value: {
    type: [Array, String],
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['input'])
const api = inject('api')

// ─── State ───────────────────────────────────────────────────────────────────

const columns = ref([])
const editingColumn = ref(null)   // index of column being edited
const columnBuffer = ref({ title: '' })
const editingLink = ref(null)     // [colIndex, linkIndex] or null
const linkBuffer = ref(newLinkDefaults())
const pageResults = ref([])

// ─── Parse incoming value ─────────────────────────────────────────────────────

watch(
  () => props.value,
  (val) => {
    if (!val) { columns.value = []; return }
    try {
      columns.value = JSON.parse(typeof val === 'string' ? val : JSON.stringify(val))
    } catch {
      columns.value = []
    }
  },
  { immediate: true },
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return 'col-' + Math.random().toString(36).slice(2, 9)
}

function newLinkDefaults() {
  return { label: '', link_type: 'page', page_slug: '', external_url: '', open_new_tab: false }
}

function emit_update() {
  emit('input', JSON.parse(JSON.stringify(columns.value)))
}

// ─── Column CRUD ──────────────────────────────────────────────────────────────

function addColumn() {
  columns.value.push({ id: uid(), title: '', links: [] })
  const ci = columns.value.length - 1
  columnBuffer.value = { title: '' }
  editingColumn.value = ci
  editingLink.value = null
  emit_update()
}

function removeColumn(ci) {
  columns.value.splice(ci, 1)
  editingColumn.value = null
  editingLink.value = null
  emit_update()
}

function moveColumn(ci, dir) {
  const arr = columns.value
  const j = ci + dir
  if (j < 0 || j >= arr.length) return;
  [arr[ci], arr[j]] = [arr[j], arr[ci]]
  emit_update()
}

function toggleEditColumn(ci) {
  if (editingColumn.value === ci) {
    editingColumn.value = null
    return
  }
  editingLink.value = null
  columnBuffer.value = { title: columns.value[ci].title }
  editingColumn.value = ci
}

function saveColumn(ci) {
  columns.value[ci].title = columnBuffer.value.title
  editingColumn.value = null
  emit_update()
}

function cancelEditColumn() {
  editingColumn.value = null
}

// ─── Link CRUD ────────────────────────────────────────────────────────────────

function addLink(ci) {
  const newLink = { id: uid(), ...newLinkDefaults() }
  columns.value[ci].links.push(newLink)
  const li = columns.value[ci].links.length - 1
  editingColumn.value = null
  linkBuffer.value = { ...newLinkDefaults() }
  editingLink.value = [ci, li]
  pageResults.value = []
  emit_update()
}

function removeLink(ci, li) {
  columns.value[ci].links.splice(li, 1)
  editingLink.value = null
  emit_update()
}

function moveLink(ci, li, dir) {
  const arr = columns.value[ci].links
  const j = li + dir
  if (j < 0 || j >= arr.length) return;
  [arr[li], arr[j]] = [arr[j], arr[li]]
  emit_update()
}

function toggleEditLink(ci, li) {
  if (editingLink.value && editingLink.value[0] === ci && editingLink.value[1] === li) {
    editingLink.value = null
    return
  }
  editingColumn.value = null
  const link = columns.value[ci].links[li]
  linkBuffer.value = {
    label: link.label || '',
    link_type: link.link_type || 'page',
    page_slug: link.page_slug || '',
    external_url: link.external_url || '',
    open_new_tab: link.open_new_tab || false,
  }
  editingLink.value = [ci, li]
  pageResults.value = []
}

function saveLink(ci, li) {
  const link = columns.value[ci].links[li]
  link.label = linkBuffer.value.label
  link.link_type = linkBuffer.value.link_type
  link.page_slug = linkBuffer.value.link_type === 'page' ? linkBuffer.value.page_slug : null
  link.external_url = linkBuffer.value.link_type === 'external' ? linkBuffer.value.external_url : null
  link.open_new_tab = linkBuffer.value.open_new_tab
  editingLink.value = null
  pageResults.value = []
  emit_update()
}

function cancelEditLink() {
  editingLink.value = null
  pageResults.value = []
}

// ─── Page slug autocomplete ───────────────────────────────────────────────────

let searchTimeout = null

function onSlugInput() {
  clearTimeout(searchTimeout)
  const q = linkBuffer.value.page_slug?.trim()
  if (!q || q.length < 2) { pageResults.value = []; return }
  searchTimeout = setTimeout(async () => {
    try {
      const res = await api.get('/items/pages', {
        params: {
          search: q,
          'filter[status][_eq]': 'published',
          'fields[]': ['name', 'slug'],
          limit: 6,
        },
      })
      pageResults.value = res.data?.data || []
    } catch {
      pageResults.value = []
    }
  }, 300)
}

function selectPage(page) {
  linkBuffer.value.page_slug = page.slug
  if (!linkBuffer.value.label) linkBuffer.value.label = page.name
  pageResults.value = []
}
</script>

<style scoped>
.footer-nav-editor {
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-hint {
  color: #999;
  font-style: italic;
  padding: 8px 0;
}

.column-block {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.column-label {
  font-weight: 500;
  color: #333;
}

.column-label strong {
  color: #1a56db;
}

.link-count {
  font-size: 11px;
  color: #888;
  font-style: normal;
}

.links-list {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #ebebeb;
}

.link-info {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.link-label {
  font-weight: 500;
  color: #222;
}

.link-target {
  font-size: 11px;
  color: #888;
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
  background: #dbeafe;
  color: #1d4ed8;
}

.badge-ext {
  background: #fef3c7;
  color: #b45309;
}

.actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.actions button {
  padding: 2px 6px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #444;
  line-height: 1.4;
}

.actions button:hover:not(:disabled) {
  background: #f0f0f0;
}

.actions button:disabled {
  opacity: 0.3;
  cursor: default;
}

.actions button.danger {
  color: #dc2626;
  border-color: #fca5a5;
}

.actions button.danger:hover {
  background: #fee2e2;
}

/* Edit forms */
.edit-form {
  background: #f0f7ff;
  border-top: 1px solid #bfdbfe;
  padding: 12px;
}

.link-edit-form {
  margin: 4px 0;
  border-radius: 4px;
}

.column-edit-form {
  border-top: 1px solid #bfdbfe;
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
  color: #555;
  font-weight: 500;
}

.edit-form input,
.edit-form select {
  padding: 5px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  background: #fff;
}

.edit-form input:focus,
.edit-form select:focus {
  outline: none;
  border-color: #1a56db;
  box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.1);
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
  z-index: 100;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-top: 2px;
  list-style: none;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 280px;
}

.autocomplete li {
  padding: 7px 10px;
  cursor: pointer;
  font-size: 13px;
}

.autocomplete li:hover {
  background: #f0f7ff;
}

.slug-hint {
  font-size: 11px;
  color: #888;
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
  background: #1a56db;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.btn-save:hover {
  background: #1e40af;
}

.btn-cancel {
  padding: 5px 14px;
  background: #fff;
  color: #555;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-add-link {
  margin-top: 6px;
  padding: 5px 10px;
  background: transparent;
  border: 1px dashed #aaa;
  border-radius: 4px;
  color: #666;
  cursor: pointer;
  font-size: 12px;
  width: 100%;
  text-align: left;
}

.btn-add-link:hover {
  border-color: #1a56db;
  color: #1a56db;
  background: #f0f7ff;
}

.btn-add-column {
  padding: 8px 16px;
  background: transparent;
  border: 2px dashed #aaa;
  border-radius: 6px;
  color: #666;
  cursor: pointer;
  font-size: 13px;
  width: 100%;
  text-align: center;
}

.btn-add-column:hover {
  border-color: #1a56db;
  color: #1a56db;
  background: #f0f7ff;
}
</style>
