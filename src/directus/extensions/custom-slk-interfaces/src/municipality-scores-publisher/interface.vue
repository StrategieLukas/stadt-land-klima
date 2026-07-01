<template>
  <div class="municipality-scores-publisher" @keydown.esc.window="closeUnverifiedDialog">
    <div v-if="!primaryKey || primaryKey === '+'" class="notice">
      {{ $t('directus.interfaces.municipality_scores_publisher.save_municipality_first') }}
    </div>

    <div v-else-if="loading" class="state">
      <v-progress-circular indeterminate />
      <span>{{ $t('directus.interfaces.municipality_scores_publisher.loading_scores') }}</span>
    </div>

    <div v-else-if="errorKey" class="notice danger">
      {{ $t(errorKey) }}
      <button type="button" class="text-button" @click="loadScores">{{ $t('generic.try_again') }}</button>
    </div>

    <div v-else-if="scores.length === 0" class="notice">
      {{ $t('directus.interfaces.municipality_scores_publisher.no_scores') }}
    </div>

    <div
      v-else
      class="scores-table"
      role="table"
      :aria-label="$t('directus.interfaces.municipality_scores_publisher.table_label')"
    >
      <div class="scores-row scores-header" role="row">
        <div role="columnheader">{{ $t('directus.interfaces.municipality_scores_publisher.column.catalog_version') }}</div>
        <div role="columnheader">{{ $t('directus.interfaces.municipality_scores_publisher.column.score') }}</div>
        <div role="columnheader">{{ $t('directus.interfaces.municipality_scores_publisher.column.rated') }}</div>
        <div role="columnheader">{{ $t('directus.interfaces.municipality_scores_publisher.column.published') }}</div>
      </div>

      <div v-for="row in sortedScores" :key="row.id" class="scores-row" role="row">
        <div class="version-cell" role="cell">
          <strong>{{ catalogLabel(row) }}</strong>
          <span :class="['badge', `badge--${catalogStatus(row)}`]">
            {{ $t(catalogStatusLabelKey(row)) }}
          </span>
        </div>
        <div role="cell">{{ formatScore(row) }}</div>
        <div role="cell">{{ formatNumber(row.percentage_rated) }}%</div>
        <label class="publish-cell" role="cell">
          <input
            type="checkbox"
            :checked="row.published === true"
            :disabled="disabled || row.saving || !canTogglePublished(row)"
            @input.stop
            @change.stop="onPublishInput(row, $event)"
          />
          <span>
            {{ row.published ? $t('directus.interfaces.municipality_scores_publisher.boolean.yes') : $t('directus.interfaces.municipality_scores_publisher.boolean.no') }}
          </span>
        </label>
      </div>
    </div>

    <div
      v-if="showUnverifiedDialog"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeUnverifiedDialog"
    >
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="municipality-scores-publisher-unverified-title"
        aria-describedby="municipality-scores-publisher-unverified-message"
      >
        <div class="modal-header">
          <v-icon name="lock" />
          <strong id="municipality-scores-publisher-unverified-title">
            {{ $t('directus.interfaces.municipality_scores_publisher.unverified.title') }}
          </strong>
        </div>
        <p id="municipality-scores-publisher-unverified-message">
          {{ $t('directus.interfaces.municipality_scores_publisher.unverified.message') }}
        </p>
        <div class="modal-actions">
          <button type="button" class="primary-button" @click="closeUnverifiedDialog">
            {{ $t('generic.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch, type Ref } from 'vue';

defineOptions({ inheritAttrs: false });

type ApiResponse<T> = Promise<{ data?: { data?: T } }>;

type Api = {
  get: <T = unknown>(path: string) => ApiResponse<T>;
  patch: <T = unknown>(path: string, data: Record<string, unknown>) => ApiResponse<T>;
};

type CatalogStatus = 'current' | 'future' | 'archive';

type CurrentUser = {
  id: string;
  verified?: boolean | null;
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
  score_points: string | number | null;
  score_max: string | number | null;
  percentage_rated: string | number | null;
  published: boolean | null;
  saving?: boolean;
};

const props = defineProps<{
  disabled?: boolean;
  primaryKey?: string | number | null;
}>();

defineEmits<{
  (event: 'input', value: ScoreRow[] | null): void;
}>();

const api = inject<Api>('api');
const loading = ref(false);
const errorKey: Ref<string | null> = ref(null);
const scores: Ref<ScoreRow[]> = ref([]);
const currentUserVerified: Ref<boolean | null> = ref(null);
const verificationLoading = ref(false);
const showUnverifiedDialog = ref(false);
let currentUserVerificationPromise: Promise<boolean> | null = null;
const MIN_PUBLISH_PERCENTAGE = 95;

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
onMounted(() => {
  void ensureCurrentUserIsVerified();
});

async function loadScores(): Promise<void> {
  if (!api || !props.primaryKey || props.primaryKey === '+') {
    scores.value = [];
    return;
  }

  loading.value = true;
  errorKey.value = null;
  try {
    const filter = encodeURIComponent(JSON.stringify({ municipality: { _eq: props.primaryKey } }));
    const fields = [
      'id',
      'published',
      'score_total',
      'score_points',
      'score_max',
      'percentage_rated',
      'catalog_version.id',
      'catalog_version.name',
      'catalog_version.isCurrentFrontend',
      'catalog_version.isCurrentBackend',
      'catalog_version.date_created',
    ].join(',');
    const response = await api.get<ScoreRow[]>(`/items/municipality_scores?filter=${filter}&fields=${fields}&limit=-1`);
    scores.value = response.data?.data ?? [];
  } catch (err) {
    console.error('[MunicipalityScoresPublisher] Failed to load scores:', err);
    errorKey.value = 'directus.interfaces.municipality_scores_publisher.error_loading';
    scores.value = [];
  } finally {
    loading.value = false;
  }
}

async function onPublishInput(row: ScoreRow, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const previous = row.published === true;

  if (!canSetPublished(row, input.checked)) {
    input.checked = previous;
    return;
  }

  if (!(await ensureCurrentUserIsVerified())) {
    input.checked = previous;
    showUnverifiedDialog.value = true;
    return;
  }

  await setPublished(row, input.checked);
}

async function setPublished(row: ScoreRow, published: boolean): Promise<void> {
  if (!api || props.disabled || row.saving || !canSetPublished(row, published)) return;

  const previous = row.published === true;
  row.published = published;
  row.saving = true;
  errorKey.value = null;

  try {
    await api.patch(`/items/municipality_scores/${row.id}`, { published });
  } catch (err) {
    console.error('[MunicipalityScoresPublisher] Failed to update publication state:', err);
    row.published = previous;
    errorKey.value = 'directus.interfaces.municipality_scores_publisher.error_saving';
  } finally {
    row.saving = false;
  }
}

async function ensureCurrentUserIsVerified(): Promise<boolean> {
  if (currentUserVerified.value !== null) {
    return currentUserVerified.value === true;
  }

  if (!api) {
    return false;
  }

  if (currentUserVerificationPromise) {
    return currentUserVerificationPromise;
  }

  currentUserVerificationPromise = loadCurrentUserVerification().finally(() => {
    currentUserVerificationPromise = null;
  });

  return currentUserVerificationPromise;
}

async function loadCurrentUserVerification(): Promise<boolean> {
  if (!api) {
    return false;
  }

  verificationLoading.value = true;

  try {
    const response = await api.get<CurrentUser>('/users/me?fields=id,verified');
    currentUserVerified.value = response.data?.data?.verified === true;
  } catch (err) {
    console.error('[MunicipalityScoresPublisher] Failed to load current user verification state:', err);
    currentUserVerified.value = false;
  } finally {
    verificationLoading.value = false;
  }

  return currentUserVerified.value === true;
}

function closeUnverifiedDialog(): void {
  showUnverifiedDialog.value = false;
}

function normalizeCatalog(catalog: ScoreRow['catalog_version']): CatalogVersion | null {
  return typeof catalog === 'object' && catalog !== null ? catalog : null;
}

function catalogPriority(catalog: CatalogVersion | null): number {
  if (catalog?.isCurrentFrontend) return 0;
  if (catalog?.isCurrentBackend) return 1;
  return 2;
}

function catalogStatus(row: ScoreRow): CatalogStatus {
  const catalog = normalizeCatalog(row.catalog_version);
  if (catalog?.isCurrentFrontend) return 'current';
  if (catalog?.isCurrentBackend) return 'future';
  return 'archive';
}

function catalogStatusLabelKey(row: ScoreRow): string {
  const status = catalogStatus(row);
  return `directus.interfaces.municipality_scores_publisher.status.${status}`;
}

function catalogLabel(row: ScoreRow): string {
  const catalog = normalizeCatalog(row.catalog_version);
  return catalog?.name || String(row.catalog_version || row.id);
}

function canTogglePublished(row: ScoreRow): boolean {
  return row.published === true || hasMinimumPublishPercentage(row);
}

function canSetPublished(row: ScoreRow, published: boolean): boolean {
  return !published || hasMinimumPublishPercentage(row);
}

function hasMinimumPublishPercentage(row: ScoreRow): boolean {
  return parseNumber(row.percentage_rated) >= MIN_PUBLISH_PERCENTAGE;
}

function formatScore(row: ScoreRow): string {
  return `${formatNumber(row.score_total)} (${formatNumber(row.score_points)}/${formatNumber(row.score_max)})`;
}

function formatNumber(value: string | number | null): string {
  const number = parseNumber(value);
  return Number.isFinite(number) ? number.toFixed(1) : '0.0';
}

function parseNumber(value: string | number | null): number {
  return typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
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

.modal-backdrop {
  align-items: center;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 9999;
}

.modal {
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
  color: var(--theme--foreground);
  max-width: 460px;
  padding: 20px;
  width: min(100%, 460px);
}

.modal-header {
  align-items: center;
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.modal-header :deep(.v-icon) {
  color: var(--theme--primary);
}

.modal p {
  color: var(--theme--foreground-subdued);
  line-height: 1.5;
  margin: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.primary-button {
  background: var(--theme--primary);
  border: 1px solid var(--theme--primary);
  border-radius: var(--theme--border-radius);
  color: var(--theme--primary-foreground, var(--theme--background));
  cursor: pointer;
  font: inherit;
  min-height: 40px;
  padding: 0 16px;
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
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 4px 8px;
}

.badge--current {
  background: var(--theme--success-background, var(--success-alt));
  color: var(--theme--success, var(--success));
}

.badge--future {
  background: var(--purple-25, var(--theme--primary-background));
  color: var(--purple, var(--theme--primary));
}

.badge--archive {
  background: var(--theme--warning-background, var(--warning-alt));
  color: var(--theme--warning, var(--warning));
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
