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
        <v-chip v-if="reviewRequested" x-small class="status-chip status-chip--success">
          <v-icon name="rate_review" x-small left />
          Review angefragt
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
          v-if="!reviewRequested"
          :loading="loadingReview"
          :disabled="isAnyLoading || !alreadyGenerated"
          secondary
          @click="handleRequestReview"
        >
          <v-icon name="rate_review" left />
          Review der Thesen anfragen
        </v-button>
        <v-button v-else secondary disabled>
          <v-icon name="check" left />
          Review angefragt
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

    <teleport to="body">
      <div
        v-if="mailSummary"
        class="mail-summary-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mail-summary-title"
        @click.self="closeMailSummary"
      >
        <div class="mail-summary-dialog">
          <header class="mail-summary-header">
            <div>
              <h3 id="mail-summary-title">Versandübersicht</h3>
              <p>{{ mailSummarySubtitle }}</p>
            </div>
            <button
              type="button"
              class="mail-summary-close"
              aria-label="Versandübersicht schließen"
              @click="closeMailSummary"
            >
              <v-icon name="close" />
            </button>
          </header>

          <div class="mail-summary-counts">
            <div class="mail-summary-count mail-summary-count--success">
              <strong>{{ mailSummary.sentCount ?? 0 }}</strong>
              <span>Versendet</span>
            </div>
            <div class="mail-summary-count mail-summary-count--danger">
              <strong>{{ mailSummary.failedCount ?? 0 }}</strong>
              <span>Fehlgeschlagen</span>
            </div>
            <div class="mail-summary-count mail-summary-count--warning">
              <strong>{{ mailSummary.skippedCount ?? 0 }}</strong>
              <span>Ohne E-Mail übersprungen</span>
            </div>
          </div>

          <div class="mail-summary-sections">
            <section class="mail-summary-section">
              <h4>Erfolgreich benachrichtigt</h4>
              <p v-if="sentCandidates.length === 0" class="mail-summary-empty">
                Keine Kandidat:innen.
              </p>
              <ul v-else>
                <li v-for="candidate in sentCandidates" :key="`sent-${candidate.id}`">
                  <span class="mail-summary-name">{{ candidate.name }}</span>
                  <span class="mail-summary-detail">{{ candidate.email }}</span>
                </li>
              </ul>
            </section>

            <section class="mail-summary-section">
              <h4>Fehlgeschlagen</h4>
              <p v-if="failedCandidates.length === 0" class="mail-summary-empty">
                Keine fehlgeschlagenen E-Mails.
              </p>
              <ul v-else>
                <li v-for="candidate in failedCandidates" :key="`failed-${candidate.id}`">
                  <span class="mail-summary-name">{{ candidate.name }}</span>
                  <span class="mail-summary-detail">
                    {{ candidate.email || 'Keine E-Mail-Adresse' }}
                    <template v-if="candidate.message"> · {{ candidate.message }}</template>
                  </span>
                </li>
              </ul>
            </section>

            <section class="mail-summary-section">
              <h4>Übersprungen</h4>
              <p v-if="skippedCandidates.length === 0" class="mail-summary-empty">
                Keine Kandidat:innen ohne E-Mail-Adresse.
              </p>
              <ul v-else>
                <li v-for="candidate in skippedCandidates" :key="`skipped-${candidate.id}`">
                  <span class="mail-summary-name">{{ candidate.name }}</span>
                  <span class="mail-summary-detail">
                    {{ candidate.message || 'Keine E-Mail-Adresse hinterlegt.' }}
                  </span>
                </li>
              </ul>
            </section>
          </div>

          <footer class="mail-summary-footer">
            <v-button @click="closeMailSummary">Schließen</v-button>
          </footer>
        </div>
      </div>
    </teleport>

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
  reviewRequested: false,
});

// Session-level optimistic flags — set immediately on success so the UI
// reflects the change without waiting for the next fetchStatus call.
const sessionGenerated = ref(false);
const sessionSent = ref(false);
const sessionReviewRequested = ref(false);

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

const reviewRequested = computed(
  () =>
    sessionReviewRequested.value ||
    remote.value.reviewRequested ||
    !!props.values?.review_requested,
);

const isApproved = computed(
  () => remote.value.isApproved || !!props.values?.is_approved,
);

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

const loadingGenerate = ref(false);
const loadingMails = ref(false);
const loadingReview = ref(false);
const isAnyLoading = computed(
  () => loadingGenerate.value || loadingMails.value || loadingReview.value,
);

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

interface Feedback {
  type: 'success' | 'danger';
  message: string | null;
}

interface MailCandidateSummary {
  id: string | number;
  name: string;
  email: string | null;
  message?: string;
}

interface MailSendResult extends Record<string, unknown> {
  success?: boolean;
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
  totalCandidates?: number;
  sent?: MailCandidateSummary[];
  failed?: MailCandidateSummary[];
  skipped?: MailCandidateSummary[];
}

const feedback = ref<Feedback>({ type: 'success', message: null });
const mailSummary = ref<MailSendResult | null>(null);
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

