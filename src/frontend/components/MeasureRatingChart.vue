<template>
  <div class="border-t-2 border-light-blue py-6">
    <h2 class="font-heading text-h3 font-bold text-gray mb-4">Bewertung durch Kommunen</h2>

    <div v-if="!ratings || ratings.length === 0" class="text-gray-400 text-sm italic">
      Noch keine veröffentlichten Bewertungen für diese Maßnahme vorhanden.
    </div>

    <div v-else>
      <div class="space-y-2">
        <template v-for="group in ratingGroups" :key="group.key">
          <!-- Bar row -->
          <button
            class="w-full flex items-center gap-3 text-left rounded px-2 py-1.5 transition-colors"
            :class="group.count > 0 ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-40'"
            :disabled="group.count === 0"
            @click="group.count > 0 ? toggleGroup(group.key) : undefined"
          >
            <span class="flex items-center gap-2 w-44 flex-shrink-0">
              <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ background: group.color }" />
              <span class="text-xs font-semibold text-gray-700 truncate">{{ group.label }}</span>
            </span>
            <span class="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <span
                class="block h-full rounded transition-all duration-500"
                :style="{ width: `${(group.count / total) * 100}%`, background: group.color }"
              />
            </span>
            <span class="w-8 text-right text-xs font-bold text-gray-700 flex-shrink-0">{{ group.count }}</span>
            <svg
              v-if="group.count > 0"
              class="w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200"
              :class="{ 'rotate-180': openKey === group.key }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span v-else class="w-3.5 flex-shrink-0" />
          </button>

          <!-- Expanded municipality list -->
          <div
            v-if="openKey === group.key && group.municipalities.length"
            class="mx-2 mb-1 pl-4 border-l-2 py-1"
            :style="{ borderColor: group.color }"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5">
              <NuxtLink
                v-for="mun in group.municipalities"
                :key="mun.href"
                :to="mun.href"
                class="text-xs text-light-blue hover:underline truncate py-0.5 px-1"
              >
                {{ mun.name }} →
              </NuxtLink>
            </div>
          </div>
        </template>
      </div>

      <p class="text-xs text-gray-400 mt-3">
        {{ total }} Kommune{{ total !== 1 ? 'n haben' : ' hat' }} diese Maßnahme bewertet.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  ratings: { type: Array, default: () => [] },
  measureIdStr: { type: String, required: true },
  catalogVersionName: { type: String, required: true },
})

const RATING_CFG = [
  { key: '1',       label: 'Vollständig erfüllt', color: '#1da64a' },
  { key: '0.75',    label: 'Gut erfüllt',         color: '#8bc34a' },
  { key: '0.5',     label: 'Teilweise erfüllt',   color: '#fdd835' },
  { key: '0.25',    label: 'Kaum erfüllt',        color: '#f39200' },
  { key: '0',       label: 'Nicht erfüllt',       color: '#d32f2f' },
  { key: 'na',      label: 'Nicht anwendbar',     color: '#9e9e9e' },
  { key: 'unrated', label: 'Nicht bewertet',      color: '#b0bec5' },
]

const openKey = ref(null)

watch(() => props.measureIdStr, () => { openKey.value = null })

function toggleGroup(key) {
  openKey.value = openKey.value === key ? null : key
}

function getMunicipalityName(row) {
  return row.localteam_id?.municipality_name
    || row.localteam_id?.municipality_id?.[0]?.name
    || '–'
}

function getMunicipalityHref(row) {
  const mun = row.localteam_id?.municipality_id?.[0]
  if (!mun?.slug || mun?.status !== 'published') return null
  return `/municipalities/${mun.slug}?v=${props.catalogVersionName}#measure-${props.measureIdStr}`
}

const ratingGroups = computed(() => RATING_CFG.map(cfg => {
  let rows
  if (cfg.key === 'na') {
    rows = props.ratings.filter(r => r.applicable === false)
  } else if (cfg.key === 'unrated') {
    rows = props.ratings.filter(r => r.applicable !== false && r.rating == null)
  } else {
    rows = props.ratings.filter(r => r.applicable !== false && r.rating === cfg.key)
  }

  const municipalities = rows
    .map(r => ({ name: getMunicipalityName(r), href: getMunicipalityHref(r) }))
    .filter(m => m.href)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return { ...cfg, count: municipalities.length, municipalities }
}))

const total = computed(() => ratingGroups.value.reduce((s, g) => s + g.count, 0))
</script>
