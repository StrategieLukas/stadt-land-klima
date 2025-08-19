<template>
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

  <footer class="bg-olive-green text-white px-4 pt-0 pb-20">
    <div class="mx-auto pt-8 border-t border-white/30">
      <div class="flex items-start gap-12">
        <!-- Logo on the far left -->
        <div class="flex-shrink-0 pl-2">
          <NuxtLink to="/">
            <img
              src="~/assets/images/Stadt-Land-Klima-Logo-Beta.svg"
              class="h-32 w-auto"
              :alt="$t('logo.alt')"
            />
          </NuxtLink>
        </div>

        <!-- 4 columns -->
        <div class="grid grid-cols-4 flex-grow gap-8 text-left text-lg w-full">
          <div
            v-for="col in 4"
            :key="'col-'+col"
            :class="[
              'space-y-3 pl-4',
              col !== 1 ? 'border-l border-white/30' : ''
            ]"
          >
            <div v-for="page in pagesByColumn[col]" :key="page.id">
              <NuxtLink :to="'/' + page.slug" class="hover:underline block">
                <span class="text-lg">→</span> {{ page.name }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Buttons: Donate + Login side by side -->
      <div class="mt-12 flex justify-center gap-6">
        <DonateButton />
        <a
          href="/backend"
          class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold bg-orange text-white hover:brightness-110"
        >
          {{ $t('generic.log_in') }} <span class="text-lg ml-1">→</span>
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { defineProps, computed } from "vue";
import DonateButton from '~/components/DonateButton.vue';
const { $t } = useNuxtApp();

const props = defineProps({
  pages: {
    type: Array,
    required: true
  }
});

const pagesByColumn = computed(() => {
  const columns = { 1: [], 2: [], 3: [], 4: [] };

  props.pages.forEach((page) => {
    const col = page.footer_column_desktop;
    if (!col) {
      console.warn(`Page "${page.name}" has no column defined`);
    } else if (!columns[col]) {
      console.warn(`Page "${page.name}" has an invalid column number: ${col}`);
    } else {
      columns[col].push(page);
    }
  });

  return columns;
});
</script>
