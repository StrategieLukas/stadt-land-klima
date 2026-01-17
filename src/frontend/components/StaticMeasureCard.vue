<template>
  <article :id="`measure-${measure.measure_id}`" class="card card-compact shadow max-w-4xl mx-auto">
    <div class="card-body">
      <div 
        class="cursor-pointer flex items-center justify-between"
        @click="toggleExpanded"
      >
        <div class="flex-1">
          <div class="flex flex-row items-center gap-3">
            <span class="w-fit font-mono bg-custom-gray text-base-100 px-2 py-1 rounded-lg mr-3">{{ measure.measure_id }}</span>
            <h2 class="grow font-heading text-h2 font-bold text-custom-gray break-words">
              {{ measure.name }}
            </h2>
          </div>
        </div>
        <div class="ml-4 flex-shrink-0">
          <svg 
            :class="[
              'w-6 h-6 text-gray-500 transition-transform duration-200',
              isExpanded ? 'rotate-180' : ''
            ]"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div 
        v-show="isExpanded"
        class="divide-y-2 divide-light-blue md:px-1 lg:px-2 prose prose-sm max-w-none"
      >
        <StaticMeasureDetails :measure="measure" />

        <MeasureDescriptions :measure="measure" />

        <p class="text-center text-sm text-gray-600 pt-4">
          <ClientOnly>
            {{ $t("last_updated_at") + lastUpdatedAtStr }}
          </ClientOnly>
        </p>
      </div>
    </div>
  </article>
</template>
<script setup>
import { defineProps, ref, onMounted, onBeforeUnmount } from "vue";
const { $t, $locale } = useNuxtApp();

const props = defineProps({
  measure: {
    type: Object,
    required: true,
  },
});

const isExpanded = ref(false);
let lastUpdatedAtStr = ref("");

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const expandCard = () => {
  isExpanded.value = true;
};

// Listen for hash navigation
const handleHashNavigation = () => {
  const hash = window.location.hash.substring(1);
  if (hash === `measure-${props.measure.measure_id}`) {
    expandCard();
  }
};

onMounted(() => {
  // Handle initial hash navigation
  handleHashNavigation();
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleHashNavigation);
  
  // Handle date formatting
  if (props.measure.date_updated) {
    const lastUpdatedAt = new Date(props.measure.date_updated);
    if (!isNaN(lastUpdatedAt.getTime())) {
      lastUpdatedAtStr.value =
        lastUpdatedAt.toLocaleDateString($locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
        ", " +
        lastUpdatedAt.toLocaleTimeString($locale);
    } else {
      lastUpdatedAtStr.value = "Invalid date";
    }
  } else {
    lastUpdatedAtStr.value = "No update date available";
  }
});

// Cleanup
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', handleHashNavigation);
});
</script>
