<template>
  <span
    v-if="partyName"
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white shadow-sm"
    :style="{ backgroundColor: partyColor, color: textColor }"
  >
    {{ partyName }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { candidateParties, getCandidatePartyLabel } from '~/shared/candidateParties.js'

const props = defineProps({
  party: {
    type: String,
    required: true
  },
  state: {
    type: String,
    default: ''
  }
})

const partyName = computed(() => {
  return getCandidatePartyLabel(props.party, props.state)
})

const partyColor = computed(() => {
  if (candidateParties[props.party]) {
    return candidateParties[props.party].color
  }
  return '#cccccc' // Default for unknown/custom
})

const textColor = computed(() => {
  if (candidateParties[props.party]) {
    return candidateParties[props.party].textColor
  }
  return '#ffffff'
})
</script>
