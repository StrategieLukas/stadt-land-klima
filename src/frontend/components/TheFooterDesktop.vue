<template>
  <!-- Social Media Section -->
  <div class="max-w-screen-xl mx-auto text-center mb-8">
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
  <footer class="footer footer-center bg-olive-green text-white p-10">
    <!-- Navigation Links: footer_columns (from navigation_config) -->
    <div v-if="footerColumnsData.length > 0" class="w-full max-w-screen-xl mx-auto mb-8">
      <div
        class="grid gap-8 w-full"
        :style="{ gridTemplateColumns: `repeat(${footerColumnsData.length}, minmax(0, 1fr))` }"
      >
        <nav
          v-for="(col, index) in footerColumnsData"
          :key="col.id"
          :class="[
            'flex flex-col gap-2 text-left',
            index !== 0 ? 'border-l border-white/30 pl-6' : ''
          ]"
        >
          <h6 class="footer-title opacity-100 text-white font-bold mb-2">
            {{ col.title }}
          </h6>
          <template v-for="link in col.links" :key="link.id">
            <NuxtLink
              v-if="link.link_type === 'page'"
              :to="'/' + link.page_slug"
              class="link link-hover text-base"
            >{{ link.label }}</NuxtLink>
            <a
              v-else
              :href="link.external_url"
              :target="link.open_new_tab ? '_blank' : undefined"
              rel="noopener noreferrer"
              class="link link-hover text-base"
            >{{ link.label }}</a>
          </template>
        </nav>
      </div>
    </div>

    <!-- Bottom Section: Logo, Buttons, Copyright -->
    <div class="w-full max-w-screen-xl mx-auto py-8 border-t border-white/30">
      <div class="flex flex-col md:flex-row items-center justify-between gap-6 w-full">
        <!-- Logo -->
        <div class="flex-shrink-0">
          <NuxtLink to="/">
            <img
              src="~/assets/images/Stadt-Land-Klima-Logo.svg"
              class="h-24 w-auto"
              :alt="$t('logo.alt')"
            />
          </NuxtLink>
        </div>

        <!-- Buttons: Donate + Login -->
        <div class="flex items-center gap-4">
          <DonateButton />
          <!-- Blökkli editor login -->
          <button
            v-if="!isAuthenticated"
            @click="showLoginModal = true"
            class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold border border-white text-white hover:bg-white/10 transition-colors"
          >
            Interner Login
          </button>
          <div v-else class="flex items-center gap-3">
            <span class="text-sm text-white/80">{{ userName }}</span>
            <button
              @click="handleLogout"
              class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold border border-white text-white hover:bg-white/10 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <!-- Copyright -->
        <div class="text-sm text-white/80">
          {{ $t('footer.copyright') }}
        </div>
      </div>
    </div>

    <AuthLoginModal :isOpen="showLoginModal" @close="showLoginModal = false" @success="showLoginModal = false" />
  </footer>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import DonateButton from '~/components/DonateButton.vue';
import AuthLoginModal from '~/components/AuthLoginModal.vue';
import { useAuth } from '~/composables/useAuth';

const { $t } = useNuxtApp();
const { isAuthenticated, user, logout, initialize } = useAuth();
const showLoginModal = ref(false);

const props = defineProps({
  navItems: {
    type: Array,
    default: () => []
  },
});

// Validated footer_columns data — each column must have an id, title, and links array
const footerColumnsData = computed(() => {
  if (!Array.isArray(props.navItems) || props.navItems.length === 0) return []
  return props.navItems.filter(col => col && col.id && Array.isArray(col.links))
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

</script>

<style scoped>
</style>
