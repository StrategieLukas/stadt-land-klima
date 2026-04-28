<template>
  <private-view title="Consent Management">
    <template #actions>
      <v-button v-if="!hasAccepted && checkboxChecked" @click="acceptAgreements">
        <v-icon name="check" />
      </v-button>
    </template>
    <div v-if="loading">
      Loading...
    </div>
    <div v-else>
      <v-notice v-if="!hasAccepted" type="warning" title="Required Agreements">
        Please review and accept the following agreements to access the platform:
      </v-notice>
      
      <div v-if="!hasAccepted" class="agreements-container">
        <div class="agreement-section">
          <h3>Terms of Service (AGB)</h3>
          <article v-if="agbPage" class="prose py-4" v-html="agbPage.contents" />
        </div>
        
        <div class="agreement-section">
          <h3>Data Protection Agreement</h3>
          <article v-if="dataProtectionPage" class="prose py-4" v-html="dataProtectionPage.contents" />
        </div>
        
        <div class="checkbox-section">
          <v-checkbox 
            :label="$t('accept_terms_and_conditions')" 
            v-model="checkboxChecked"
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
      
      <v-notice v-else type="success" title="Agreements Accepted">
        Thank you for accepting the agreements. You can now access the platform.
      </v-notice>
    </div>
  </private-view>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';

export default {
  setup() {
    const api = useApi();
    const hasAccepted = ref(false);
    const checkboxChecked = ref(false);
    const newsletterChecked = ref(false);
    const loading = ref(true);
    const agbPage = ref(null);
    const dataProtectionPage = ref(null);

    const fetchUserAgreements = async () => {
      try {
        // Get the current user data
        const { data: { data: user } } = await api.get('/users/me');
        
        // Check if user has accepted agreements
        const { data: { data: agreements } } = await api.get('/items/user_agreements', {
          params: {
            filter: { user_id: { _eq: user.id } },
            limit: 1
          }
        });
        
        hasAccepted.value = agreements.length > 0;
        
        if (hasAccepted.value) {
          checkboxChecked.value = true;
          newsletterChecked.value = agreements[0].newsletter_subscribed || false;
        }
      } catch (error) {
        console.error("Error fetching user agreements:", error);
      }
    };

    const fetchAgreementPages = async () => {
      try {
        // Get AGB page
        const { data: { data: agbPages } } = await api.get('/items/pages', {
          params: {
            filter: { slug: { _eq: 'agb' } },
            limit: 1
          }
        });
        agbPage.value = agbPages[0] || null;
        
        // Get Data Protection page
        const { data: { data: dpPages } } = await api.get('/items/pages', {
          params: {
            filter: { slug: { _eq: 'datenschutz' } },
            limit: 1
          }
        });
        dataProtectionPage.value = dpPages[0] || null;
      } catch (error) {
        console.error("Error fetching agreement pages:", error);
      }
    };

    const acceptAgreements = async () => {
      try {
        // Get current user
        const { data: { data: user } } = await api.get('/users/me');
        
        // Get current agreement versions
        const { data: { data: versions } } = await api.get('/items/agreement_versions', {
          params: { limit: 1 }
        });
        
        const currentVersions = versions[0];
        
        const agreementData = {
          user_id: user.id,
          agb_version: currentVersions.current_agb_version,
          agb_accepted_at: new Date().toISOString(),
          data_protection_version: currentVersions.current_data_protection_version,
          data_protection_accepted_at: new Date().toISOString(),
          newsletter_subscribed: newsletterChecked.value,
          newsletter_subscribed_at: newsletterChecked.value ? new Date().toISOString() : null
        };
        
        // Create or update agreement
        const existingAgreements = await api.get('/items/user_agreements', {
          params: {
            filter: { user_id: { _eq: user.id } },
            limit: 1
          }
        });
        
        if (existingAgreements.data.data.length > 0) {
          // Update existing agreement
          await api.patch(`/items/user_agreements/${existingAgreements.data.data[0].id}`, agreementData);
        } else {
          // Create new agreement
          await api.post('/items/user_agreements', agreementData);
        }
        
        hasAccepted.value = true;
        window.location.reload();
      } catch (error) {
        console.error("Error accepting agreements:", error);
      }
    };

    onMounted(async () => {
      try {
        await Promise.all([
          fetchUserAgreements(),
          fetchAgreementPages()
        ]);
        loading.value = false;
      } catch (error) {
        console.error("Error during data fetching:", error);
        loading.value = false;
      }
    });

    return {
      hasAccepted,
      checkboxChecked,
      newsletterChecked,
      acceptAgreements,
      loading,
      agbPage,
      dataProtectionPage
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