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

const parties = {
  parteilos: { label: 'parteilos', color: '#9ca3af', textColor: '#ffffff' },
  Union: { label: 'CDU', color: '#000000', textColor: '#ffffff' }, // Logic for CSU below
  AfD: { label: 'AfD', color: '#009ee0', textColor: '#ffffff' },
  SPD: { label: 'SPD', color: '#e3000f', textColor: '#ffffff' },
  Gruene: { label: 'Grüne', color: '#46962b', textColor: '#ffffff' },
  Linke: { label: 'Die Linke', color: '#be3075', textColor: '#ffffff' },
  BSW: { label: 'BSW', color: '#7b2e5a', textColor: '#ffffff' },
  FDP: { label: 'FDP', color: '#ffed00', textColor: '#000000' },
  Volt: { label: 'Volt', color: '#502379', textColor: '#ffffff' },
  PARTEI: { label: 'Die PARTEI', color: '#b5152b', textColor: '#ffffff' },
  FW: { label: 'Freie Wähler', color: '#f5a300', textColor: '#ffffff' },
  Oedp: { label: 'ÖDP', color: '#f29400', textColor: '#ffffff' },
  Piraten: { label: 'Piraten', color: '#ff8800', textColor: '#ffffff' },
  Klimaliste: { label: 'Klimaliste', color: '#00a09a', textColor: '#ffffff' },
  Tierschutzpartei: { label: 'Tierschutzpartei', color: '#00645c', textColor: '#ffffff' },
  Sonstige: { label: 'Sonstige', color: '#cccccc', textColor: '#ffffff' }
}

const partyName = computed(() => {
  if (!props.party) return ''

  // Custom party logic
  if (props.party === 'Union') {
    return props.state === 'Bayern' ? 'CSU' : 'CDU'
  }

  if (parties[props.party]) {
    return parties[props.party].label
  }

  return props.party // Return as is for custom entries
})

const partyColor = computed(() => {
  if (parties[props.party]) {
    return parties[props.party].color
  }
  return '#cccccc' // Default for unknown/custom
})

const textColor = computed(() => {
  if (parties[props.party]) {
    return parties[props.party].textColor
  }
  return '#ffffff'
})
</script>
