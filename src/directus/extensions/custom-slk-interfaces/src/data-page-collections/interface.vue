<template>
  <div class="data-page-collections">
    <p class="hint">
      {{
        includeOnly
          ? "Nur die ausgewählten Datenprodukte werden angezeigt."
          : "Die ausgewählten Datenprodukte werden ausgeblendet."
      }}
    </p>

    <div class="toolbar">
      <input
        v-model="search"
        type="search"
        placeholder="Datenprodukte suchen"
        aria-label="Datenprodukte suchen"
      />
      <button type="button" :disabled="loading" @click="loadCatalog">
        Aktualisieren
      </button>
    </div>

    <p v-if="loading" class="hint">Datenprodukte werden geladen …</p>
    <p v-else-if="loadError" class="error">
      Die Datenprodukte konnten nicht geladen werden. Gespeicherte IDs bleiben
      erhalten.
    </p>
    <p v-if="warning" class="error">{{ warning }}</p>
    <p v-if="includeOnly && !selectedIds.length" class="error">
      Wähle mindestens ein Datenprodukt aus.
    </p>

    <div v-if="filteredCollections.length" class="collection-list">
      <label
        v-for="collection in filteredCollections"
        :key="collection.id"
        class="collection-row"
      >
        <input
          type="checkbox"
          :checked="selectedIds.includes(collection.id)"
          :disabled="disabled"
          @change="toggleCollection(collection.id, $event)"
        />
        <span
          >{{ collection.title }} <small>({{ collection.id }})</small></span
        >
      </label>
    </div>
    <p v-else-if="!loading && !loadError" class="hint">
      Keine passenden Datenprodukte gefunden.
    </p>

    <div v-if="missingIds.length" class="missing">
      <p class="hint">Gespeicherte IDs, die derzeit nicht im Katalog stehen:</p>
      <div v-for="id in missingIds" :key="id" class="missing-row">
        <code>{{ id }}</code>
        <button
          type="button"
          :disabled="disabled"
          @click="toggleCollection(id)"
        >
          Entfernen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, unref, watch, type Ref } from "vue";

type CatalogEntry = { id: string; title: string };
type Api = {
  get: (path: string) => Promise<{ data: { collections: CatalogEntry[] } }>;
};

const props = defineProps<{
  value?: string[] | string | null;
  disabled?: boolean;
}>();
const emit = defineEmits<{ (event: "input", value: string[]): void }>();
const api = inject<Api>("api");
const values = inject<Ref<Record<string, unknown>> | Record<string, unknown>>(
  "values",
);

const collections = ref<CatalogEntry[]>([]);
const loading = ref(false);
const loadError = ref(false);
const warning = ref("");
const search = ref("");

const includeOnly = computed(() => unref(values)?.include_only === true);
const selectedIds = computed(() => {
  let value = props.value;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as string[];
    } catch {
      return [];
    }
  }
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
});
const knownIds = computed(
  () => new Set(collections.value.map((entry) => entry.id)),
);
const missingIds = computed(() =>
  selectedIds.value.filter((id) => !knownIds.value.has(id)),
);
const filteredCollections = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return collections.value.filter(
    (entry) =>
      !query ||
      `${entry.title} ${entry.id}`.toLocaleLowerCase().includes(query),
  );
});

async function loadCatalog() {
  if (!api) {
    loadError.value = true;
    return;
  }
  loading.value = true;
  loadError.value = false;
  try {
    const response = await api.get("/data-page-catalog");
    collections.value = response.data.collections;
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function toggleCollection(id: string, event?: Event) {
  if (props.disabled) return;
  const next = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selected) => selected !== id)
    : [...selectedIds.value, id];
  if (includeOnly.value && next.length === 0) {
    warning.value = "Wähle mindestens ein Datenprodukt aus.";
    if (event?.target instanceof HTMLInputElement) event.target.checked = true;
    return;
  }
  if (
    !includeOnly.value &&
    collections.value.length &&
    collections.value.every((entry) => next.includes(entry.id))
  ) {
    warning.value = "Mindestens ein Datenprodukt muss sichtbar bleiben.";
    if (event?.target instanceof HTMLInputElement) event.target.checked = false;
    return;
  }
  warning.value = "";
  emit("input", next);
}

watch(includeOnly, (enabled) => {
  if (
    !enabled &&
    collections.value.length &&
    collections.value.every((entry) => selectedIds.value.includes(entry.id))
  ) {
    emit(
      "input",
      selectedIds.value.filter((id) => id !== collections.value.at(-1)?.id),
    );
    warning.value = "Ein Datenprodukt bleibt sichtbar.";
  }
});

loadCatalog();
</script>

<style scoped>
.data-page-collections {
  color: var(--theme--foreground);
  font-family: var(--theme--fonts--sans--font-family);
}
.hint {
  color: var(--theme--foreground-subdued);
  margin-bottom: 12px;
}
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.toolbar input {
  flex: 1;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  background: var(--theme--background);
  color: var(--theme--foreground);
}
button {
  padding: 7px 10px;
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.5;
}
.collection-list {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
}
.collection-row,
.missing-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border-bottom: 1px solid var(--theme--border-color);
}
.collection-row:last-child,
.missing-row:last-child {
  border-bottom: 0;
}
.collection-row small {
  color: var(--theme--foreground-subdued);
}
.error {
  color: var(--theme--danger);
  margin: 8px 0;
}
.missing {
  margin-top: 15px;
  padding: 10px;
  background: var(--theme--background-subdued);
  border-radius: var(--theme--border-radius);
}
.missing-row {
  justify-content: space-between;
}
</style>
