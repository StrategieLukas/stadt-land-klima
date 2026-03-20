<template lang="">
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

  <footer class="bg-light-green px-2 py-4 text-black">
    <div class="mx-auto w-full max-w-screen-xl">

      <ul tabindex="0" class="menu min-h-full w-80 bg-light-green font-semibold text-left text-white">
        <li v-for="page in pages" :key="page.id" class="w-full">
          <NuxtLink
            :to="'/' + page.slug"
            class="text-md"
          >
            <span class="text-lg">→</span> {{ page.name }}
          </NuxtLink>
        </li>
      </ul>

    </div>

    <!-- Blökkli editor login -->
    <div class="mt-4 px-4">
      <button
        v-if="!isAuthenticated"
        @click="showLoginModal = true"
        class="w-full py-2 text-sm font-bold border border-black text-black hover:bg-black/10 transition-colors"
      >
        Interner Login
      </button>
      <div v-else class="flex items-center justify-between">
        <span class="text-sm">{{ userName }}</span>
        <button
          @click="handleLogout"
          class="py-2 px-4 text-sm font-bold border border-black text-black hover:bg-black/10 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>

    <AuthLoginModal :isOpen="showLoginModal" @close="showLoginModal = false" @success="showLoginModal = false" />
  </footer>
</template>
<script setup>
import { ref, computed } from 'vue';
import AuthLoginModal from '~/components/AuthLoginModal.vue';
import { useAuth } from '~/composables/useAuth';
const { $t } = useNuxtApp();
const { isAuthenticated, user, logout, initialize } = useAuth();
const showLoginModal = ref(false);

const userName = computed(() => {
  if (!user.value) return '';
  return user.value.first_name
    ? `${user.value.first_name} ${user.value.last_name || ''}`.trim()
    : user.value.email;
});

async function handleLogout() {
  await logout();
}

if (process.client) {
  initialize();
}

const props = defineProps(["pages"]);
const route = useRoute();
const shouldDisplayOnboardingLink = computed(() =>
  !(route.path === "/" || route.path.includes("mitmachen"))
);

</script>
<style lang="de"></style>
