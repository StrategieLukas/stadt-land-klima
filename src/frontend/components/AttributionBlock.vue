<template>
  <div v-if="hasContent" class="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
    <span v-if="attribution">
      Quelle:
      <a
        v-if="attributionUrl"
        :href="attributionUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="underline hover:text-gray-600"
      >{{ attribution }}</a>
      <span v-else>{{ attribution }}</span>
    </span>
    <span v-if="licenseName">
      Lizenz:
      <a
        v-if="licenseUrl"
        :href="licenseUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="underline hover:text-gray-600"
      >{{ licenseName }}</a>
      <span v-else>{{ licenseName }}</span>
    </span>
    <span v-if="effectiveDate">Stand: {{ formattedDate }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SummaryAggregate } from '~/types/slz-api'

const props = defineProps<{
  summary?: SummaryAggregate | null
}>()

const meta = computed(() => props.summary?.metadata ?? null)

const attribution    = computed(() => meta.value?.attribution ?? null)
const attributionUrl = computed(() => meta.value?.attribution_url ?? null)
const licenseName    = computed(() => meta.value?.license_name ?? null)
const licenseUrl     = computed(() => meta.value?.license_url ?? null)
const effectiveDate  = computed(() => meta.value?.effective_date ?? null)

const hasContent = computed(() =>
  !!(attribution.value || licenseName.value || effectiveDate.value)
)

const formattedDate = computed(() => {
  if (!effectiveDate.value) return ''
  try {
    return new Date(effectiveDate.value).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return effectiveDate.value
  }
})
</script>
