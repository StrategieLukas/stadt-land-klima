<template>
  <private-view title="Consent Management">
    <template #actions>
      <v-button
        v-if="!status.hasAccepted && canSubmit"
        :loading="submitting"
        @click="acceptAgreements"
      >
        <v-icon name="check" />
        {{ $t('accept_and_continue') }}
      </v-button>
    </template>

    <div v-if="loading" class="loading-container">
      <v-progress-circular indeterminate />
    </div>

    <div v-else-if="loadError" class="error-container">
      <v-notice type="danger">
        {{ loadError }}
      </v-notice>
    </div>

    <div v-else>
      <!-- ── Already accepted ──────────────────────────────────────────── -->
      <v-notice v-if="status.hasAccepted" type="success">
        {{ $t('consent_accepted_message') }}
      </v-notice>

      <!-- Newsletter toggle shown after acceptance -->
      <div v-if="status.hasAccepted" class="newsletter-toggle">
        <v-checkbox
          :label="$t('subscribe_to_newsletter')"
          :model-value="status.newsletterSubscribed"
          :disabled="newsletterUpdating"
          @update:model-value="toggleNewsletter"
        />
      </div>

      <!-- ── Pending acceptance ────────────────────────────────────────── -->
      <template v-if="!status.hasAccepted">
        <v-notice type="warning">
          {{ $t('consent_not_accepted') }}
        </v-notice>

        <div class="agreements-container">
          <div v-if="agbHtml" class="agreement-section">
            <h3>Allgemeine Geschäftsbedingungen (AGB)</h3>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="prose py-4" v-html="agbHtml" />
          </div>

          <div v-if="dataProtectionHtml" class="agreement-section">
            <h3>Datenschutzerklärung</h3>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="prose py-4" v-html="dataProtectionHtml" />
          </div>

          <div v-if="newsletterHtml" class="agreement-section">
            <h3>Newsletter</h3>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="prose py-4" v-html="newsletterHtml" />
          </div>

          <div class="checkbox-section">
            <v-checkbox
              v-model="agbChecked"
              label="Ich akzeptiere die AGB"
              :disabled="status.hasAccepted"
              class="required-checkbox"
            />
            <v-checkbox
              v-model="dataProtectionChecked"
              label="Ich akzeptiere die Datenschutzerklärung"
              :disabled="status.hasAccepted"
              class="required-checkbox"
            />
            <v-checkbox
              v-model="newsletterChecked"
              :label="$t('subscribe_to_newsletter')"
              :disabled="status.hasAccepted"
              class="newsletter-checkbox"
            />
          </div>
        </div>
      </template>
    </div>
  </private-view>
</template>

<script lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import MarkdownIt from 'markdown-it';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgreementVersion {
  id: string;
  type: 'terms_of_service' | 'data_protection' | 'newsletter';
  version: string;
  legal_text: string;
}

