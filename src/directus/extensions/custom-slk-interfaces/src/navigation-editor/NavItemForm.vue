<template>
  <div class="edit-form">
    <div class="form-grid">
      <div class="form-field">
        <label>Label *</label>
        <input v-model="buffer.label" type="text" placeholder="Kommunen" />
      </div>
      <div class="form-field">
        <label>Link-Typ *</label>
        <select v-model="buffer.link_type">
          <option value="page">Interne Seite</option>
          <option value="external">Externe URL</option>
          <option v-if="allowNoneLink" value="none">Kein Link (nur Text)</option>
        </select>
      </div>

      <template v-if="buffer.link_type === 'page'">
        <div class="form-field full">
          <label>Seiten-Slug *</label>
          <div class="slug-input-wrapper">
            <input
              v-model="buffer.page_slug"
              type="text"
              placeholder="municipalities"
              @input="$emit('slug-input')"
            />
            <div v-if="pageResults.length" class="slug-suggestions">
              <div
                v-for="page in pageResults"
                :key="page.slug"
                class="slug-suggestion"
                @click="$emit('select-page', page)"
              >
                <strong>{{ page.name }}</strong>
                <span>/{{ page.slug }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="buffer.link_type === 'external'">
        <div class="form-field full">
          <label>Externe URL *</label>
          <input v-model="buffer.external_url" type="url" placeholder="https://example.com" />
        </div>
        <div class="form-field checkbox-field">
          <label>
            <input v-model="buffer.open_new_tab" type="checkbox" />
            In neuem Tab öffnen
          </label>
        </div>
      </template>

      <div class="form-field">
        <label>Bild-ID <span class="hint">(Directus Datei-UUID, optional)</span></label>
        <input v-model="buffer.image_id" type="text" placeholder="uuid der Bilddatei" />
      </div>
      <div class="form-field">
        <label>Beschreibung <span class="hint">(optional, für Mega-Menü)</span></label>
        <input v-model="buffer.description" type="text" placeholder="Kurze Beschreibung..." />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-save" @click="$emit('save')">Speichern</button>
      <button class="btn-cancel" @click="$emit('cancel')">Abbrechen</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Page } from '../types';

interface EditBuffer {
  label: string;
  link_type: 'page' | 'external' | 'none';
  page_slug: string;
  external_url: string;
  open_new_tab: boolean;
  image_id: string | null;
  description: string;
}

defineProps<{
  buffer: EditBuffer;
  pageResults: Page[];
  allowNoneLink?: boolean;
}>();

defineEmits<{
  (e: 'slug-input'): void;
  (e: 'select-page', page: Page): void;
  (e: 'save'): void;
  (e: 'cancel'): void;
}>();
</script>

<style scoped>
.edit-form {
  padding: 12px;
  background: var(--theme--background-subdued, #fafafa);
  border-top: 1px solid var(--theme--border-color, #e0e0e0);
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
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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
</style>
