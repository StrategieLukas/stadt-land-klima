<template>
  <div class="invite-panel" :class="{ 'has-header': showHeader }">
    <header class="panel-header">
      <div class="header-icon"><v-icon name="person_add" /></div>
      <div>
        <h2>Redakteur:in einladen</h2>
        <p>
          Die eingeladene Person erhält Zugriff auf die
          Erfolgsprojekte-Redaktion.
        </p>
      </div>
    </header>

    <v-notice v-if="error" type="danger" class="notice">
      {{ error }}
    </v-notice>
    <v-notice
      v-if="success"
      :type="success.mailSent ? 'success' : 'warning'"
      class="notice"
    >
      <template v-if="success.mailSent">
        Die Einladung wurde an {{ success.email }} versendet.
      </template>
      <template v-else>
        Das Konto für {{ success.email }} wurde angelegt. Im Entwicklungsmodus
        wurde keine E-Mail versendet.
      </template>
    </v-notice>

    <form class="invite-form" @submit.prevent="submitInvite">
      <label class="field field-email">
        <span>E-Mail-Adresse</span>
        <v-input
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="name@beispiel.de"
          :disabled="submitting"
        />
      </label>

      <label class="field">
        <span>Vorname</span>
        <v-input
          v-model="form.firstName"
          autocomplete="given-name"
          :disabled="submitting"
        />
      </label>

      <label class="field">
        <span>Nachname</span>
        <v-input
          v-model="form.lastName"
          autocomplete="family-name"
          :disabled="submitting"
        />
      </label>

      <div class="form-actions">
        <v-button
          type="submit"
          :loading="submitting"
          :disabled="!canSubmit || submitting"
        >
          <v-icon name="send" left />
          Einladung senden
        </v-button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useApi } from "@directus/extensions-sdk";

defineProps({
  showHeader: { type: Boolean, default: false },
});

interface InviteResponse {
  mailSent: boolean;
  user: { email: string };
}

const api = useApi();
const form = reactive({
  email: "",
  firstName: "",
  lastName: "",
});
const submitting = ref(false);
const error = ref<string | null>(null);
const success = ref<{ email: string; mailSent: boolean } | null>(null);

const canSubmit = computed(() =>
  Boolean(form.email.trim() && form.firstName.trim() && form.lastName.trim()),
);

function errorMessage(value: unknown): string {
  if (value && typeof value === "object") {
    const response = (value as { response?: { data?: { error?: string } } })
      .response;
    if (response?.data?.error) return response.data.error;
  }
  return value instanceof Error
    ? value.message
    : "Die Einladung konnte nicht versendet werden.";
}

async function submitInvite() {
  if (!canSubmit.value || submitting.value) return;

  submitting.value = true;
  error.value = null;
  success.value = null;

  try {
    const response = await api.post<InviteResponse>(
      "/erfolgsprojekte-users/invite",
      {
        email: form.email,
        first_name: form.firstName,
        last_name: form.lastName,
      },
    );
    success.value = {
      email: response.data.user.email,
      mailSent: response.data.mailSent,
    };
    form.email = "";
    form.firstName = "";
    form.lastName = "";
  } catch (value) {
    error.value = errorMessage(value);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.invite-panel {
  height: 100%;
  overflow: auto;
  padding: 24px;
  color: var(--theme--foreground);
  background: var(--theme--background);
  font-family: var(--theme--fonts--sans--font-family);
}

.invite-panel.has-header {
  padding-top: 12px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  color: var(--theme--primary);
  background: var(--theme--primary-background);
  border-radius: var(--theme--border-radius);
}

.panel-header h2,
.panel-header p {
  margin: 0;
}

.panel-header h2 {
  font-size: 18px;
  font-weight: 700;
}

.panel-header p {
  margin-top: 4px;
  color: var(--theme--foreground-subdued);
  font-size: 13px;
}

.notice {
  margin-bottom: 18px;
}

.invite-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  max-width: 760px;
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.field > span {
  color: var(--theme--foreground-subdued);
  font-size: 13px;
  font-weight: 600;
}

.field-email,
.form-actions {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  justify-content: flex-start;
  padding-top: 4px;
}

@media (max-width: 700px) {
  .invite-panel {
    padding: 18px;
  }

  .invite-form {
    grid-template-columns: 1fr;
  }

  .field-email,
  .form-actions {
    grid-column: auto;
  }
}
</style>
