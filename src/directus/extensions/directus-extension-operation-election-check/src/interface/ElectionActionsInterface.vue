<template>
  <div v-if="primaryKey && primaryKey !== '+'" class="election-actions">

  <!-- Generate Questions card -->
  <div class="action-card">
    <div class="card-header">
      <v-icon name="auto_awesome" class="card-icon" />
      <div class="card-title-group">
        <h3 class="card-title">Thesen generieren</h3>
        <p class="card-subtitle">Top 10 Maßnahmen als Thesen erstellen</p>
      </div>

      <v-chip v-if="localAlreadyGenerated" x-small class="status-chip">
        <v-icon name="check_circle" x-small left />
        Bereits generiert
      </v-chip>
    </div>

    <!-- Already generated state -->
    <v-notice
      v-if="localAlreadyGenerated"
      type="success"
      class="card-notice"
    >
      Thesen wurden bereits generiert.
    </v-notice>

    <!-- Action button -->
    <div class="card-footer">
      <v-button
        v-if="!localAlreadyGenerated"
        :loading="loadingGenerate"
        :disabled="loadingGenerate || loadingMails"
        secondary
        @click="triggerGenerate"
      >
        <v-icon name="auto_awesome" left />
        Thesen generieren
      </v-button>
      <v-button
        v-else
        disabled
        secondary
      >
        <v-icon name="check" left />
        Thesen generiert
      </v-button>
    </div>
  </div>

  <!-- Send Emails card — only rendered when election is approved -->
  <div v-if="isApproved" class="action-card">
    <div class="card-header">
      <v-icon name="mail" class="card-icon" />
      <div class="card-title-group">
        <h3 class="card-title">Kandidaten einladen</h3>
        <p class="card-subtitle">Personalisierte E-Mails mit Zugangslink versenden</p>
      </div>

      <v-chip v-if="localAlreadySent" x-small class="status-chip">
        <v-icon name="check_circle" x-small left />
        Versendet
      </v-chip>
    </div>

    <!-- Already sent notice -->
    <v-notice v-if="localAlreadySent" type="success" class="card-notice">
      E-Mails wurden bereits versendet.
    </v-notice>

    <div class="card-footer">
      <v-button
        v-if="!localAlreadySent"
        :loading="loadingMails"
        :disabled="loadingMails || loadingGenerate"
        @click="triggerMails"
      >
        <v-icon name="send" left />
        E-Mails versenden
      </v-button>
      <v-button
        v-else
        disabled
      >
        <v-icon name="check" left />
        E-Mails versendet
      </v-button>
    </div>
  </div>

    <transition name="fade">
      <v-notice v-if="successMessage" type="success" class="result-notice">
        <v-icon name="check" left small />
        {{ successMessage }}
      </v-notice>
    </transition>

    <transition name="fade">
      <v-notice v-if="errorMessage" type="danger" class="result-notice">
        <v-icon name="error" left small />
        {{ errorMessage }}
      </v-notice>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useApi } from '@directus/extensions-sdk';

const props = defineProps({
  value: { type: Object, default: null },
  primaryKey: { type: [String, Number], default: null },
  values: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['input']);

const api = useApi();

// Debug logging
console.log('[election-actions] Component loaded');
console.log('[election-actions] props.values:', props.values);

const loadingGenerate = ref(false);
const loadingMails = ref(false);
const loadingData = ref(false);
const successMessage = ref(null);
const errorMessage = ref(null);

// Local override state to show immediate feedback after successful action
const dbAlreadyGenerated = ref(false);
const dbAlreadySent = ref(false);
const dbIsApproved = ref(false);
const sessionGenerated = ref(false);
const sessionMailsSent = ref(false);

const localAlreadyGenerated = computed(() => {
  return sessionGenerated.value || dbAlreadyGenerated.value || !!props.values?.already_generated_questions;
});

const localAlreadySent = computed(() => {
  return sessionMailsSent.value || dbAlreadySent.value || !!props.values?.already_sent_mails;
});

// Show send emails button when election is approved
// Use dbIsApproved (from API) first, then fall back to props.values
const isApproved = computed(() => {
  const result = dbIsApproved.value || !!props.values?.is_approved;
  console.log('[election-actions] isApproved computed:', result, 'dbIsApproved:', dbIsApproved.value, 'props.values.is_approved:', props.values?.is_approved);
  return result;
});

async function fetchStatus() {
  if (!props.primaryKey || props.primaryKey === '+') return;

  loadingData.value = true;
  try {
    console.log('[election-actions] Fetching status for election:', props.primaryKey);
    const res = await api.get(`/items/elections/${props.primaryKey}`, {
      params: {
        fields: ['already_generated_questions', 'already_sent_mails', 'is_approved']
      }
    });

    if (res.data?.data) {
      dbAlreadyGenerated.value = !!res.data.data.already_generated_questions;
      dbAlreadySent.value = !!res.data.data.already_sent_mails;
      dbIsApproved.value = !!res.data.data.is_approved;
      console.log('[election-actions] Fetched data:', {
        already_generated_questions: res.data.data.already_generated_questions,
        already_sent_mails: res.data.data.already_sent_mails,
        is_approved: res.data.data.is_approved
      });
    }
  } catch (err) {
    console.error('[election-actions] Failed to fetch status:', err);
  } finally {
    loadingData.value = false;
  }
}

onMounted(() => {
  fetchStatus();
});

watch(() => props.primaryKey, () => {
  fetchStatus();
});

let feedbackTimer = null;

function showFeedback(type, message) {
  if (type === 'success') {
    successMessage.value = message;
    errorMessage.value = null;
  } else {
    errorMessage.value = message;
    successMessage.value = null;
  }

  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    successMessage.value = null;
    errorMessage.value = null;
  }, 6000);
}

async function triggerAction(endpoint, loadingRef, successText) {
  if (!props.primaryKey) {
    showFeedback('error', 'Kein Datensatz gespeichert — bitte zuerst speichern.');
    return;
  }

  loadingRef.value = true;

  try {
    const resPost = await api.post(`/election-actions/${endpoint}`, {
      election_id: String(props.primaryKey),
    });

    if (resPost.data.error) {
      throw new Error(resPost.data.error);
    }

    showFeedback('success', successText);

    if (endpoint === 'generate') sessionGenerated.value = true;
    if (endpoint === 'send-mails') sessionMailsSent.value = true;
  } catch (err) {
    const detail =
      err?.response?.data?.errors?.[0]?.message ||
      err?.response?.data?.error ||
      err.message ||
      'Unbekannter Fehler';

    showFeedback('error', `Fehler: ${detail}`);
  } finally {
    loadingRef.value = false;
  }
}

function triggerGenerate() {
  triggerAction(
    'generate',
    loadingGenerate,
    'Thesen wurden erfolgreich generiert.'
  );
}

function triggerMails() {
  const confirmed = window.confirm(
    'E-Mails wirklich an alle Kandidaten versenden?'
  );

  if (!confirmed) return;

  triggerAction(
    'send-mails',
    loadingMails,
    'E-Mails wurden erfolgreich versendet.'
  );
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
  --v-chip-color: var(--success);
  --v-chip-background-color: var(--success-alt);
}

.card-notice {
  margin: 0 16px 0;
}

.card-footer {
  padding: 12px 16px 16px;
}
</style>
