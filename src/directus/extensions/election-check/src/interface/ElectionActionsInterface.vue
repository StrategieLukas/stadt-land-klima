<template>
  <div v-if="isExistingRecord" class="election-actions">

    <!-- Generate Theses card -->
    <div class="action-card">
      <div class="card-header">
        <v-icon name="auto_awesome" class="card-icon" />
        <div class="card-title-group">
          <h3 class="card-title">Thesen generieren</h3>
          <p class="card-subtitle">Top 10 Maßnahmen als Thesen erstellen</p>
        </div>
        <v-chip v-if="alreadyGenerated" x-small class="status-chip status-chip--success">
          <v-icon name="check_circle" x-small left />
          Generiert
        </v-chip>
      </div>

      <v-notice v-if="alreadyGenerated" type="success" class="card-notice">
        Thesen wurden bereits generiert.
      </v-notice>

      <div class="card-footer">
        <v-button
          v-if="!alreadyGenerated"
          :loading="loadingGenerate"
          :disabled="isAnyLoading"
          secondary
          @click="handleGenerate"
        >
          <v-icon name="auto_awesome" left />
          Thesen generieren
        </v-button>
        <v-button v-else secondary disabled>
          <v-icon name="check" left />
          Thesen generiert
        </v-button>

        <v-button
          v-if="alreadyGenerated"
          :loading="loadingGenerate"
          :disabled="isAnyLoading"
          secondary
          class="rerun-button"
          @click="handleRegenerate"
        >
          <v-icon name="refresh" left />
          Neu generieren
        </v-button>
      </div>
    </div>

    <!-- Send Emails card — only shown when election is approved -->
    <div v-if="isApproved" class="action-card">
      <div class="card-header">
        <v-icon name="mail" class="card-icon" />
        <div class="card-title-group">
          <h3 class="card-title">Kandidaten einladen</h3>
          <p class="card-subtitle">Personalisierte E-Mails mit Zugangslink versenden</p>
        </div>
        <v-chip v-if="alreadySent" x-small class="status-chip status-chip--success">
          <v-icon name="check_circle" x-small left />
          Versendet
        </v-chip>
      </div>

      <v-notice v-if="alreadySent" type="success" class="card-notice">
        E-Mails wurden bereits versendet.
      </v-notice>

      <div class="card-footer">
        <v-button
          v-if="!alreadySent"
          :loading="loadingMails"
          :disabled="isAnyLoading || !alreadyGenerated"
          @click="handleSendMails"
        >
          <v-icon name="send" left />
          E-Mails versenden
        </v-button>
        <v-button v-else disabled>
          <v-icon name="check" left />
          E-Mails versendet
        </v-button>
      </div>

      <p v-if="!alreadyGenerated && !alreadySent" class="card-hint">
        <v-icon name="info" x-small />
        Thesen müssen zuerst generiert werden.
      </p>
    </div>

    <!-- Feedback notices -->
    <transition name="fade">
      <v-notice v-if="feedback.message" :type="feedback.type" class="result-notice">
        <v-icon :name="feedback.type === 'success' ? 'check' : 'error'" left small />
        {{ feedback.message }}
      </v-notice>
    </transition>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useApi } from '@directus/extensions-sdk';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const props = defineProps<{
  primaryKey?: string | number | null;
  values?: Record<string, unknown>;
}>();

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const api = useApi();

const isExistingRecord = computed(
  () => props.primaryKey != null && props.primaryKey !== '+',
);

// ---------------------------------------------------------------------------
// Remote state (fetched from API)
// ---------------------------------------------------------------------------

const remote = ref({
  alreadyGenerated: false,
  alreadySent: false,
  isApproved: false,
});

// Session-level optimistic flags — set immediately on success so the UI
// reflects the change without waiting for the next fetchStatus call.
const sessionGenerated = ref(false);
const sessionSent = ref(false);

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

const alreadyGenerated = computed(
  () =>
    sessionGenerated.value ||
    remote.value.alreadyGenerated ||
    !!props.values?.already_generated_questions,
);

