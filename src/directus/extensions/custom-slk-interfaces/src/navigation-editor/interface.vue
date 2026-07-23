<template>
  <div class="navigation-editor">
    <div v-if="!items.length && !isAddingNew" class="empty-state">
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

        <!-- Inline edit form (top-level) -->
        <NavItemForm
          v-if="editingPath === String(idx)"
          :buffer="editBuffer!"
          :page-results="pageResults"
          :allow-none-link="true"
          @slug-input="onSlugInput"
          @select-page="(p) => handleSelectPage(p)"
          @save="saveEdit(String(idx))"
          @cancel="cancelEdit"
        />

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

            <NavItemForm
              v-if="editingPath === `${idx}.${childIdx}`"
              :buffer="editBuffer!"
              :page-results="pageResults"
              :allow-none-link="false"
              @slug-input="onSlugInput"
              @select-page="(p) => handleSelectPage(p)"
              @save="saveEdit(`${idx}.${childIdx}`)"
              @cancel="cancelEdit"
            />
          </div>
        </div>

        <!-- Add child -->
        <div v-if="!disabled" class="add-child-row">
          <button class="add-child-btn" @click="addChild(idx)">+ Unterpunkt hinzufügen</button>
        </div>
        <NavItemForm
          v-if="editingPath === `${idx}.${item.children?.length ?? 0}__new`"
          :buffer="editBuffer!"
          :page-results="pageResults"
          :allow-none-link="false"
          @slug-input="onSlugInput"
          @select-page="(p) => handleSelectPage(p)"
          @save="editingPath && saveEdit(editingPath)"
          @cancel="cancelEdit"
        />
      </div>

      <!-- New-item form (shown below existing items, before the add button) -->
      <div v-if="isAddingNew" class="item-block new-item-block">
        <div class="item-row is-editing">
          <div class="item-info">
            <span class="item-index">{{ items.length + 1 }}.</span>
            <em class="item-label" style="opacity:.5">Neuer Eintrag…</em>
          </div>
          <div class="item-actions">
            <button class="action-btn delete" @click="cancelEdit" title="Abbrechen">×</button>
          </div>
        </div>
        <NavItemForm
          :buffer="editBuffer!"
          :page-results="pageResults"
          :allow-none-link="true"
          @slug-input="onSlugInput"
          @select-page="(p) => handleSelectPage(p)"
          @save="commitNewItem"
          @cancel="cancelEdit"
        />
      </div>
    </div>

    <div v-if="!disabled" class="add-item-row">
      <button class="add-btn" @click="startAddItem">+ Navigationspunkt hinzufügen</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, inject, type Ref } from 'vue';
import type { Page } from '../types';
import { usePageSearch } from '../usePageSearch';
import NavItemForm from './NavItemForm.vue';

interface NavItem {
  id: string;
  label: string;
  link_type: 'page' | 'external' | 'none';
  page_slug: string | null;
  external_url: string | null;
  open_new_tab: boolean;
  image_id: string | null;
  description: string;
  children: NavItem[];
}

interface EditBuffer {
  label: string;
  link_type: 'page' | 'external' | 'none';
  page_slug: string;
  external_url: string;
  open_new_tab: boolean;
  image_id: string | null;
  description: string;
}

const props = defineProps<{
  value?: string | NavItem[] | null;
  disabled?: boolean;
  field?: string;
  collection?: string;
}>();

const emit = defineEmits<{
  (e: 'input', value: NavItem[]): void;
}>();

const api = inject<{
  get: (path: string, config?: Record<string, unknown>) => Promise<{ data?: { data?: unknown } }>;
}>('api');

// ─── Parse value ──────────────────────────────────────────────────────────────

function parseValue(val: string | NavItem[] | null | undefined): NavItem[] {
  if (!val) return [];
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return Array.isArray(val) ? JSON.parse(JSON.stringify(val)) : [];
}

const items: Ref<NavItem[]> = ref(parseValue(props.value));
const editingPath: Ref<string | null> = ref(null);
const editBuffer: Ref<EditBuffer | null> = ref(null);
const isAddingNew: Ref<boolean> = ref(false);

const { pageResults, search, selectPage, clear: clearPageResults } = usePageSearch(api);

