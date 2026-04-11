<template>
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
  <footer class="footer footer-vertical bg-olive-green text-white p-6 pb-[84px] sm:pb-6">
    <!-- Navigation Links: footer_columns -->
    <div v-if="footerColumnsData.length > 0" class="!block w-full mb-6">
      <div class="grid grid-cols-2 gap-6">
        <nav
          v-for="col in footerColumnsData"
          :key="col.id"
          class="flex flex-col gap-2"
        >
          <h6 class="footer-title opacity-100 text-white font-bold mb-2 text-sm">
            {{ col.title }}
          </h6>
          <template v-for="link in col.links" :key="link.id">
            <NuxtLink
              v-if="link.link_type === 'page'"
              :to="'/' + link.page_slug"
              class="link link-hover text-sm"
            >{{ link.label }}</NuxtLink>
            <a
              v-else
              :href="link.external_url"
              :target="link.open_new_tab ? '_blank' : undefined"
              rel="noopener noreferrer"
              class="link link-hover text-sm"
            >{{ link.label }}</a>
          </template>
        </nav>
      </div>
    </div>

    <!-- Bottom Section: Logo, Buttons, Copyright -->
    <div class="w-full flex flex-col gap-6">
      <div class="w-full py-6 border-t border-white/30 md:border-t-0 flex flex-row items-center justify-between gap-4">
        <!-- Logo -->
        <NuxtLink to="/" class="flex-shrink-0">
          <img
            src="~/assets/images/Stadt-Land-Klima-Logo.svg"
            class="h-16 w-auto"
            :alt="$t('logo.alt')"
          />
        </NuxtLink>

        <!-- Backend login button (always visible) -->
        <div class="flex-shrink-0 flex items-center gap-3">
          <DonateButton />
          <a href="/backend">
            <button class="h-9 flex items-center justify-center px-4 py-2 text-sm font-bold bg-orange text-white space-x-1 rounded hover:brightness-110">
              <span>{{ $t('generic.log_in') }}</span>
              <span aria-hidden="true">→</span>
            </button>
          </a>
        </div>
      </div>

      <!-- Copyright + internal login -->
      <div class="w-full text-xs text-white/80 text-center pb-4">
        <div>{{ $t('footer.copyright') }}</div>
        <button
          v-if="!isAuthenticated"
          class="mt-1 text-xs text-white/40 hover:text-white/70 transition-colors"
          @click="showLoginModal = true"
        >Interner Login</button>
        <div v-else class="mt-1 text-xs text-white/60 flex items-center justify-center gap-2">
          <span>Eingeloggt als {{ userName }}</span>
          <span aria-hidden="true">·</span>
          <button class="hover:text-white transition-colors" @click="handleLogout">Ausloggen</button>
        </div>
      </div>
    </div>

    <AuthLoginModal :isOpen="showLoginModal" @close="showLoginModal = false" @success="showLoginModal = false" />
  </footer>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import DonateButton from '~/components/DonateButton.vue';
import AuthLoginModal from '~/components/AuthLoginModal.vue';
import { useAuth } from '~/composables/useAuth';

const { $t } = useNuxtApp();
const { isAuthenticated, user, logout, initialize } = useAuth();
const showLoginModal = ref(false);
const route = useRoute();

const props = defineProps({
  navItems: {
    type: Array,
    default: () => [],
  },
});

const footerColumnsData = computed(() =>
  Array.isArray(props.navItems)
    ? props.navItems.filter(col => col && col.id && Array.isArray(col.links))
    : []
);

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
</script>

<style scoped>
</style>
