<template>
  <private-view title="Consent Management">
    <template #actions>
      <v-button v-if="!hasAccepted && agbChecked && dataProtectionChecked" @click="acceptAgreements">
        <v-icon name="check" />
        {{ $t('accept_and_continue') }}
      </v-button>
    </template>
    <div v-if="loading">
      Loading...
    </div>
    <div v-else>
      <v-notice v-if="!hasAccepted" type="warning">
        {{ $t('consent_not_accepted') }}
      </v-notice>
      
      <div v-if="!hasAccepted" class="agreements-container">
        <div v-if="agbTextHtml" class="agreement-section">
          <h3>Allgemeine Geschäftsbedingungen (AGB)</h3>
          <div class="prose py-4" v-html="agbTextHtml" />
        </div>
        
        <div v-if="dataProtectionTextHtml" class="agreement-section">
          <h3>Datenschutzerklärung</h3>
          <div class="prose py-4" v-html="dataProtectionTextHtml" />
        </div>
        
        <div v-if="newsletterTextHtml" class="agreement-section">
          <h3>Newsletter</h3>
          <div class="prose py-4" v-html="newsletterTextHtml" />
        </div>
        
        <div class="checkbox-section">
          <v-checkbox 
            label="Ich akzeptiere die AGB" 
            v-model="agbChecked"
            :disabled="hasAccepted"
            class="required-checkbox"
          />
          <v-checkbox 
            label="Ich akzeptiere die Datenschutzerklärung" 
            v-model="dataProtectionChecked"
            :disabled="hasAccepted"
            class="required-checkbox"
          />
          <v-checkbox 
            :label="$t('subscribe_to_newsletter')" 
            v-model="newsletterChecked"
            :disabled="hasAccepted"
            class="newsletter-checkbox"
          />
        </div>
      </div>
      
      <v-notice v-else type="success">
        {{ $t('consent_accepted_message') }}
      </v-notice>
    </div>
  </private-view>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();

export default {
  setup() {
    const api = useApi();
    const hasAccepted = ref(false);
    const agbChecked = ref(false);
    const dataProtectionChecked = ref(false);
    const newsletterChecked = ref(false);
    const loading = ref(true);
    const agbText = ref(null);
    const dataProtectionText = ref(null);
    const newsletterText = ref(null);
    const agbTextHtml = ref(null);
    const dataProtectionTextHtml = ref(null);
    const newsletterTextHtml = ref(null);
    const agbVersionId = ref(null);
    const dataProtectionVersionId = ref(null);
    const newsletterVersionId = ref(null);

    const fetchUserConsents = async () => {
      try {
        // Get the current user data
        const { data: { data: user } } = await api.get('/users/me');
        
        // Check if user has accepted agreements (both AGB and Datenschutz)
        const { data: { data: consents } } = await api.get('/items/user_consent', {
          params: {
            filter: { 
              user_id: { _eq: user.id } 
            },
            limit: -1
          }
        });
        
        // User has accepted if they have consents for both AGB and Datenschutz
        hasAccepted.value = consents.some(c => c.consent_target === agbVersionId.value) &&
                            consents.some(c => c.consent_target === dataProtectionVersionId.value);
        
        if (hasAccepted.value) {
          agbChecked.value = true;
          dataProtectionChecked.value = true;
          // Check if user has newsletter consent
          const newsletterConsent = consents.find(c => c.consent_target === newsletterVersionId.value);
          newsletterChecked.value = !!newsletterConsent;
        }
      } catch (error) {
        console.error("Error fetching user consents:", error);
      }
    };

    const fetchCurrentAgreementVersions = async () => {
      try {
        // Get all current agreement versions
        const { data: { data: versions } } = await api.get('/items/agreement_versions', {
          params: {
            filter: { isCurrentVersion: { _eq: true } },
            limit: -1
          }
        });
        
        // Extract the current versions for each type
        versions.forEach(version => {
          const html = md.render(version.legal_text || '');
          switch (version.type) {
            case 'terms_of_service':
              agbText.value = version.legal_text;
              agbTextHtml.value = html;
              agbVersionId.value = version.id;
              break;
            case 'data_protection':
              dataProtectionText.value = version.legal_text;
              dataProtectionTextHtml.value = html;
              dataProtectionVersionId.value = version.id;
              break;
            case 'newsletter':
              newsletterText.value = version.legal_text;
              newsletterTextHtml.value = html;
              newsletterVersionId.value = version.id;
              break;
          }
        });
        
        return versions;
      } catch (error) {
        console.error("Error fetching agreement versions:", error);
      }
    };

    const acceptAgreements = async () => {
      try {
        // Get current user
        const { data: { data: user } } = await api.get('/users/me');
        
        // Create consent records for AGB and Datenschutz (required)
        const consentPromises = [];
        
        if (agbVersionId.value && agbChecked.value) {
          consentPromises.push(
            api.post('/items/user_consent', {
              user_id: user.id,
              consent_target: agbVersionId.value
            })
          );
        }
        
        if (dataProtectionVersionId.value && dataProtectionChecked.value) {
          consentPromises.push(
            api.post('/items/user_consent', {
              user_id: user.id,
              consent_target: dataProtectionVersionId.value
            })
          );
        }
        
        // Create consent for newsletter if checked
        if (newsletterChecked.value && newsletterVersionId.value) {
          consentPromises.push(
            api.post('/items/user_consent', {
              user_id: user.id,
              consent_target: newsletterVersionId.value
            })
          );
        }
        
        await Promise.all(consentPromises);
        
        hasAccepted.value = true;
        // Just show success message, no redirect
      } catch (error) {
        console.error("Error accepting agreements:", error);
        // Show error to user
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        alert('Fehler beim Akzeptieren: ' + errorMsg);
      }
    };

    onMounted(async () => {
      try {
        await fetchCurrentAgreementVersions();
        await fetchUserConsents();
        loading.value = false;
      } catch (error) {
        console.error("Error during data fetching:", error);
        loading.value = false;
      }
    });

    return {
      hasAccepted,
      agbChecked,
      dataProtectionChecked,
      newsletterChecked,
      acceptAgreements,
      loading,
      agbTextHtml,
      dataProtectionTextHtml,
      newsletterTextHtml
    };
  },
};
</script>

<style scoped>
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
</style>
