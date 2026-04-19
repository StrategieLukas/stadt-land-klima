<template>
  <div class="election-actions">

    <!-- Generate Questions card -->
    <div class="action-card">
      <div class="card-header">
        <v-icon name="auto_awesome" class="card-icon" />
        <div class="card-title-group">
          <h3 class="card-title">Thesen generieren</h3>
          <p class="card-subtitle">Top 10 Maßnahmen als Thesen erstellen</p>
        </div>

        <v-chip v-if="value?.already_generated_questions" x-small class="status-chip">
          <v-icon name="check_circle" x-small left />
          Bereits generiert
        </v-chip>
      </div>

      <!-- Already generated state -->
      <v-notice
        v-if="value?.already_generated_questions"
        type="success"
        class="card-notice"
      >
        Thesen wurden bereits generiert.
      </v-notice>

      <!-- Action button only if NOT generated -->
      <div v-else class="card-footer">
        <v-button
          :loading="loadingGenerate"
          :disabled="loadingGenerate || loadingMails"
          secondary
          @click="triggerGenerate"
        >
          <v-icon name="auto_awesome" left />
          Thesen generieren
        </v-button>
      </div>
    </div>

    <!-- Send Emails card — only rendered for admins -->
    <div v-if="currentUserIsAdmin" class="action-card">
      <div class="card-header">
        <v-icon name="mail" class="card-icon" />
        <div class="card-title-group">
          <h3 class="card-title">Kandidaten einladen</h3>
          <p class="card-subtitle">Personalisierte E-Mails mit Zugangslink versenden</p>
        </div>

        <v-chip v-if="value?.already_sent_mails" x-small class="status-chip">
          <v-icon name="check_circle" x-small left />
          Versendet
        </v-chip>
      </div>

      <v-notice v-if="!value?.already_generated_questions" type="info" class="card-notice">
        Bitte zuerst Thesen generieren.
      </v-notice>

      <v-notice v-if="value?.already_sent_mails" type="warning" class="card-notice">
        Bereits versendet — erneutes Ausführen sendet neue Einladungen an alle Kandidaten.
      </v-notice>

      <div class="card-footer">
        <v-button
          :loading="loadingMails"
          :disabled="loadingMails || loadingGenerate || !value?.already_generated_questions"
          @click="triggerMails"
        >
          <v-icon name="send" left />
          E-Mails versenden
        </v-button>
      </div>
    </div>

    <!-- Result feedback -->
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
import { ref, computed } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';

const props = defineProps({
  value: { type: Object, default: null },
  primaryKey: { type: [String, Number], default: null },
});

const emit = defineEmits(['input']);

const api = useApi();
const { useUserStore } = useStores();
const userStore = useUserStore();

const loadingGenerate = ref(false);
const loadingMails = ref(false);
const successMessage = ref(null);
const errorMessage = ref(null);

const currentUserIsAdmin = computed(() => {
  return userStore.currentUser?.role?.admin_access === true || userStore.currentUser?.role?.name === 'Administrator';
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

    const res = await api.get(`/items/elections/${props.primaryKey}`, {
      params: {
        fields: ['already_generated_questions', 'already_sent_mails'],
      },
    });

    emit('input', { ...props.value, ...res.data.data });
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
