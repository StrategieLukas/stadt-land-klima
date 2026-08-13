<template>
  <section class="w-full px-4 py-10 sm:py-14 lg:py-16">
    <div class="mx-auto grid max-w-screen-lg items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
      <div class="max-w-2xl">
        <p class="mb-3 text-sm font-bold uppercase text-orange">
          {{ $t("donate.page.eyebrow") }}
        </p>
        <h1 class="font-heading text-3xl font-bold leading-tight text-gray dark:text-[var(--slk-text-strong)] sm:text-4xl">
          {{ $t("donate.page.title") }}
        </h1>
        <p class="mt-5 text-lg leading-8 text-gray-600 dark:text-[var(--slk-text)]">
          {{ $t("donate.page.description") }}
        </p>
        <div class="mt-7">
          <CanonicalButton
            :label="$t('donate.page.open_betterplace')"
            :href="BETTERPLACE_PROJECT_URL"
            icon-slug="icon_hand_holding_heart"
            color="orange"
            :external="true"
          />
        </div>
      </div>

      <BetterplaceDonationWidget />
    </div>
  </section>
</template>

<script setup lang="ts">
import { BETTERPLACE_PROJECT_URL } from "~/shared/donation";

const { $t } = useNuxtApp();

useHead({
  title: $t("donate.page.title"),
  meta: [
    {
      name: "description",
      content: $t("donate.page.description"),
    },
  ],
});
</script>