const sentCandidates = computed(() => mailSummary.value?.sent ?? []);
const failedCandidates = computed(() => mailSummary.value?.failed ?? []);
const skippedCandidates = computed(() => mailSummary.value?.skipped ?? []);
const mailSummarySubtitle = computed(() => {
  if (!mailSummary.value) return '';

  return [
    `${mailSummary.value.sentCount ?? 0} versendet`,
    `${mailSummary.value.failedCount ?? 0} fehlgeschlagen`,
    `${mailSummary.value.skippedCount ?? 0} ohne E-Mail übersprungen`,
  ].join(', ');
});

function closeMailSummary() {
  mailSummary.value = null;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchStatus() {
  if (!isExistingRecord.value) return;

  try {
    const { data } = await api.get(`/items/elections/${props.primaryKey}`, {
      params: { fields: ['already_generated_questions', 'already_sent_mails', 'is_approved', 'review_requested'] },
    });

    if (data?.data) {
      remote.value = {
        alreadyGenerated: !!data.data.already_generated_questions,
        alreadySent: !!data.data.already_sent_mails,
        isApproved: !!data.data.is_approved,
        reviewRequested: !!data.data.review_requested,
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

async function callEndpoint<T extends Record<string, unknown> = Record<string, unknown>>(
  endpoint: string,
): Promise<T> {
  const { data } = await api.post(`/election-actions/${endpoint}`, {
    election_id: String(props.primaryKey),
  });

  if (data?.error) throw new Error(data.error);
  return data as T;
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

async function handleRequestReview() {
  loadingReview.value = true;
  try {
    await callEndpoint('request-review');
    sessionReviewRequested.value = true;
    showFeedback('success', 'Review der Thesen wurde angefragt.');
    fetchStatus();
  } catch (err) {
    showFeedback('danger', `Fehler: ${extractErrorMessage(err)}`);
  } finally {
    loadingReview.value = false;
  }
}

async function handleSendMails() {
  const confirmed = window.confirm(
    'E-Mails wirklich an alle Kandidat:innen mit hinterlegter E-Mail-Adresse versenden? Kandidat:innen ohne E-Mail werden übersprungen.',
  );
  if (!confirmed) return;

  loadingMails.value = true;
  try {
    const result = await callEndpoint<MailSendResult>('send-mails');
    const sentCount = result.sentCount ?? 0;
    const failedCount = result.failedCount ?? 0;
    const skippedCount = result.skippedCount ?? 0;

    mailSummary.value = result;
    sessionSent.value = sentCount > 0;

    if (failedCount > 0) {
      showFeedback(
        'danger',
        `E-Mail-Versand abgeschlossen: ${sentCount} versendet, ${failedCount} fehlgeschlagen, ${skippedCount} übersprungen.`,
        9000,
      );
    } else if (sentCount > 0) {
      showFeedback(
        'success',
        `E-Mail-Versand abgeschlossen: ${sentCount} versendet, ${skippedCount} übersprungen.`,
        9000,
      );
    } else {
      showFeedback(
        'danger',
        `Keine E-Mails wurden versendet. ${skippedCount} Kandidat:innen ohne E-Mail wurden übersprungen.`,
        9000,
      );
    }

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
  flex-wrap: wrap;
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

.mail-summary-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--theme--background-subdued, var(--background-subdued));
}

.mail-summary-dialog {
  width: min(860px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--theme--foreground, var(--foreground-normal));
  background: var(--theme--background, var(--background-page));
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, var(--border-radius));
}

.mail-summary-header,
.mail-summary-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--theme--border-color, var(--border-normal));
}

.mail-summary-header h3,
.mail-summary-header p,
.mail-summary-section h4,
.mail-summary-section p {
  margin: 0;
}

.mail-summary-header h3 {
  font-size: 18px;
  font-weight: 700;
}

.mail-summary-header p {
  margin-top: 4px;
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  font-size: 13px;
}

.mail-summary-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, var(--border-radius));
  color: var(--theme--foreground, var(--foreground-normal));
  background: var(--theme--background, var(--background-page));
  cursor: pointer;
}

.mail-summary-counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px 20px 0;
}

.mail-summary-count {
  padding: 14px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, var(--border-radius));
  background: var(--theme--background-subdued, var(--background-input));
}

.mail-summary-count strong {
  display: block;
  font-size: 24px;
  line-height: 1;
}

.mail-summary-count span {
  display: block;
  margin-top: 6px;
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  font-size: 12px;
}

.mail-summary-count--success strong {
  color: var(--theme--success, var(--success));
}

.mail-summary-count--danger strong {
  color: var(--theme--danger, var(--danger));
}

.mail-summary-count--warning strong {
  color: var(--theme--warning, var(--warning));
}

.mail-summary-sections {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px 20px;
  overflow: auto;
}

.mail-summary-section {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, var(--border-radius));
  background: var(--theme--background-subdued, var(--background-input));
}

.mail-summary-section h4 {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 700;
}

.mail-summary-section ul {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.mail-summary-section li {
  min-width: 0;
}

.mail-summary-name,
.mail-summary-detail {
  display: block;
  overflow-wrap: anywhere;
}

.mail-summary-name {
  font-weight: 600;
}

.mail-summary-detail,
.mail-summary-empty {
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  font-size: 12px;
}

.mail-summary-footer {
  justify-content: flex-end;
  border-top: 1px solid var(--theme--border-color, var(--border-normal));
  border-bottom: 0;
}

@media (max-width: 760px) {
  .mail-summary-counts,
  .mail-summary-sections {
    grid-template-columns: 1fr;
  }
}
</style>
