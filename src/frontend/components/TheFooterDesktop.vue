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
  <footer class="footer footer-center bg-olive-green text-white py-10 px-4 xl:px-10">

    <!-- Newsletter Signup -->
    <div class="w-full max-w-screen-xl mx-auto mb-8 pb-8 border-b border-white/20">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-10">
        <div class="flex-shrink-0 max-w-xs">
          <h3 class="text-lg font-bold">Newsletter</h3>
          <p class="text-sm text-white/70 mt-0.5">Neuigkeiten zu Stadt.Land.Klima! direkt ins Postfach.</p>
        </div>
        <div class="flex-1 min-w-0">
          <div
            v-if="newsletterState === 'success'"
            class="flex items-center gap-2 text-sm font-medium"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            {{ newsletterAlreadySubscribed ? 'Du bist bereits angemeldet.' : 'Bestätigungsmail gesendet – bitte prüfe dein Postfach.' }}
          </div>
          <div v-else class="flex gap-2">
            <input
              v-model="footerEmail"
              type="email"
              autocomplete="email"
              placeholder="Deine E-Mail-Adresse"
              class="flex-1 min-w-0 px-3 py-2 text-sm rounded-md text-black placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white"
              @keydown.enter.prevent="subscribeNewsletter"
            />
            <button
              type="button"
              :disabled="newsletterState === 'subscribing'"
              class="px-4 py-2 bg-white text-olive-green text-sm font-semibold rounded-md hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              @click="subscribeNewsletter"
            >
              <span v-if="newsletterState === 'subscribing'">…</span>
              <span v-else>Anmelden</span>
            </button>
          </div>
          <p v-if="newsletterError" class="mt-1 text-xs text-red-300">{{ newsletterError }}</p>
        </div>
      </div>
    </div>

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
      <div class="flex flex-col lg:flex-row items-center justify-between gap-6 w-full">
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
          <!-- Backend login button (always visible) -->
          <a href="/backend">
            <button class="h-9 flex items-center justify-center px-4 py-2 text-sm font-bold bg-orange text-white space-x-1 rounded hover:brightness-110">
              <span>{{ $t('generic.log_in') }}</span>
              <span aria-hidden="true">→</span>
            </button>
          </a>
        </div>

        <!-- Copyright + internal login -->
        <div class="text-sm text-white/80 text-center">
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
    </div>

  </footer>

  <AuthLoginModal :isOpen="showLoginModal" @close="showLoginModal = false" @success="showLoginModal = false" />
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

// Newsletter signup state
const footerEmail = ref('');
const newsletterState = ref('idle');
const newsletterAlreadySubscribed = ref(false);
const newsletterError = ref('');

async function subscribeNewsletter() {
  newsletterError.value = '';
  if (!footerEmail.value.trim()) {
    newsletterError.value = 'Bitte gib deine E-Mail-Adresse ein.';
    return;
  }
  newsletterState.value = 'subscribing';
  try {
    const result = await $fetch('/api/newsletter-subscribe', {
      method: 'POST',
      body: { email: footerEmail.value.trim() },
    });
    newsletterAlreadySubscribed.value = result.alreadySubscribed;
    newsletterState.value = 'success';
  } catch (err) {
    newsletterState.value = 'idle';
    newsletterError.value = err?.data?.message ?? 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
  }
}

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
