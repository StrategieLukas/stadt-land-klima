<template>
  <div class="catalog-migration-manager">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Katalog-Migrationen</h2>
      <button
        @click="showCreateModal = true"
        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Neue Migration
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
      {{ error }}
    </div>

    <!-- Migrations List -->
    <div v-else class="space-y-6">
      <!-- In Progress Section -->
      <section v-if="inProgressMigrations.length > 0">
        <h3 class="text-lg font-semibold mb-3 text-blue-700">Laufende Migrationen</h3>
        <div class="space-y-3">
          <MigrationCard
            v-for="migration in inProgressMigrations"
            :key="migration.id"
            :migration="migration"
            @view="viewMigration"
          />
        </div>
      </section>

      <!-- Pending Section -->
      <section v-if="pendingMigrations.length > 0">
        <h3 class="text-lg font-semibold mb-3 text-yellow-700">Ausstehende Migrationen</h3>
        <div class="space-y-3">
          <MigrationCard
            v-for="migration in pendingMigrations"
            :key="migration.id"
            :migration="migration"
            @view="viewMigration"
            @execute="executeMigration"
            @delete="deleteMigration"
          />
        </div>
      </section>

      <!-- Completed Section -->
      <section v-if="completedMigrations.length > 0">
        <h3 class="text-lg font-semibold mb-3 text-green-700">Abgeschlossene Migrationen</h3>
        <div class="space-y-3">
          <MigrationCard
            v-for="migration in completedMigrations"
            :key="migration.id"
            :migration="migration"
            @view="viewMigration"
          />
        </div>
      </section>

      <!-- Failed Section -->
      <section v-if="failedMigrations.length > 0">
        <h3 class="text-lg font-semibold mb-3 text-red-700">Fehlgeschlagene Migrationen</h3>
        <div class="space-y-3">
          <MigrationCard
            v-for="migration in failedMigrations"
            :key="migration.id"
            :migration="migration"
            @view="viewMigration"
            @rollback="rollbackMigration"
          />
        </div>
      </section>

      <!-- Empty State -->
      <div
        v-if="migrations.length === 0"
        class="text-center py-12 bg-gray-50 rounded-lg"
      >
        <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
        <p class="text-gray-600">Keine Migrationen vorhanden</p>
        <p class="text-gray-500 text-sm mt-1">Erstellen Sie eine neue Migration, um Bewertungen zwischen Katalogversionen zu übertragen.</p>
      </div>
    </div>

    <!-- Create Migration Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4">
          <div class="p-6 border-b">
            <h3 class="text-xl font-semibold">Neue Migration erstellen</h3>
          </div>
          
          <div class="p-6 space-y-4">
            <!-- Source Version -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Quell-Katalogversion
              </label>
              <select
                v-model="newMigration.sourceVersion"
                class="w-full border rounded-lg px-3 py-2"
                @change="updatePreview"
              >
                <option value="">Version auswählen...</option>
                <option
                  v-for="version in catalogVersions"
                  :key="version.id"
                  :value="version.id"
                >
                  {{ version.name }} (v{{ version.version }})
                </option>
              </select>
            </div>

            <!-- Target Version -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Ziel-Katalogversion
              </label>
              <select
                v-model="newMigration.targetVersion"
                class="w-full border rounded-lg px-3 py-2"
                @change="updatePreview"
              >
                <option value="">Version auswählen...</option>
                <option
                  v-for="version in catalogVersions"
                  :key="version.id"
                  :value="version.id"
                  :disabled="version.id === newMigration.sourceVersion"
                >
                  {{ version.name }} (v{{ version.version }})
                </option>
              </select>
            </div>

            <!-- Migration Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Migrationstyp
              </label>
              <select
                v-model="newMigration.migrationType"
                class="w-full border rounded-lg px-3 py-2"
              >
                <option value="upgrade">Upgrade</option>
                <option value="downgrade">Downgrade</option>
                <option value="parallel">Parallel (Kopie)</option>
              </select>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Notizen
              </label>
              <textarea
                v-model="newMigration.notes"
                rows="3"
                class="w-full border rounded-lg px-3 py-2"
                placeholder="Optionale Beschreibung der Migration..."
              ></textarea>
            </div>

            <!-- Preview -->
            <div v-if="preview" class="bg-blue-50 rounded-lg p-4">
              <h4 class="font-medium text-blue-900 mb-2">Vorschau</h4>
              <p class="text-blue-800">
                {{ preview.count }} Bewertungen werden migriert
              </p>
              <p v-if="preview.hasMore" class="text-blue-600 text-sm mt-1">
                (Zeige erste 50)
              </p>
            </div>
          </div>
          
          <div class="p-6 border-t bg-gray-50 flex justify-end gap-3">
            <button
              @click="showCreateModal = false"
              class="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              Abbrechen
            </button>
            <button
              @click="createMigration"
              :disabled="!canCreate || isCreating"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isCreating ? 'Erstelle...' : 'Migration erstellen' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Migration Detail Modal -->
    <Teleport to="body">
      <div
        v-if="selectedMigration"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="selectedMigration = null"
      >
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
          <div class="p-6 border-b flex justify-between items-center">
            <h3 class="text-xl font-semibold">Migration Details</h3>
            <button
              @click="selectedMigration = null"
              class="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="p-6 space-y-6">
            <!-- Status Badge -->
            <div class="flex items-center gap-3">
              <span class="font-medium">Status:</span>
              <span :class="getStatusClass(selectedMigration.status)" class="px-3 py-1 rounded-full text-sm font-medium">
                {{ getStatusLabel(selectedMigration.status) }}
              </span>
            </div>

            <!-- Versions -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-sm text-gray-500 mb-1">Quellversion</div>
                <div class="font-medium">
                  {{ selectedMigration.source_version?.name || 'N/A' }}
                </div>
              </div>
              <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-sm text-gray-500 mb-1">Zielversion</div>
                <div class="font-medium">
                  {{ selectedMigration.target_version?.name || 'N/A' }}
                </div>
              </div>
            </div>

            <!-- Statistics -->
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center">
                <div class="text-3xl font-bold text-gray-900">
                  {{ selectedMigration.affected_ratings_count || 0 }}
                </div>
                <div class="text-sm text-gray-500">Betroffen</div>
              </div>
              <div class="text-center">
                <div class="text-3xl font-bold text-green-600">
                  {{ selectedMigration.successful_migrations || 0 }}
                </div>
                <div class="text-sm text-gray-500">Erfolgreich</div>
              </div>
              <div class="text-center">
                <div class="text-3xl font-bold text-red-600">
                  {{ selectedMigration.failed_migrations || 0 }}
                </div>
                <div class="text-sm text-gray-500">Fehlgeschlagen</div>
              </div>
            </div>

            <!-- Dates -->
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Erstellt:</span>
                <span>{{ formatDate(selectedMigration.date_created) }}</span>
              </div>
              <div v-if="selectedMigration.started_at" class="flex justify-between">
                <span class="text-gray-500">Gestartet:</span>
                <span>{{ formatDate(selectedMigration.started_at) }}</span>
              </div>
              <div v-if="selectedMigration.completed_at" class="flex justify-between">
                <span class="text-gray-500">Abgeschlossen:</span>
                <span>{{ formatDate(selectedMigration.completed_at) }}</span>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="selectedMigration.notes">
              <div class="text-sm font-medium text-gray-500 mb-1">Notizen</div>
              <div class="bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                {{ selectedMigration.notes }}
              </div>
            </div>

            <!-- Error Log -->
            <div v-if="selectedMigration.error_log?.length">
              <div class="text-sm font-medium text-red-500 mb-1">Fehler</div>
              <div class="bg-red-50 rounded-lg p-3 space-y-2 text-sm">
                <div
                  v-for="(err, idx) in selectedMigration.error_log.slice(0, 10)"
                  :key="idx"
                  class="text-red-700"
                >
                  {{ err.ratingId ? `Rating ${err.ratingId}: ` : '' }}{{ err.error }}
                </div>
                <div v-if="selectedMigration.error_log.length > 10" class="text-red-500">
                  ... und {{ selectedMigration.error_log.length - 10 }} weitere Fehler
                </div>
              </div>
            </div>

            <!-- Transformation Rules -->
            <div v-if="selectedMigration.transformation_rules">
              <div class="text-sm font-medium text-gray-500 mb-1">Transformationsregeln</div>
              <pre class="bg-gray-50 rounded-lg p-3 text-xs overflow-x-auto">{{ JSON.stringify(selectedMigration.transformation_rules, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCatalogMigration } from '~/composables/useCatalogMigration';

// Composable
const {
  migrations,
  isLoading,
  error,
  pendingMigrations,
  inProgressMigrations,
  completedMigrations,
  failedMigrations,
  loadMigrations,
  createNewMigration,
  previewMigration,
  runMigration,
  cancelMigration,
  getCatalogVersions
} = useCatalogMigration();

// Local state
const showCreateModal = ref(false);
const selectedMigration = ref(null);
const isCreating = ref(false);
const catalogVersions = ref([]);
const preview = ref(null);

const newMigration = ref({
  sourceVersion: '',
  targetVersion: '',
  migrationType: 'upgrade',
  notes: ''
});

// Computed
const canCreate = computed(() => 
  newMigration.value.sourceVersion && 
  newMigration.value.targetVersion &&
  newMigration.value.sourceVersion !== newMigration.value.targetVersion
);

// Methods
function viewMigration(migration) {
  selectedMigration.value = migration;
}

async function updatePreview() {
  if (canCreate.value) {
    preview.value = await previewMigration(
      newMigration.value.sourceVersion,
      newMigration.value.targetVersion
    );
  } else {
    preview.value = null;
  }
}

async function createMigration() {
  if (!canCreate.value) return;
  
  isCreating.value = true;
  try {
    await createNewMigration({
      sourceVersion: newMigration.value.sourceVersion,
      targetVersion: newMigration.value.targetVersion,
      migrationType: newMigration.value.migrationType,
      notes: newMigration.value.notes
    });
    
    showCreateModal.value = false;
    newMigration.value = {
      sourceVersion: '',
      targetVersion: '',
      migrationType: 'upgrade',
      notes: ''
    };
    preview.value = null;
  } finally {
    isCreating.value = false;
  }
}

async function executeMigration(migration) {
  if (confirm(`Migration von ${migration.source_version?.name} zu ${migration.target_version?.name} starten?`)) {
    await runMigration(migration.id);
    await loadMigrations();
  }
}

async function deleteMigration(migration) {
  if (confirm('Migration wirklich löschen?')) {
    // TODO: Implement delete
    await loadMigrations();
  }
}

async function rollbackMigration(migration) {
  if (confirm('Migration rückgängig machen? Alle migrierten Bewertungen werden gelöscht.')) {
    await cancelMigration(migration.id);
    await loadMigrations();
  }
}

function getStatusClass(status) {
  const classes = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    completed_with_errors: 'bg-orange-100 text-orange-800',
    failed: 'bg-red-100 text-red-800',
    rolled_back: 'bg-gray-100 text-gray-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
}

function getStatusLabel(status) {
  const labels = {
    pending: 'Ausstehend',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    completed_with_errors: 'Mit Fehlern abgeschlossen',
    failed: 'Fehlgeschlagen',
    rolled_back: 'Rückgängig gemacht'
  };
  return labels[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('de-DE');
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadMigrations(),
    getCatalogVersions().then(v => catalogVersions.value = v)
  ]);
});
</script>