watch(() => props.value, (newVal) => {
  // Only sync from outside when we're not mid-edit, to avoid clobbering the user's work.
  // A more robust implementation would do a deep diff/merge here.
  if (!editingPath.value && !isAddingNew.value) {
    items.value = parseValue(newVal);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return 'nav-' + Math.random().toString(36).slice(2, 9);
}

function newEditBufferDefaults(): EditBuffer {
  return {
    label: '',
    link_type: 'page',
    page_slug: '',
    external_url: '',
    open_new_tab: false,
    image_id: null,
    description: '',
  };
}

function toStoredLinkFields(buffer: EditBuffer): Omit<NavItem, 'id' | 'children'> {
  return {
    label: buffer.label,
    link_type: buffer.link_type,
    page_slug: buffer.link_type === 'page' ? buffer.page_slug : null,
    external_url: buffer.link_type === 'external' ? buffer.external_url : null,
    open_new_tab: buffer.open_new_tab,
    image_id: buffer.image_id,
    description: buffer.description,
  };
}

function emitValue(): void {
  emit('input', JSON.parse(JSON.stringify(items.value)));
}

// ─── Slug search ──────────────────────────────────────────────────────────────

function onSlugInput(): void {
  search(editBuffer.value?.page_slug?.trim() ?? '');
}

function handleSelectPage(page: Page): void {
  if (editBuffer.value) selectPage(page, editBuffer.value);
}

// ─── Add / remove top-level items (defer push until save) ─────────────────────

function startAddItem(): void {
  if (isAddingNew.value) return;
  editingPath.value = null;
  editBuffer.value = newEditBufferDefaults();
  isAddingNew.value = true;
  clearPageResults();
}

function commitNewItem(): void {
  if (!editBuffer.value) return;
  const newItem: NavItem = {
    id: genId(),
    ...toStoredLinkFields(editBuffer.value),
    children: [],
  };
  items.value.push(newItem);
  isAddingNew.value = false;
  editBuffer.value = null;
  clearPageResults();
  emitValue();
}

function removeItem(idx: number): void {
  items.value.splice(idx, 1);
  editingPath.value = null;
  editBuffer.value = null;
  emitValue();
}

function moveUp(idx: number): void {
  if (idx > 0) {
    const arr = items.value;
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    items.value = [...arr];
    emitValue();
  }
}

function moveDown(idx: number): void {
  if (idx < items.value.length - 1) {
    const arr = items.value;
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    items.value = [...arr];
    emitValue();
  }
}

// ─── Children ─────────────────────────────────────────────────────────────────

function addChild(parentIdx: number): void {
  if (!items.value[parentIdx].children) {
    items.value[parentIdx].children = [];
  }
  // For children we also defer: open form buffer but push only on save
  editBuffer.value = newEditBufferDefaults();
  // Use a sentinel path so the form opens below the last child
  const li = items.value[parentIdx].children.length;
  editingPath.value = `${parentIdx}.${li}__new`;
  clearPageResults();
}

function removeChild(parentIdx: number, childIdx: number): void {
  items.value[parentIdx].children.splice(childIdx, 1);
  editingPath.value = null;
  editBuffer.value = null;
  emitValue();
}

function moveChildUp(parentIdx: number, childIdx: number): void {
  const children = items.value[parentIdx].children;
  if (childIdx > 0) {
    [children[childIdx - 1], children[childIdx]] = [children[childIdx], children[childIdx - 1]];
    items.value[parentIdx].children = [...children];
    emitValue();
  }
}

function moveChildDown(parentIdx: number, childIdx: number): void {
  const children = items.value[parentIdx].children;
  if (childIdx < children.length - 1) {
    [children[childIdx], children[childIdx + 1]] = [children[childIdx + 1], children[childIdx]];
    items.value[parentIdx].children = [...children];
    emitValue();
  }
}

// ─── Edit existing items ──────────────────────────────────────────────────────

function toggleEdit(path: string, item: NavItem): void {
  if (editingPath.value === path) {
    cancelEdit();
  } else {
    isAddingNew.value = false;
    editingPath.value = path;
    editBuffer.value = JSON.parse(JSON.stringify({
      label: item.label,
      link_type: item.link_type,
      page_slug: item.page_slug || '',
      external_url: item.external_url || '',
      open_new_tab: item.open_new_tab,
      image_id: item.image_id,
      description: item.description,
    }));
    clearPageResults();
  }
}

function cancelEdit(): void {
  editingPath.value = null;
  editBuffer.value = null;
  isAddingNew.value = false;
  clearPageResults();
}

function saveEdit(path: string): void {
  if (!editBuffer.value) return;

  // Handle new-child sentinel paths like "2.3__new"
  if (path.endsWith('__new')) {
    const parentIdx = parseInt(path.split('.')[0]);
    const newChild: NavItem = { id: genId(), ...toStoredLinkFields(editBuffer.value), children: [] };
    items.value[parentIdx].children.push(newChild);
    editingPath.value = null;
    editBuffer.value = null;
    clearPageResults();
    emitValue();
    return;
  }

  const parts = path.split('.');
  if (parts.length === 1) {
    Object.assign(items.value[parseInt(parts[0])], toStoredLinkFields(editBuffer.value));
  } else {
    const [parentIdx, childIdx] = parts.map(Number);
    Object.assign(items.value[parentIdx].children[childIdx], toStoredLinkFields(editBuffer.value));
  }
  editingPath.value = null;
  editBuffer.value = null;
  clearPageResults();
  emitValue();
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

.new-item-block {
  border-color: var(--theme--primary, #2563eb);
  border-style: dashed;
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
  background: var(--theme--warning-background, #fef3c7);
  color: var(--theme--warning, #92400e);
}

.badge.none {
  background: var(--theme--background-subdued, #f3f4f6);
  color: var(--theme--foreground-subdued, #6b7280);
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
  background: var(--theme--danger-background, #fee2e2);
  border-color: var(--theme--danger-light, #fca5a5);
  color: var(--theme--danger, #dc2626);
}

.action-btn.edit:hover:not(:disabled) {
  background: var(--theme--primary-background, #dbeafe);
  border-color: var(--theme--primary, #2563eb);
  color: var(--theme--primary, #2563eb);
}

.children-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 8px;
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
