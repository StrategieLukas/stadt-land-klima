<template>
  <private-view title="Landing Page">
    <template #actions>
      <v-button v-if="!accepted && checkboxChecked" @click="acceptTerms">
        <v-icon name="check" />
      </v-button>
    </template>
    <div v-if="loading">
      Loading...
    </div>
    <div v-else>
      <p>This is a static placeholder.</p>
      <article v-if="page && !accepted" class="prose py-8" v-html="page.contents" />
      <v-checkbox :label="$t('accept_terms_and_conditions')" v-if="!accepted" v-model="checkboxChecked"
        :disabled="accepted" />
    </div>


    <div>
      News etc.
    </div>
  </private-view>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';

export default {
  setup() {
    const api = useApi(); // Assuming you have an API setup for user data
    const accepted = ref(false);
    const checkboxChecked = ref(false);
    const loading = ref(true);
    const page = ref(null); // Store page data




    const fetchUserAcceptance = async () => {
      try {
        // Get the current user data
        const { data: { data: user } } = await api.get('/users/me');
        // console.log(user);
        accepted.value = Boolean(user.agb_accepted); // Check if terms are accepted
        checkboxChecked.value = accepted.value;
      } catch (error) {
        console.error("Error fetching user acceptance:", error);
      }
    };

    const fetchPagesWithSlug = async () => {
      try {
        // Directus SDK call to get pages with slug = 'datenschutz'
        const { data: { data: pagesWithSlug } } = await api.get('/items/pages', {
          params: {
            filter: { slug: { _eq: 'datenschutz' } },
            limit: 1, // Limit to 1 result
          },
        });
        // console.log(pagesWithSlug)
        page.value = pagesWithSlug[0] || null; // Get the first page or null
        // console.log(page)
      } catch (error) {
        console.error("Error fetching pages:", error);
      }
    };


    const acceptTerms = async () => {
      await api.patch('/users/me', {
        agb_accepted: true,
      });
      accepted.value = true;
      window.location.reload();
    };

    onMounted(async () => {
      try {
        // Wait for both data-fetching functions to complete
        await fetchUserAcceptance();

        // If the user has not accepted terms, fetch the pages
        if (!accepted.value) {
          await fetchPagesWithSlug();
        }

        // Set loading to false once the appropriate data is fetched
        loading.value = false;
      } catch (error) {
        console.error("Error during data fetching:", error);
      }
    });

    return {
      accepted,
      checkboxChecked,
      acceptTerms,
      loading,
      page, // Returning the page data to the template
    };
  },
};



</script>
