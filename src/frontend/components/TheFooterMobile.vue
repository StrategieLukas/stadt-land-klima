<template lang="">
  <!-- Social Media & Onboarding Section -->
  <div class="max-w-screen-xl mx-auto text-center mb-8">
    <NuxtLink v-if="shouldDisplayOnboardingLink" to="/mitmachen" class="flex justify-center">
      <img src="~/assets/icons/icon_klimachecker.svg" class="m-4 w-[270px]" :alt="$t('logo.alt')" />
    </NuxtLink>
    <p class="mb-4">
      {{ $t('generic.social_media.support_by_sharing') }}
    </p>
    <div class="flex justify-center items-center gap-6">
      <a href="https://www.instagram.com/stadt.land.klima/" target="_blank" aria-label="Instagram">
        <img src="~/assets/icons/icon_instagram.svg" alt="Instagram" class="h-12 w-12" />
      </a>
      <a href="https://www.linkedin.com/company/stadt-land-klima/" target="_blank" aria-label="LinkedIn">
        <img src="~/assets/icons/icon_linkedin.svg" alt="LinkedIn" class="h-12 w-12" />
      </a>
    </div>
  </div>

  <!-- Main Footer -->
  <footer class="footer footer-vertical bg-olive-green text-white p-6">
    <!-- Navigation Links by Category (Grid Layout) -->
    <div v-if="activeCategories.length > 0" class="w-full mb-6">
      <div class="grid grid-cols-2 gap-6">
        <nav 
          v-for="category in activeCategories" 
          :key="category.key"
          class="flex flex-col gap-2"
        >
          <h6 class="footer-title opacity-100 text-white font-bold mb-2 text-sm">
            {{ $t(`pages.page_category.${category.key}`) }}
          </h6>
          <NuxtLink 
            v-for="page in category.pages" 
            :key="page.id"
            :to="'/' + page.slug" 
            class="link link-hover text-sm"
          >
            {{ page.name }}
          </NuxtLink>
        </nav>
      </div>
    </div>

    <!-- Newsletter and Logo Section Container -->
    <div class="w-full flex flex-col gap-6">
      <!-- Newsletter Section -->
      <div v-if="isNewsletterConfigured" class="w-full pb-6 border-t border-white/30 pt-6">
        <form @submit.prevent="handleNewsletterSubmit" class="flex flex-col gap-3">
          <h6 class="footer-title opacity-100 text-white font-bold text-center">
            {{ $t('footer.newsletter.title') }}
          </h6>
          <input 
            v-model="newsletterEmail"
            type="email" 
            :placeholder="$t('footer.newsletter.placeholder')"
            class="input input-bordered w-full bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:border-white"
            :disabled="newsletterState.isLoading"
          />
          <button 
            type="submit"
            class="btn bg-orange border-orange text-white hover:brightness-110 w-full"
            :disabled="newsletterState.isLoading"
          >
            <span v-if="newsletterState.isLoading" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ $t('footer.newsletter.subscribe') }}</span>
          </button>
          <!-- Success/Error Messages -->
          <p v-if="newsletterState.isSuccess" class="text-green-300 text-sm text-center">
            {{ $t('footer.newsletter.success') }}
          </p>
          <p v-else-if="newsletterState.error" class="text-red-300 text-sm text-center">
            {{ newsletterState.error === 'invalid_email' 
              ? $t('footer.newsletter.invalid_email') 
              : $t('footer.newsletter.error') 
            }}
          </p>
        </form>
      </div>

      <!-- Bottom Section: Logo, Buttons, Copyright -->
      <div class="w-full py-6 border-t border-white/30 flex flex-row items-center justify-between gap-4">
      <!-- Logo -->
      <NuxtLink to="/" class="flex-shrink-0">
        <img
          src="~/assets/images/Stadt-Land-Klima-Logo.svg"
          class="h-16 w-auto"
          :alt="$t('logo.alt')"
        />
      </NuxtLink>

      <!-- Buttons: Donate + Login -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <DonateButton />
        <AuthUserMenu variant="footer" />
      </div>
      </div>

      <!-- Copyright -->
      <div class="w-full text-xs text-white/80 text-center pb-4">
        {{ $t('footer.copyright') }}
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed, ref } from "vue";
import DonateButton from '~/components/DonateButton.vue';
import { useListmonk } from '~/composables/useListmonk';

const { $t } = useNuxtApp();
const route = useRoute();
const config = useRuntimeConfig();
const { state: newsletterState, subscribe: subscribeNewsletter, reset: resetNewsletter } = useListmonk();

const props = defineProps({
  pages: {
    type: Array,
    required: true
  }
});

// Newsletter form state
const newsletterEmail = ref('');

// Check if newsletter is configured
const isNewsletterConfigured = computed(() => {
  return !!config.public.listmonkEndpoint;
});

// Show onboarding link when not on home or mitmachen pages
const shouldDisplayOnboardingLink = computed(() =>
  !(route.path === "/" || route.path.includes("mitmachen"))
);

// Define the category order
const categoryOrder = [
  'municipality_rating',
  'outreach_and_network', 
  'information_and_participate',
  'structures_and_legal'
];

// Group pages by category, only including categories that have pages
const activeCategories = computed(() => {
  if (!props.pages || !Array.isArray(props.pages)) {
    return [];
  }
  
  const categoriesWithPages = [];
  
  categoryOrder.forEach((categoryKey) => {
    const pagesInCategory = props.pages.filter(
      (page) => page && page.page_category === categoryKey
    );
    
    if (pagesInCategory.length > 0) {
      categoriesWithPages.push({
        key: categoryKey,
        pages: pagesInCategory
      });
    }
  });
  
  return categoriesWithPages;
});

// Handle newsletter form submission
async function handleNewsletterSubmit() {
  if (!newsletterEmail.value) return;
  
  const result = await subscribeNewsletter(newsletterEmail.value);
  
  if (result.success) {
    newsletterEmail.value = '';
    // Reset success message after 5 seconds
    setTimeout(() => {
      resetNewsletter();
    }, 5000);
  }
}
</script>

<style scoped>
/* Ensure collapse content doesn't overflow */
.collapse-content {
  padding-left: 1rem;
  padding-right: 1rem;
}
</style>
