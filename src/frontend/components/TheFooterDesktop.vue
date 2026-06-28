<template>
  <!-- Social Media Section -->
  <div class="mx-auto mb-8 max-w-screen-xl text-center">
    <p class="mb-4">
      {{ $t("generic.social_media.support_by_sharing") }}
    </p>
    <div class="flex items-center justify-center gap-6">
      <a href="https://www.instagram.com/stadt.land.klima/" target="_blank" aria-label="Instagram">
        <img src="~/assets/icons/icon_instagram.svg" alt="Instagram" class="h-12 w-12" />
      </a>
      <a href="https://www.linkedin.com/company/stadt-land-klima/" target="_blank" aria-label="LinkedIn">
        <img src="~/assets/icons/icon_linkedin.svg" alt="LinkedIn" class="h-12 w-12" />
      </a>
    </div>
    <div class="mt-4 flex items-center justify-center gap-6">
      <a href="https://whatsapp.com/channel/0029Vb8RAti2v1Ix7Yz7OM0a" target="_blank" aria-label="WhatsApp">
        <img src="~/assets/icons/icon_whatsapp.svg" alt="WhatsApp" class="h-12 w-12" />
      </a>
      <a href="https://t.me/slkinfo" target="_blank" aria-label="Telegram">
        <img src="~/assets/icons/icon_telegram.svg" alt="Telegram" class="h-12 w-12" />
      </a>
      <a
        href="https://signal.group/#CjQKIPtaXcn_-6q29ufg9BBFvz0figXXqFc1H-1CddW5rkjUEhCWGjAx0p2QVVrDx4zlURBA"
        target="_blank"
        aria-label="Signal"
      >
        <img src="~/assets/icons/icon_signal.svg" alt="Signal" class="h-12 w-12" />
      </a>
    </div>
  </div>

  <!-- Main Footer -->
  <footer class="footer footer-center bg-olive-green px-4 py-10 text-white xl:px-10">
    <!-- Newsletter Signup -->
    <div class="mx-auto mb-8 w-full max-w-screen-xl border-b border-rating-4-light pb-8">
      <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-10">
        <div class="max-w-xs flex-shrink-0">
          <h3 class="text-lg font-bold">Newsletter</h3>
          <p class="mt-0.5 text-sm text-rating-4-very-light">{{ $t("newsletter.footer.description") }}</p>
        </div>
        <div class="min-w-0 flex-1">
          <div v-if="newsletterState === 'success'" class="flex items-center gap-2 text-sm font-medium">
            <svg class="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            {{ newsletterAlreadySubscribed ? $t("newsletter.already_subscribed") : $t("newsletter.confirmation_sent") }}
          </div>
          <div v-else class="flex gap-2">
            <input
              v-model="footerEmail"
              type="email"
              autocomplete="email"
              :placeholder="$t('newsletter.email.placeholder')"
              class="placeholder-gray-600 min-w-0 flex-1 rounded-md px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-white"
              @keydown.enter.prevent="subscribeNewsletter"
            />
            <CanonicalButton
              :label="newsletterState === 'subscribing' ? '\u2026' : $t('newsletter.subscribe')"
              icon-slug="icon_newsletter_click"
              color="green"
              :disabled="newsletterState === 'subscribing'"
              @click="subscribeNewsletter"
            />
          </div>
          <p v-if="newsletterError" class="text-red-300 mt-1 text-xs">{{ newsletterError }}</p>
        </div>
      </div>
    </div>

    <!-- Navigation Links: footer_columns (from navigation_config) -->
    <div v-if="footerColumnsData.length > 0" class="mx-auto mb-8 w-full max-w-screen-xl">
      <div
        class="grid w-full gap-8"
        :style="{ gridTemplateColumns: `repeat(${footerColumnsData.length}, minmax(0, 1fr))` }"
      >
        <nav
          v-for="(col, index) in footerColumnsData"
          :key="col.id"
          :class="['flex flex-col gap-2 text-left', index !== 0 ? 'border-l border-rating-4-light pl-6' : '']"
        >
          <h6 class="footer-title mb-2 flex min-h-[3rem] items-start font-bold text-white opacity-100">
            {{ navTitle(col) }}
          </h6>
          <template v-for="link in col.links" :key="link.id">
            <NuxtLink v-if="link.link_type === 'page'" :to="'/' + link.page_slug" class="link-hover link text-base">{{
              navLabel(link)
            }}</NuxtLink>
            <a
              v-else
              :href="link.external_url"
              :target="link.open_new_tab ? '_blank' : undefined"
              rel="noopener noreferrer"
              class="link-hover link text-base"
              >{{ navLabel(link) }}</a
            >
          </template>
        </nav>
      </div>
    </div>

    <!-- Bottom Section: Logo, Buttons, Copyright -->
    <div class="mx-auto w-full max-w-screen-xl border-t border-rating-4-light py-8">
      <div class="flex w-full flex-col items-center justify-between gap-6 lg:flex-row">
        <!-- Logo -->
        <div class="flex-shrink-0">
          <NuxtLink to="/">
            <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" class="h-24 w-auto" :alt="$t('logo.alt')" />
          </NuxtLink>
        </div>

        <!-- Buttons: Language + Donate + Login -->
        <div class="flex flex-col items-center gap-4 sm:flex-row">
          <LanguageSelector />
          <DonateButton />
          <LoginButton />
        </div>

        <!-- Copyright + internal login -->
        <div class="text-center text-sm text-rating-4-very-light">
          <div>{{ $t("footer.copyright") }}</div>
          <button
            v-if="!isAuthenticated"
            class="mt-1 text-xs text-rating-4-light transition-colors hover:text-white"
            @click="showLoginModal = true"
          >
            {{ $t("auth.internal_login") }}
          </button>
          <div v-else class="mt-1 flex items-center justify-center gap-2 text-xs text-rating-4-very-light">
            <span>{{ $t("auth.logged_in_as", { ":name": userName }) }}</span>
            <span aria-hidden="true">·</span>
            <button class="transition-colors hover:text-white" @click="handleLogout">{{ $t("auth.logout") }}</button>
          </div>
        </div>
      </div>
    </div>
  </footer>

  <AuthLoginModal :isOpen="showLoginModal" @close="showLoginModal = false" @success="showLoginModal = false" />
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import DonateButton from "~/components/DonateButton.vue";
import LanguageSelector from "~/components/LanguageSelector.vue";
import LoginButton from "~/components/LoginButton.vue";
import AuthLoginModal from "~/components/AuthLoginModal.vue";
import { useAuth } from "~/composables/useAuth";
import translatedNavigationLabel from "~/shared/translatedNavigationLabel.js";

