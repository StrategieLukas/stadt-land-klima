<template>
  <div class="municipality-scores-publisher">
    <div v-if="!primaryKey || primaryKey === '+'" class="notice">
      Speichern Sie die Kommune, bevor die Katalogbewertungen angezeigt werden.
    </div>

    <div v-else-if="loading" class="state">
      <v-progress-circular indeterminate />
      <span>Katalogbewertungen werden geladen.</span>
    </div>

    <div v-else-if="error" class="notice danger">
      {{ error }}
      <button type="button" class="text-button" @click="loadScores">Erneut laden</button>
    </div>

    <div v-else-if="scores.length === 0" class="notice">
      Für diese Kommune wurden noch keine Katalogbewertungen erzeugt.
    </div>

    <div v-else class="scores-table" role="table" aria-label="Katalogbewertungen">
      <div class="scores-row scores-header" role="row">
        <div role="columnheader">Katalogversion</div>
        <div role="columnheader">Score</div>
        <div role="columnheader">Bewertet</div>
        <div role="columnheader">Veröffentlicht</div>
      </div>

      <div v-for="row in sortedScores" :key="row.id" class="scores-row" role="row">
        <div class="version-cell" role="cell">
          <strong>{{ catalogLabel(row) }}</strong>
          <span v-if="row.catalog_version?.isCurrentFrontend" class="badge">Frontend</span>
          <span v-if="row.catalog_version?.isCurrentBackend" class="badge">Backend</span>
        </div>
        <div role="cell">{{ formatNumber(row.score_total) }}</div>
        <div role="cell">{{ formatNumber(row.percentage_rated) }}%</div>
        <label class="publish-cell" role="cell">
          <input
            type="checkbox"
            :checked="row.published === true"
            :disabled="disabled || row.saving"
            @change="onPublishInput(row, $event)"
          />
          <span>{{ row.published ? 'Ja' : 'Nein' }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch, type Ref } from 'vue';

type Api = {
  get: (path: string) => Promise<{ data?: { data?: ScoreRow[] } }>;
  patch: (path: string, data: Record<string, unknown>) => Promise<{ data?: { data?: ScoreRow } }>;
};

type CatalogVersion = {
  id: string;
  name?: string | null;
  isCurrentFrontend?: boolean | null;
  isCurrentBackend?: boolean | null;
  date_created?: string | null;
};

type ScoreRow = {
  id: string | number;
  catalog_version: CatalogVersion | string | null;
  score_total: string | number | null;
  percentage_rated: string | number | null;
  published: boolean | null;
  saving?: boolean;
};

const props = defineProps<{
  disabled?: boolean;
  primaryKey?: string | number | null;
}>();

const api = inject<Api>('api');
const loading = ref(false);
const error: Ref<string | null> = ref(null);
const scores: Ref<ScoreRow[]> = ref([]);

const sortedScores = computed(() => {
  return [...scores.value].sort((a, b) => {
    const catalogA = normalizeCatalog(a.catalog_version);
    const catalogB = normalizeCatalog(b.catalog_version);
    const priorityA = catalogPriority(catalogA);
    const priorityB = catalogPriority(catalogB);
    if (priorityA !== priorityB) return priorityA - priorityB;
    return catalogLabel(a).localeCompare(catalogLabel(b), 'de');
  });
});

watch(() => props.primaryKey, () => loadScores(), { immediate: true });

async function loadScores(): Promise<void> {
  if (!api || !props.primaryKey || props.primaryKey === '+') {
    scores.value = [];
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const filter = encodeURIComponent(JSON.stringify({ municipality: { _eq: props.primaryKey } }));
    const fields = [
      'id',
      'published',
      'score_total',
      'percentage_rated',
      'catalog_version.id',
      'catalog_version.name',
      'catalog_version.isCurrentFrontend',
      'catalog_version.isCurrentBackend',
      'catalog_version.date_created',
    ].join(',');
    const response = await api.get(`/items/municipality_scores?filter=${filter}&fields=${fields}&limit=-1`);
    scores.value = response.data?.data ?? [];
  } catch (err) {
    console.error('[MunicipalityScoresPublisher] Failed to load scores:', err);
    error.value = 'Katalogbewertungen konnten nicht geladen werden.';
    scores.value = [];
  } finally {
    loading.value = false;
  }
}

async function onPublishInput(row: ScoreRow, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  await setPublished(row, input.checked);
}

async function setPublished(row: ScoreRow, published: boolean): Promise<void> {
  if (!api || props.disabled || row.saving) return;

  const previous = row.published === true;
  row.published = published;
  row.saving = true;
  error.value = null;

  try {
    await api.patch(`/items/municipality_scores/${row.id}`, { published });
  } catch (err) {
    console.error('[MunicipalityScoresPublisher] Failed to update publish flag:', err);
    row.published = previous;
    error.value = 'Veröffentlichung konnte nicht gespeichert werden.';
  } finally {
    row.saving = false;
  }
}

function normalizeCatalog(catalog: ScoreRow['catalog_version']): CatalogVersion | null {
  return typeof catalog === 'object' && catalog !== null ? catalog : null;
}

function catalogPriority(catalog: CatalogVersion | null): number {
  if (catalog?.isCurrentFrontend) return 0;
  if (catalog?.isCurrentBackend) return 1;
  return 2;
}

function catalogLabel(row: ScoreRow): string {
  const catalog = normalizeCatalog(row.catalog_version);
  return catalog?.name || String(row.catalog_version || row.id);
}

function formatNumber(value: string | number | null): string {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(number) ? number.toFixed(1) : '0.0';
}
</script>

<style scoped>
.municipality-scores-publisher {
  color: var(--theme--foreground);
  font-family: var(--theme--fonts--sans--font-family);
}

.state,
.notice {
  align-items: center;
  background: var(--theme--background-subdued);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  color: var(--theme--foreground-subdued);
  display: flex;
  gap: 12px;
  padding: 12px;
}

.notice.danger {
  color: var(--danger);
}

.text-button {
  color: var(--theme--primary);
  cursor: pointer;
  font: inherit;
}

.scores-table {
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  overflow: hidden;
}

.scores-row {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(180px, 1fr) minmax(80px, 120px) minmax(90px, 120px) minmax(120px, 160px);
  padding: 12px;
}

.scores-row + .scores-row {
  border-top: 1px solid var(--theme--border-color);
}

.scores-header {
  background: var(--theme--background-subdued);
  color: var(--theme--foreground-subdued);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.version-cell,
.publish-cell {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.publish-cell {
  color: var(--theme--foreground);
}

.publish-cell input {
  accent-color: var(--theme--primary);
}

.badge {
  background: var(--theme--primary-background);
  border-radius: 999px;
  color: var(--theme--primary);
  font-size: 12px;
  line-height: 1;
  padding: 4px 8px;
}

@media (max-width: 720px) {
  .scores-row {
    grid-template-columns: 1fr;
  }

  .scores-header {
    display: none;
  }
}
</style>
