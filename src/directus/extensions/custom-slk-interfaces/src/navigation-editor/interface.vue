<template>
  <div class="navigation-editor">
    <div v-if="!items.length" class="empty-state">
      Noch keine Navigationspunkte vorhanden.
    </div>

    <div class="items-list">
      <div v-for="(item, idx) in items" :key="item.id" class="item-block">
        <!-- Top-level item row -->
        <div class="item-row" :class="{ 'is-editing': editingPath === String(idx) }">
          <div class="item-info">
            <span class="item-index">{{ idx + 1 }}.</span>
            <strong class="item-label">{{ item.label || '(kein Label)' }}</strong>
            <span class="item-meta">
              <template v-if="item.link_type === 'external'">
                <span class="badge external">extern</span> {{ item.external_url || '—' }}
              </template>
              <template v-else-if="item.link_type === 'none'">
                <span class="badge none">kein Link</span>
              </template>
              <template v-else>
                <span class="badge page">seite</span> /{{ item.page_slug || '—' }}
              </template>
            </span>
            <span v-if="item.children?.length" class="children-badge">
              {{ item.children.length }} Unterpunkte
            </span>
          </div>
          <div class="item-actions">
            <button class="action-btn" @click="moveUp(idx)" :disabled="idx === 0 || disabled" title="Nach oben">↑</button>
            <button class="action-btn" @click="moveDown(idx)" :disabled="idx === items.length - 1 || disabled" title="Nach unten">↓</button>
            <button class="action-btn edit" @click="toggleEdit(String(idx), item)" :disabled="disabled" title="Bearbeiten">
              {{ editingPath === String(idx) ? '✕' : '✏' }}
            </button>
            <button class="action-btn delete" @click="removeItem(idx)" :disabled="disabled" title="Löschen">×</button>
          </div>
        </div>

        <!-- Inline edit form -->
        <div v-if="editingPath === String(idx)" class="edit-form">
          <div class="form-grid">
            <div class="form-field">
              <label>Label *</label>
              <input v-model="editBuffer.label" type="text" placeholder="Kommunen" />
            </div>
            <div class="form-field">
              <label>Link-Typ *</label>
              <select v-model="editBuffer.link_type">
                <option value="page">Interne Seite</option>
                <option value="external">Externe URL</option>
                <option value="none">Kein Link (nur Text)</option>
              </select>
            </div>
            <template v-if="editBuffer.link_type === 'page'">
              <div class="form-field full">
                <label>Seiten-Slug *</label>
                <div class="slug-input-wrapper">
                  <input
                    v-model="editBuffer.page_slug"
                    type="text"
                    placeholder="municipalities"
                    @input="onSlugInput"
                  />
                  <div v-if="pageResults.length" class="slug-suggestions">
                    <div
                      v-for="page in pageResults"
                      :key="page.slug"
                      class="slug-suggestion"
                      @click="selectPage(page)"
                    >
                      <strong>{{ page.name }}</strong>
                      <span>/{{ page.slug }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="editBuffer.link_type === 'external'">
              <div class="form-field full">
                <label>Externe URL *</label>
                <input v-model="editBuffer.external_url" type="url" placeholder="https://example.com" />
              </div>
              <div class="form-field checkbox-field">
                <label>
                  <input v-model="editBuffer.open_new_tab" type="checkbox" />
                  In neuem Tab öffnen
                </label>
              </div>
            </template>
            <div class="form-field">
              <label>Bild-ID <span class="hint">(Directus Datei-UUID, optional)</span></label>
              <input v-model="editBuffer.image_id" type="text" placeholder="uuid der Bilddatei" />
            </div>
            <div class="form-field">
              <label>Beschreibung <span class="hint">(optional, für Mega-Menü)</span></label>
              <input v-model="editBuffer.description" type="text" placeholder="Kurze Beschreibung..." />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-save" @click="saveEdit(String(idx))">Speichern</button>
            <button class="btn-cancel" @click="cancelEdit">Abbrechen</button>
          </div>
        </div>

        <!-- Children list -->
        <div v-if="item.children?.length" class="children-list">
          <div v-for="(child, childIdx) in item.children" :key="child.id" class="item-block child-block">
            <div class="item-row child-row" :class="{ 'is-editing': editingPath === `${idx}.${childIdx}` }">
              <div class="item-info">
                <span class="connector">└─</span>
                <strong class="item-label">{{ child.label || '(kein Label)' }}</strong>
                <span class="item-meta">
                  <template v-if="child.link_type === 'external'">
                    <span class="badge external">extern</span> {{ child.external_url || '—' }}
                  </template>
                  <template v-else>
                    <span class="badge page">seite</span> /{{ child.page_slug || '—' }}
                  </template>
                </span>
              </div>
              <div class="item-actions">
                <button class="action-btn" @click="moveChildUp(idx, childIdx)" :disabled="childIdx === 0 || disabled">↑</button>
                <button class="action-btn" @click="moveChildDown(idx, childIdx)" :disabled="childIdx === item.children.length - 1 || disabled">↓</button>
                <button class="action-btn edit" @click="toggleEdit(`${idx}.${childIdx}`, child)" :disabled="disabled">
                  {{ editingPath === `${idx}.${childIdx}` ? '✕' : '✏' }}
                </button>
                <button class="action-btn delete" @click="removeChild(idx, childIdx)" :disabled="disabled">×</button>
              </div>
            </div>
            <div v-if="editingPath === `${idx}.${childIdx}`" class="edit-form child-edit-form">
              <div class="form-grid">
                <div class="form-field">
                  <label>Label *</label>
                  <input v-model="editBuffer.label" type="text" placeholder="Karte" />
                </div>
                <div class="form-field">
                  <label>Link-Typ *</label>
                  <select v-model="editBuffer.link_type">
                    <option value="page">Interne Seite</option>
                    <option value="external">Externe URL</option>
                  </select>
                </div>
                <template v-if="editBuffer.link_type === 'page'">
                  <div class="form-field full">
                    <label>Seiten-Slug *</label>
                    <div class="slug-input-wrapper">
                      <input
                        v-model="editBuffer.page_slug"
                        type="text"
                        placeholder="map"
                        @input="onSlugInput"
                      />
                      <div v-if="pageResults.length" class="slug-suggestions">
                        <div v-for="page in pageResults" :key="page.slug" class="slug-suggestion" @click="selectPage(page)">
                          <strong>{{ page.name }}</strong>
                          <span>/{{ page.slug }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="form-field full">
                    <label>Externe URL *</label>
                    <input v-model="editBuffer.external_url" type="url" placeholder="https://example.com" />
                  </div>
                  <div class="form-field checkbox-field">
                    <label>
                      <input v-model="editBuffer.open_new_tab" type="checkbox" />
                      In neuem Tab öffnen
                    </label>
                  </div>
                </template>
                <div class="form-field">
                  <label>Bild-ID <span class="hint">(optional)</span></label>
                  <input v-model="editBuffer.image_id" type="text" placeholder="uuid der Bilddatei" />
                </div>
                <div class="form-field">
                  <label>Beschreibung <span class="hint">(optional)</span></label>
                  <input v-model="editBuffer.description" type="text" placeholder="Kurze Beschreibung..." />
                </div>
              </div>
              <div class="form-actions">
                <button class="btn-save" @click="saveEdit(`${idx}.${childIdx}`)">Speichern</button>
                <button class="btn-cancel" @click="cancelEdit">Abbrechen</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Add child -->
        <div v-if="!disabled" class="add-child-row">
          <button class="add-child-btn" @click="addChild(idx)">+ Unterpunkt hinzufügen</button>
        </div>
      </div>
    </div>

    <div v-if="!disabled" class="add-item-row">
      <button class="add-btn" @click="addItem">+ Navigationspunkt hinzufügen</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, inject } from 'vue';

const props = defineProps({
  value: {
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  field: String,
  collection: String,
});

const emit = defineEmits(['input']);

const api = inject('api');

function parseValue(val) {
  if (!val) return [];
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return Array.isArray(val) ? JSON.parse(JSON.stringify(val)) : [];
}

const items = ref(parseValue(props.value));
const editingPath = ref(null);
const editBuffer = ref(null);
const pageResults = ref([]);

watch(() => props.value, (newVal) => {
  if (!editingPath.value) {
    items.value = parseValue(newVal);
  }
});

function genId() {
  return 'nav-' + Math.random().toString(36).substr(2, 9);
}

function newItem() {
  return {
    id: genId(),
    label: '',
    link_type: 'page',
    page_slug: '',
    external_url: '',
    open_new_tab: false,
    image_id: null,
    description: '',
    children: [],
  };
}

function emitValue() {
  emit('input', JSON.parse(JSON.stringify(items.value)));
}

function addItem() {
  const item = newItem();
  items.value.push(item);
  editingPath.value = String(items.value.length - 1);
  editBuffer.value = { ...item };
}

function removeItem(idx) {
  items.value.splice(idx, 1);
  editingPath.value = null;
  editBuffer.value = null;
  emitValue();
}

function moveUp(idx) {
  if (idx > 0) {
    const arr = items.value;
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    items.value = [...arr];
    emitValue();
  }
}

function moveDown(idx) {
  if (idx < items.value.length - 1) {
    const arr = items.value;
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    items.value = [...arr];
    emitValue();
  }
}

function addChild(parentIdx) {
  if (!items.value[parentIdx].children) {
    items.value[parentIdx].children = [];
  }
  const child = newItem();
  items.value[parentIdx].children.push(child);
  const childIdx = items.value[parentIdx].children.length - 1;
  editingPath.value = `${parentIdx}.${childIdx}`;
  editBuffer.value = { ...child };
}

function removeChild(parentIdx, childIdx) {
  items.value[parentIdx].children.splice(childIdx, 1);
  editingPath.value = null;
  editBuffer.value = null;
  emitValue();
}

function moveChildUp(parentIdx, childIdx) {
  const children = items.value[parentIdx].children;
  if (childIdx > 0) {
    [children[childIdx - 1], children[childIdx]] = [children[childIdx], children[childIdx - 1]];
    items.value[parentIdx].children = [...children];
    emitValue();
  }
}

function moveChildDown(parentIdx, childIdx) {
  const children = items.value[parentIdx].children;
  if (childIdx < children.length - 1) {
    [children[childIdx], children[childIdx + 1]] = [children[childIdx + 1], children[childIdx]];
    items.value[parentIdx].children = [...children];
    emitValue();
  }
}

function toggleEdit(path, item) {
  if (editingPath.value === path) {
    cancelEdit();
  } else {
    editingPath.value = path;
    editBuffer.value = JSON.parse(JSON.stringify(item));
    pageResults.value = [];
  }
}

function cancelEdit() {
  editingPath.value = null;
  editBuffer.value = null;
  pageResults.value = [];
}

function saveEdit(path) {
  const parts = path.split('.');
  if (parts.length === 1) {
    const idx = parseInt(parts[0]);
    Object.assign(items.value[idx], editBuffer.value);
  } else {
    const [parentIdx, childIdx] = parts.map(Number);
    Object.assign(items.value[parentIdx].children[childIdx], editBuffer.value);
  }
  editingPath.value = null;
  editBuffer.value = null;
  pageResults.value = [];
  emitValue();
}

let slugSearchTimer = null;
function onSlugInput() {
  clearTimeout(slugSearchTimer);
  const query = editBuffer.value?.page_slug;
  if (!query || query.length < 2) {
    pageResults.value = [];
    return;
  }
  slugSearchTimer = setTimeout(async () => {
    try {
      const resp = await api.get('/items/pages', {
        params: {
          fields: 'name,slug',
          filter: JSON.stringify({
            _and: [
              { status: { _eq: 'published' } },
              { _or: [
                { name: { _icontains: query } },
                { slug: { _icontains: query } },
              ]},
            ]
          }),
          limit: 6,
        },
      });
      pageResults.value = resp.data?.data || [];
    } catch {
      pageResults.value = [];
    }
  }, 300);
}

function selectPage(page) {
  editBuffer.value.page_slug = page.slug;
  editBuffer.value.label = editBuffer.value.label || page.name;
  pageResults.value = [];
}
</script>

<style scoped>
.navigation-editor {
  font-family: var(--theme--fonts--sans--font-family, sans-serif);
  font-size: 13px;
}

.empty-state {
  padding: 16px;
  color: var(--theme--foreground-subdued, #999);
  font-style: italic;
  text-align: center;
  border: 1px dashed var(--theme--border-color, #ddd);
  border-radius: var(--theme--border-radius, 4px);
  margin-bottom: 12px;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.item-block {
  border: 1px solid var(--theme--border-color, #e0e0e0);
  border-radius: var(--theme--border-radius, 4px);
  overflow: hidden;
  background: var(--theme--background, #fff);
}

.child-block {
  margin-left: 24px;
  border-color: var(--theme--border-color-subdued, #eee);
  background: var(--theme--background-subdued, #fafafa);
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--theme--background, #fff);
  gap: 8px;
}

.child-row {
  background: var(--theme--background-subdued, #fafafa);
}

.item-row.is-editing {
  background: var(--theme--primary-background, #e8f4fd);
  border-bottom: 1px solid var(--theme--border-color, #e0e0e0);
}

.item-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.item-index {
  color: var(--theme--foreground-subdued, #999);
  min-width: 20px;
}

.connector {
  color: var(--theme--foreground-subdued, #999);
}

.item-label {
  font-weight: 600;
  color: var(--theme--foreground, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.item-meta {
  color: var(--theme--foreground-subdued, #777);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge.page {
  background: var(--theme--primary-background, #dbeafe);
  color: var(--theme--primary, #2563eb);
}

.badge.external {
  background: #fef3c7;
  color: #92400e;
}

.badge.none {
  background: #f3f4f6;
  color: #6b7280;
}

.children-badge {
  font-size: 11px;
  color: var(--theme--foreground-subdued, #999);
  white-space: nowrap;
}

.item-actions {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.action-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--theme--border-color, #ddd);
  background: var(--theme--background, #fff);
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  color: var(--theme--foreground, #333);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover:not(:disabled) {
  background: var(--theme--background-subdued, #f5f5f5);
  border-color: var(--theme--border-color-accent, #bbb);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-btn.delete:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

.action-btn.edit:hover:not(:disabled) {
  background: var(--theme--primary-background, #dbeafe);
  border-color: var(--theme--primary, #2563eb);
  color: var(--theme--primary, #2563eb);
}

.edit-form {
  padding: 12px;
  background: var(--theme--background-subdued, #fafafa);
  border-top: 1px solid var(--theme--border-color, #e0e0e0);
}

.child-edit-form {
  background: var(--theme--background, #fff);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field.full {
  grid-column: 1 / -1;
}

.form-field.checkbox-field {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
}

.form-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--theme--foreground-subdued, #666);
}

.form-field .hint {
  font-weight: 400;
  font-style: italic;
}

.form-field input[type="text"],
.form-field input[type="url"],
.form-field select {
  padding: 6px 8px;
  border: 1px solid var(--theme--border-color, #ddd);
  border-radius: var(--theme--border-radius, 4px);
  background: var(--theme--background, #fff);
  font-size: 13px;
  color: var(--theme--foreground, #333);
  width: 100%;
  box-sizing: border-box;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: var(--theme--primary, #2563eb);
  box-shadow: 0 0 0 2px var(--theme--primary-background, #dbeafe);
}

.form-field input[type="checkbox"] {
  margin-right: 6px;
}

.slug-input-wrapper {
  position: relative;
}

.slug-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--theme--background, #fff);
  border: 1px solid var(--theme--border-color, #ddd);
  border-top: none;
  border-radius: 0 0 4px 4px;
  z-index: 100;
  max-height: 160px;
  overflow-y: auto;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.slug-suggestion {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  gap: 8px;
}

.slug-suggestion:hover {
  background: var(--theme--primary-background, #dbeafe);
}

.slug-suggestion strong {
  color: var(--theme--foreground, #333);
}

.slug-suggestion span {
  color: var(--theme--foreground-subdued, #777);
  font-family: monospace;
}

.form-actions {
  display: flex;
  gap: 8px;
}

.btn-save {
  padding: 6px 16px;
  background: var(--theme--primary, #2563eb);
  color: #fff;
  border: none;
  border-radius: var(--theme--border-radius, 4px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:hover {
  background: var(--theme--primary-accent, #1d4ed8);
}

.btn-cancel {
  padding: 6px 16px;
  background: transparent;
  color: var(--theme--foreground-subdued, #666);
  border: 1px solid var(--theme--border-color, #ddd);
  border-radius: var(--theme--border-radius, 4px);
  font-size: 13px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: var(--theme--background-subdued, #f5f5f5);
}

.children-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 8px 4px 8px;
  background: var(--theme--background-subdued, #fafafa);
}

.add-child-row {
  padding: 4px 10px 6px;
  background: var(--theme--background-subdued, #fafafa);
  border-top: 1px dashed var(--theme--border-color, #e0e0e0);
}

.add-child-btn {
  font-size: 12px;
  color: var(--theme--primary, #2563eb);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
}

.add-child-btn:hover {
  text-decoration: underline;
}

.add-item-row {
  margin-top: 4px;
}

.add-btn {
  width: 100%;
  padding: 8px;
  background: none;
  border: 1px dashed var(--theme--border-color, #ddd);
  border-radius: var(--theme--border-radius, 4px);
  color: var(--theme--primary, #2563eb);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}

.add-btn:hover {
  background: var(--theme--primary-background, #dbeafe);
  border-color: var(--theme--primary, #2563eb);
}
</style>