const { $t } = useNuxtApp();
const { isAuthenticated, user, logout, initialize } = useAuth();
const showLoginModal = ref(false);
const navLabel = (item) => translatedNavigationLabel(item, $t);
const navTitle = (item) => translatedNavigationLabel(item, $t, "title");

const props = defineProps({
  navItems: {
    type: Array,
    default: () => [],
  },
});

// Newsletter signup state
const footerEmail = ref("");
const newsletterState = ref("idle");
const newsletterAlreadySubscribed = ref(false);
const newsletterError = ref("");

async function subscribeNewsletter() {
  newsletterError.value = "";
  if (!footerEmail.value.trim()) {
    newsletterError.value = $t("newsletter.email.required");
    return;
  }
  newsletterState.value = "subscribing";
  try {
    const result = await $fetch("/api/newsletter-subscribe", {
      method: "POST",
      body: { email: footerEmail.value.trim() },
    });
    newsletterAlreadySubscribed.value = result.alreadySubscribed;
    newsletterState.value = "success";
  } catch (err) {
    newsletterState.value = "idle";
    newsletterError.value = err?.data?.message ?? $t("newsletter.subscribe_failed");
  }
}

// Validated footer_columns data — each column must have an id, title, and links array
const footerColumnsData = computed(() => {
  if (!Array.isArray(props.navItems) || props.navItems.length === 0) return [];
  return props.navItems.filter((col) => col && col.id && Array.isArray(col.links));
});

const userName = computed(() => {
  if (!user.value) return "";
  return user.value.first_name ? `${user.value.first_name} ${user.value.last_name || ""}`.trim() : user.value.email;
});

async function handleLogout() {
  await logout();
}

onMounted(() => {
  initialize();
});
</script>

<style scoped></style>
