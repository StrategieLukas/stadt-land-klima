<template>
  <!-- Social Media & Onboarding Section -->
  <div class="w-full bg-gray-100 border-t border-gray-200">
  <div class="max-w-screen-xl mx-auto text-center py-8">
    <NuxtLink v-if="shouldDisplayOnboardingLink" to="/mitmachen" class="flex justify-center">
      <img src="~/assets/icons/icon_klimachecker.svg" class="m-4 w-[270px]" :alt="$t('logo.alt')" />
    </NuxtLink>
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
  </div>

  <!-- Main Footer -->
  <footer class="footer-vertical footer bg-olive-green p-6 pb-[84px] text-white sm:pb-6">
    <!-- Newsletter Signup -->
    <div class="mb-6 w-full border-b border-rating-4-light pb-6">
      <h3 class="mb-0.5 text-base font-bold">Newsletter</h3>
      <p class="mb-3 text-sm text-rating-4-very-light">{{ $t("newsletter.footer.description") }}</p>
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
      <div v-else class="flex flex-col gap-2">
        <input
          v-model="footerEmail"
          type="email"
          autocomplete="email"
          :placeholder="$t('newsletter.email.placeholder')"
          class="placeholder-gray-600 w-full min-w-0 rounded-md px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-white"
          @keydown.enter.prevent="subscribeNewsletter"
        />
        <CanonicalButton
          :label="newsletterState === 'subscribing' ? '\u2026' : $t('newsletter.subscribe')"
          icon-slug="icon_newsletter_click"
          color="green"
          class="w-full flex-shrink-0"
          :disabled="newsletterState === 'subscribing'"
          @click="subscribeNewsletter"
        />
      </div>
      <p v-if="newsletterError" class="text-red-300 mt-1 text-xs">{{ newsletterError }}</p>
    </div>

    <!-- Navigation Links: footer_columns -->
    <div v-if="footerColumnsData.length > 0" class="mb-6 !block w-full">
      <div class="grid grid-cols-1 gap-4 xs:grid-cols-2 xs:gap-6">
        <nav v-for="col in footerColumnsData" :key="col.id" class="flex flex-col gap-2">
          <h6 class="footer-title mb-2 text-sm font-bold text-white opacity-100">
            {{ navTitle(col) }}
          </h6>
          <template v-for="link in col.links" :key="link.id">
            <NuxtLink v-if="link.link_type === 'page'" :to="'/' + link.page_slug" class="link-hover link text-sm">{{
              navLabel(link)
            }}</NuxtLink>
            <a
              v-else
              :href="link.external_url"
              :target="link.open_new_tab ? '_blank' : undefined"
              rel="noopener noreferrer"
              class="link-hover link text-sm"
              >{{ navLabel(link) }}</a
            >
          </template>
        </nav>
      </div>
    </div>

    <!-- Bottom Section: Logo, Buttons, Copyright -->
    <div class="flex w-full flex-col gap-6">
      <div
        class="flex w-full flex-col items-center gap-4 border-t border-rating-4-light py-6 xs:flex-row xs:justify-between md:border-t-0"
      >
        <!-- Logo -->
        <NuxtLink to="/" class="flex w-full justify-center xs:w-auto xs:justify-start">
          <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" class="h-12 w-auto dark:hidden" :alt="$t('logo.alt')" />
          <img
            src="~/assets/images/Stadt-Land-Klima-Logo-dark.svg"
            class="hidden h-12 w-auto dark:block"
            :alt="$t('logo.alt')"
          />
        </NuxtLink>

        <!-- Footer actions -->
        <div class="flex flex-col items-center gap-3 xs:flex-row">
          <LanguageSelector />
          <DonateButton />
          <LoginButton />
        </div>
      </div>

      <!-- Copyright + internal login -->
      <div class="w-full pb-4 text-center text-xs text-rating-4-very-light">
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

    <AuthLoginModal :isOpen="showLoginModal" @close="showLoginModal = false" @success="showLoginModal = false" />
  </footer>
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
const route = useRoute();
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

const footerColumnsData = computed(() =>
  Array.isArray(props.navItems) ? props.navItems.filter((col) => col && col.id && Array.isArray(col.links)) : [],
);

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

// Show onboarding link when not on home or mitmachen pages
const shouldDisplayOnboardingLink = computed(() => !(route.path === "/" || route.path.includes("mitmachen")));
</script>

<style scoped></style>
