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

    <!-- Bottom Section: Logo, Buttons, Copyright -->
    <div class="w-full flex flex-col gap-6">
      <div class="w-full py-6 border-t border-white/30 flex flex-row items-center justify-between gap-4">
        <!-- Logo -->
        <NuxtLink to="/" class="flex-shrink-0">
          <img
            src="~/assets/images/Stadt-Land-Klima-Logo.svg"
            class="h-16 w-auto"
            :alt="$t('logo.alt')"
          />
        </NuxtLink>

        <!-- Blökkli editor login -->
        <div class="flex-shrink-0">
          <button
            v-if="!isAuthenticated"
            @click="showLoginModal = true"
            class="py-2 px-3 text-sm font-bold border border-white text-white hover:bg-white/10 transition-colors"
          >
            Interner Login
          </button>
          <div v-else class="flex items-center gap-2">
            <span class="text-sm text-white/80">{{ userName }}</span>
            <button
              @click="handleLogout"
              class="py-2 px-3 text-sm font-bold border border-white text-white hover:bg-white/10 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <!-- Copyright -->
      <div class="w-full text-xs text-white/80 text-center pb-4">
        {{ $t('footer.copyright') }}
      </div>
    </div>

    <AuthLoginModal :isOpen="showLoginModal" @close="showLoginModal = false" @success="showLoginModal = false" />
  </footer>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AuthLoginModal from '~/components/AuthLoginModal.vue';
import { useAuth } from '~/composables/useAuth';

const { $t } = useNuxtApp();
const { isAuthenticated, user, logout, initialize } = useAuth();
const showLoginModal = ref(false);
const route = useRoute();

const props = defineProps({
  pages: {
    type: Array,
    required: true
  }
});

const userName = computed(() => {
  if (!user.value) return '';
  return user.value.first_name
    ? `${user.value.first_name} ${user.value.last_name || ''}`.trim()
    : user.value.email;
});

async function handleLogout() {
  await logout();
}

onMounted(() => {
  initialize();
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
</script>

<style scoped>
/* Ensure collapse content doesn't overflow */
.collapse-content {
  padding-left: 1rem;
  padding-right: 1rem;
}
</style>