const alreadySent = computed(
  () =>
    sessionSent.value ||
    remote.value.alreadySent ||
    !!props.values?.already_sent_mails,
);

const isApproved = computed(
  () => remote.value.isApproved || !!props.values?.is_approved,
);

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

const loadingGenerate = ref(false);
const loadingMails = ref(false);
const isAnyLoading = computed(() => loadingGenerate.value || loadingMails.value);

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

interface Feedback {
  type: 'success' | 'danger';
  message: string | null;
}

const feedback = ref<Feedback>({ type: 'success', message: null });
let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

function showFeedback(type: Feedback['type'], message: string, durationMs = 6000) {
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedback.value = { type, message };
  feedbackTimer = setTimeout(() => {
    feedback.value = { type: 'success', message: null };
  }, durationMs);
}

onBeforeUnmount(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer);
});

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchStatus() {
  if (!isExistingRecord.value) return;

  try {
    const { data } = await api.get(`/items/elections/${props.primaryKey}`, {
      params: { fields: ['already_generated_questions', 'already_sent_mails', 'is_approved'] },
    });

    if (data?.data) {
      remote.value = {
        alreadyGenerated: !!data.data.already_generated_questions,
        alreadySent: !!data.data.already_sent_mails,
        isApproved: !!data.data.is_approved,
      };
    }
  } catch {
    // Non-critical; fall back to props.values
  }
}

onMounted(fetchStatus);
watch(() => props.primaryKey, fetchStatus);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function callEndpoint(endpoint: string): Promise<Record<string, unknown>> {
  const { data } = await api.post(`/election-actions/${endpoint}`, {
    election_id: String(props.primaryKey),
  });

  if (data?.error) throw new Error(data.error);
  return data;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Try to surface a Directus API error message if present
    const apiMessage = (err as any)?.response?.data?.errors?.[0]?.message
      ?? (err as any)?.response?.data?.error;
    return apiMessage ?? err.message;
  }
  return String(err);
}

async function handleGenerate() {
  loadingGenerate.value = true;
  try {
    await callEndpoint('generate');
    sessionGenerated.value = true;
    showFeedback('success', 'Thesen wurden erfolgreich generiert.');
    fetchStatus(); // refresh in background to sync full server state
  } catch (err) {
    showFeedback('danger', `Fehler: ${extractErrorMessage(err)}`);
  } finally {
    loadingGenerate.value = false;
  }
}

async function handleRegenerate() {
  const confirmed = window.confirm(
    'Bestehende Thesen löschen und neu generieren?',
  );
  if (!confirmed) return;
  await handleGenerate();
}

async function handleSendMails() {
  const confirmed = window.confirm(
    'E-Mails wirklich an alle Kandidaten versenden? Diese Aktion kann nicht rückgängig gemacht werden.',
  );
  if (!confirmed) return;

  loadingMails.value = true;
  try {
    await callEndpoint('send-mails');
    sessionSent.value = true;
    showFeedback('success', 'E-Mails wurden erfolgreich versendet.');
    fetchStatus();
  } catch (err) {
    showFeedback('danger', `Fehler: ${extractErrorMessage(err)}`);
  } finally {
    loadingMails.value = false;
  }
}
</script>

<style scoped>
.election-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-card {
  border: 1px solid var(--border-normal);
  border-radius: var(--border-radius);
  background: var(--background-input);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.card-icon {
  --v-icon-color: var(--primary);
  flex-shrink: 0;
}

.card-title-group {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 2px;
}

.card-subtitle {
  font-size: 12px;
  color: var(--foreground-subdued);
  margin: 0;
}

.status-chip {
  flex-shrink: 0;
}

.status-chip--success {
  --v-chip-color: var(--success);
  --v-chip-background-color: var(--success-alt);
}

.card-notice {
  margin: 0 16px;
}

.card-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px 16px;
}

.rerun-button {
  --v-button-color: var(--foreground-subdued);
}

.card-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--foreground-subdued);
  margin: 0 16px 12px;
}

.result-notice {
  margin-top: 4px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