interface ConsentStatus {
  hasAccepted: boolean;
  newsletterSubscribed: boolean;
  agbVersion: string | null;
  dataProtectionVersion: string | null;
  newsletterVersion: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const md = new MarkdownIt();

function renderMarkdown(text: string | null | undefined): string | null {
  if (!text) return null;
  return md.render(text);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default {
  setup() {
    const api = useApi();

    // ── State ──────────────────────────────────────────────────────────────

    const loading = ref(true);
    const loadError = ref<string | null>(null);
    const submitting = ref(false);
    const newsletterUpdating = ref(false);

    // Consent status from the server — single source of truth. We no longer
    // maintain a parallel set of local booleans for what is/isn't accepted;
    // that led to the original bug where hasAccepted was computed before the
    // version IDs were populated.
    const status = ref<ConsentStatus>({
      hasAccepted: false,
      newsletterSubscribed: false,
      agbVersion: null,
      dataProtectionVersion: null,
      newsletterVersion: null,
    });

    // Agreement rendered HTML — populated once on mount.
    const agbHtml = ref<string | null>(null);
    const dataProtectionHtml = ref<string | null>(null);
    const newsletterHtml = ref<string | null>(null);

    // Checkbox state for the acceptance form.
    const agbChecked = ref(false);
    const dataProtectionChecked = ref(false);
    const newsletterChecked = ref(false);

    // The accept button is enabled only when both required boxes are ticked.
    const canSubmit = computed(() => agbChecked.value && dataProtectionChecked.value);

    // ── Data loading ────────────────────────────────────────────────────────

    async function loadAgreementVersions(): Promise<void> {
      const { data: { data: versions } } = await api.get<{ data: AgreementVersion[] }>(
        '/items/agreement_versions',
        {
          params: {
            filter: { isCurrentVersion: { _eq: true } },
            fields: ['id', 'type', 'version', 'legal_text'],
            limit: -1,
          },
        }
      );

      for (const version of versions) {
        const html = renderMarkdown(version.legal_text);
        switch (version.type) {
          case 'terms_of_service':
            agbHtml.value = html;
            break;
          case 'data_protection':
            dataProtectionHtml.value = html;
            break;
          case 'newsletter':
            newsletterHtml.value = html;
            break;
        }
      }
    }

    async function loadConsentStatus(): Promise<void> {
      // Use the dedicated endpoint so all consent logic lives server-side.
      // Previously the Vue component was calling /items/user_consent directly
      // and reconstructing the status in the browser.
      const { data } = await api.get<ConsentStatus>('/consent/status');
      status.value = data;

      if (data.hasAccepted) {
        agbChecked.value = true;
        dataProtectionChecked.value = true;
        newsletterChecked.value = data.newsletterSubscribed;
      }
    }

    // ── Actions ─────────────────────────────────────────────────────────────

    async function acceptAgreements(): Promise<void> {
      // Guard against accidental double-submit (e.g. rapid clicks).
      if (submitting.value || !canSubmit.value) return;

      submitting.value = true;
      try {
        // Delegate all consent creation to the server endpoint. This replaces
        // the original approach of posting to /items/user_consent three times
        // from the frontend.
        await api.post('/consent/accept', {
          subscribeNewsletter: newsletterChecked.value,
        });

        // Reload status from the server to keep the UI in sync with reality
        // rather than optimistically assuming success.
        await loadConsentStatus();
      } catch (error: unknown) {
        const msg =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (error as { response?: { data?: { error?: string } } }).response?.data?.error ??
          (error as Error).message ??
          'Unknown error';
        alert('Fehler beim Akzeptieren: ' + msg);
      } finally {
        submitting.value = false;
      }
    }

    async function toggleNewsletter(subscribe: boolean): Promise<void> {
      if (newsletterUpdating.value) return;

      newsletterUpdating.value = true;
      try {
        if (subscribe) {
          await api.post('/consent/newsletter/optin');
        } else {
          await api.delete('/consent/newsletter/optout');
        }
        // Update local status immediately; no full reload needed.
        status.value = { ...status.value, newsletterSubscribed: subscribe };
      } catch (error: unknown) {
        const msg =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (error as { response?: { data?: { error?: string } } }).response?.data?.error ??
          (error as Error).message ??
          'Unknown error';
        alert('Fehler beim Aktualisieren des Newsletters: ' + msg);
      } finally {
        newsletterUpdating.value = false;
      }
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    onMounted(async () => {
      try {
        // Load versions and status concurrently — they are independent queries.
        await Promise.all([loadAgreementVersions(), loadConsentStatus()]);
      } catch (error: unknown) {
        console.error('[consent] Error loading consent data:', error);
        loadError.value = 'Fehler beim Laden der Einverständniserklärungen.';
      } finally {
        loading.value = false;
      }
    });

    return {
      loading,
      loadError,
      submitting,
      newsletterUpdating,
      status,
      agbHtml,
      dataProtectionHtml,
      newsletterHtml,
      agbChecked,
      dataProtectionChecked,
      newsletterChecked,
      canSubmit,
      acceptAgreements,
      toggleNewsletter,
    };
  },
};
</script>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.error-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.agreements-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.agreement-section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid var(--border-normal);
  border-radius: 8px;
  background-color: var(--background-normal);
}

.checkbox-section {
  margin-top: 20px;
  padding: 20px;
  background-color: var(--background-subdued);
  border-radius: 8px;
}

.required-checkbox {
  margin-bottom: 15px;
}

.newsletter-toggle {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  background-color: var(--background-subdued);
  border-radius: 8px;
}
</style>