<script>
// MigrationCard sub-component
const MigrationCard = {
  template: `
    <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span :class="getStatusClass(migration.status)" class="px-2 py-0.5 rounded-full text-xs font-medium">
              {{ getStatusLabel(migration.status) }}
            </span>
            <span class="text-xs text-gray-500">
              {{ migration.migration_type }}
            </span>
          </div>
          <div class="font-medium">
            {{ migration.source_version?.name || 'N/A' }}
            <span class="text-gray-400 mx-2">→</span>
            {{ migration.target_version?.name || 'N/A' }}
          </div>
          <div class="text-sm text-gray-500 mt-1">
            {{ migration.affected_ratings_count || 0 }} Bewertungen
            <span v-if="migration.successful_migrations" class="text-green-600 ml-2">
              {{ migration.successful_migrations }} erfolgreich
            </span>
            <span v-if="migration.failed_migrations" class="text-red-600 ml-2">
              {{ migration.failed_migrations }} fehlgeschlagen
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            @click="$emit('view', migration)"
            class="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            title="Details"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            v-if="migration.status === 'pending'"
            @click="$emit('execute', migration)"
            class="p-2 hover:bg-green-100 rounded-lg text-green-600"
            title="Ausführen"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            v-if="migration.status === 'pending'"
            @click="$emit('delete', migration)"
            class="p-2 hover:bg-red-100 rounded-lg text-red-600"
            title="Löschen"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            v-if="migration.status === 'completed_with_errors' || migration.status === 'failed'"
            @click="$emit('rollback', migration)"
            class="p-2 hover:bg-orange-100 rounded-lg text-orange-600"
            title="Rückgängig"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  props: ['migration'],
  emits: ['view', 'execute', 'delete', 'rollback'],
  methods: {
    getStatusClass(status) {
      const classes = {
        pending: 'bg-yellow-100 text-yellow-800',
        in_progress: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        completed_with_errors: 'bg-orange-100 text-orange-800',
        failed: 'bg-red-100 text-red-800',
        rolled_back: 'bg-gray-100 text-gray-800'
      };
      return classes[status] || 'bg-gray-100 text-gray-800';
    },
    getStatusLabel(status) {
      const labels = {
        pending: 'Ausstehend',
        in_progress: 'In Bearbeitung',
        completed: 'Abgeschlossen',
        completed_with_errors: 'Mit Fehlern',
        failed: 'Fehlgeschlagen',
        rolled_back: 'Rückgängig'
      };
      return labels[status] || status;
    }
  }
};
</script>

<script>
export default {
  components: {
    MigrationCard
  }
};
</script>

<style scoped>
.catalog-migration-manager {
  @apply max-w-4xl mx-auto;
}
</style>
