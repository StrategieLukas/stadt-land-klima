<template>
  <div class="invite-panel">
    <h2>{{ selectRole ? "Person für eine Rolle einladen" : "Redakteur:in einladen" }}</h2>
    <p class="intro">
      {{
        selectRole
          ? "Wähle die Rolle für die Zusammenarbeit. Lokalteameinladungen bleiben im jeweiligen Lokalteam."
          : "Die eingeladene Person erhält Zugriff auf die Erfolgsprojekte-Redaktion."
      }}
    </p>
    <v-notice v-if="error" type="danger" class="notice">{{ error }}</v-notice>
    <v-notice v-if="success" type="success" class="notice"
      >Die Einladung für {{ success.role }} wurde an {{ success.email }} versendet.</v-notice
    >
    <form class="invite-form" @submit.prevent="submitInvite">
      <div v-if="selectRole" class="field full-width" role="group" aria-label="Rolle">
        <span>Rolle</span>
        <v-select
          :multiple="false"
          v-model="form.role"
          :items="roles.map((role) => ({ text: role.label, value: role.id }))"
          :disabled="submitting || loadingRoles"
          placeholder="Rolle auswählen"
        />
        <span v-if="selectedRole" class="role-description">{{ selectedRole.description }}</span>
      </div>
      <label class="field full-width"
        ><span>E-Mail-Adresse</span
        ><v-input
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="name@beispiel.de"
          :disabled="submitting"
      /></label>
      <div class="field full-width" role="group" aria-label="Aktion">
        <span>Aktion</span
        ><v-select
          :multiple="false"
          v-model="form.action"
          :items="[
            { text: 'Neue Einladung', value: 'invite' },
            { text: 'Einladung erneut senden', value: 'resend' },
          ]"
          :disabled="submitting"
        />
      </div>
      <template v-if="form.action === 'invite'">
        <label class="field"
          ><span>Vorname</span
          ><v-input v-model="form.firstName" autocomplete="given-name" :disabled="submitting" :max-length="100"
        /></label>
        <label class="field"
          ><span>Nachname</span
          ><v-input v-model="form.lastName" autocomplete="family-name" :disabled="submitting" :max-length="100"
        /></label>
      </template>
      <p v-else class="full-width intro">
        Erneut senden ist nur für offene Einladungen in derselben Rolle möglich. Bestehende Konten und Rollen werden
        nicht verändert.
      </p>
      <div class="full-width">
        <v-button type="submit" :loading="submitting" :disabled="!canSubmit || loadingRoles || submitting"
          ><v-icon name="send" left aria-hidden="true" />{{
            form.action === "resend" ? "Einladung erneut senden" : "Einladung senden"
          }}</v-button
        >
        <v-button v-if="selectRole && rolesError" secondary :disabled="loadingRoles" @click="loadRoles"
          >Rollen erneut laden</v-button
        >
      </div>
    </form>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useApi } from "@directus/extensions-sdk";
import type { InvitableRole } from "./roles";

const props = defineProps<{ endpoint: string; selectRole?: boolean }>();
const api = useApi();
const form = reactive({ email: "", firstName: "", lastName: "", role: "", action: "invite" as "invite" | "resend" });
const roles = ref<InvitableRole[]>([]);
const loadingRoles = ref(Boolean(props.selectRole));
const rolesError = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);
const success = ref<{ email: string; role: string } | null>(null);
const selectedRole = computed(() => roles.value.find((role) => role.id === form.role));
const canSubmit = computed(() =>
  Boolean(
    form.email.trim() &&
    (!props.selectRole || selectedRole.value) &&
    (form.action === "resend" || (form.firstName.trim() && form.lastName.trim())),
  ),
);
function errorMessage(
  value: unknown,
  fallback = "Die Einladung konnte nicht versendet werden. Bitte versuche es später erneut.",
): string {
  if (value && typeof value === "object" && "response" in value) {
    const response = value.response as { data?: { error?: unknown } } | undefined;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return fallback;
}
async function loadRoles() {
  loadingRoles.value = true;
  rolesError.value = false;
  error.value = null;
  try {
    const response = await api.get<{ roles: InvitableRole[] }>("/role-invitations/roles");
    roles.value = response.data.roles;
    if (!roles.value.length)
      error.value = "Es sind keine geeigneten Rollen verfügbar. Bitte prüfe die Rollenkonfiguration.";
  } catch (value) {
    rolesError.value = true;
    error.value = errorMessage(value, "Die Rollen konnten nicht geladen werden. Bitte versuche es später erneut.");
  } finally {
    loadingRoles.value = false;
  }
}
onMounted(async () => {
  if (props.selectRole) await loadRoles();
});
async function submitInvite() {
  if (!canSubmit.value || submitting.value || loadingRoles.value) return;
  submitting.value = true;
  error.value = null;
  success.value = null;
  try {
    const response = await api.post<{ user: { email: string; role: string }; mailSent: boolean }>(props.endpoint, {
      email: form.email,
      action: form.action,
      ...(props.selectRole ? { role: form.role } : {}),
      ...(form.action === "invite" ? { first_name: form.firstName, last_name: form.lastName } : {}),
    });
    success.value = { email: response.data.user.email, role: selectedRole.value?.label || "Erfolgsprojekte-Redaktion" };
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
h2 {
  font-size: 18px;
  margin-bottom: 8px;
}
.intro,
.role-description {
  color: var(--theme--foreground-subdued);
  line-height: 1.5;
}
.intro,
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
}
.full-width {
  grid-column: 1 / -1;
}
@media (max-width: 700px) {
  .invite-panel {
    padding: 12px;
  }
  .invite-form {
    grid-template-columns: 1fr;
  }
}
</style>
