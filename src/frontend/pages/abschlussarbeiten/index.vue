<template>
  <div class="max-w-4xl py-8">
    <header class="mb-8">
      <h1 class="mb-4 font-heading text-4xl font-black text-stats-dark sm:text-6xl">{{ $t("theses.title") }}</h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t("theses.intro") }}</p>
    </header>

    <div v-if="data?.topics.length" class="slk-filter-panel slk-filter-theme-blue mb-6 space-y-4">
      <fieldset class="min-w-0">
        <legend class="mb-2 text-sm font-semibold">{{ $t("theses.categories") }}</legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="category in ThesisCategorySchema.options"
            :key="category"
            type="button"
            class="slk-filter-pill max-w-full text-left whitespace-normal!"
            :class="{ 'slk-filter-pill--active': selectedCategories.includes(category) }"
            :aria-pressed="selectedCategories.includes(category)"
            @click="toggleCategory(category)"
          >
            {{ $t(`theses.category.${category}`) }}
          </button>
        </div>
      </fieldset>
      <div>
        <label for="thesis-level" class="mb-2 block text-sm font-semibold">{{ $t("theses.levels") }}</label>
        <select
          id="thesis-level"
          v-model="selectedLevel"
          class="select w-full max-w-56 border-(--slk-border) bg-(--slk-surface) text-(--slk-text) focus-visible:outline-(--slk-filter-accent)"
        >
          <option value="">{{ $t("theses.all_levels") }}</option>
          <option v-for="level in ThesisLevelSchema.options" :key="level" :value="level">
            {{ $t(`theses.level.${level}`) }}
          </option>
        </select>
      </div>
    </div>

    <p v-if="!data && status === 'pending'" role="status">{{ $t("generic.loading") }}</p>
    <p v-else-if="!data && error" class="slk-badge slk-badge--warning alert" role="status">
      {{ $t("generic.loading_error") }}
    </p>
    <p v-else-if="!data?.topics.length" role="status">{{ $t("theses.empty") }}</p>
    <p v-else-if="!visibleTopics.length" role="status">{{ $t("theses.no_matches") }}</p>

    <ul v-if="visibleTopics.length" class="space-y-3">
      <li v-for="topic in visibleTopics" :key="topic.id">
        <details class="group border border-(--slk-border) bg-(--slk-surface)">
          <summary
            class="flex cursor-pointer list-none items-start justify-between gap-3 p-4 text-(--slk-text-strong) -outline-offset-2 hover:bg-(--slk-surface-subdued) focus-visible:outline-2 focus-visible:outline-(--slk-blue) sm:p-5 [&::-webkit-details-marker]:hidden"
          >
            <span class="min-w-0">
              <span class="block font-heading text-2xl font-bold wrap-anywhere">{{ topic.title }}</span>
              <span
                v-if="topic.short_description"
                class="mt-2 block text-sm leading-relaxed wrap-anywhere text-(--slk-text)"
              >
                {{ topic.short_description }}
              </span>
              <span class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="category in topic.categories"
                  :key="category"
                  class="slk-badge slk-badge--info rounded-full px-2.5 py-1 text-xs font-semibold wrap-anywhere"
                >
                  {{ $t(`theses.category.${category}`) }}
                </span>
              </span>
            </span>
            <span
              aria-hidden="true"
              class="mt-2 mr-1 size-3 shrink-0 rotate-45 border-r-2 border-b-2 group-open:mt-3 group-open:-rotate-135"
            />
          </summary>
          <div class="border-t border-(--slk-border) p-4 sm:p-5">
            <div class="prose max-w-none wrap-anywhere" v-html="sanitizeHtml(markdown.render(topic.description))" />
            <div class="mt-5 border-t border-(--slk-border) pt-5">
              <dl class="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <dt class="font-semibold">{{ $t("theses.levels") }}</dt>
                <dd class="text-(--slk-text-muted)">
                  {{ topic.levels.map((level) => $t(`theses.level.${level}`)).join(" · ") }}
                </dd>
              </dl>
              <p class="mb-3">{{ $t("theses.contact") }}</p>
              <CanonicalButton
                :href="thesisContactLink(topic.title)"
                :label="$t('theses.contact_action')"
                color="blue"
                variant="outline"
                icon-slug="mdi:email-outline"
              />
            </div>
          </div>
        </details>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { computed, ref } from "vue";
import {
  ThesisCategorySchema,
  ThesisLevelSchema,
  type ThesisCategory,
  type ThesisLevel,
} from "~/shared/contracts/thesisTopics";
import { sanitizeHtml } from "~/utils/sanitizeHtml";

const { $t } = useNuxtApp();
usePageSeo({ title: $t("theses.title"), description: $t("theses.intro") });

const router = useRouter();
const markdown = new MarkdownIt({ html: false, linkify: true });
const { data, error, status } = await useFetch("/api/public/thesis-topics");
const selectedCategories = ref<ThesisCategory[]>([]);
const selectedLevel = ref<ThesisLevel | "">("");

function thesisContactLink(title: string) {
  return router.resolve({ path: "/contact", query: { type: "thesis", title } }).href;
}

function toggleCategory(category: ThesisCategory) {
  selectedCategories.value = selectedCategories.value.includes(category)
    ? selectedCategories.value.filter((selected) => selected !== category)
    : [...selectedCategories.value, category];
}

const visibleTopics = computed(() =>
  (data.value?.topics ?? []).filter(
    ({ categories, levels }) =>
      (!selectedCategories.value.length ||
        selectedCategories.value.some((category) => categories.includes(category))) &&
      (!selectedLevel.value || levels.includes(selectedLevel.value)),
  ),
);
</script>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .slk-filter-pill {
    transition: none;
  }
}
</style>
