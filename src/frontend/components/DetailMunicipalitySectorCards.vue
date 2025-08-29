<template>
  <div
    v-for="(sectorRatings, sector) in sortedRatings"
    :key="sector"
    :name="`sector-${sector}`"
    class="collapse-plus collapse rounded-sm p-2 px-0 shadow-list md:px-2 mb-4"
  >
    <input 
      type="checkbox" 
      name="sectors-accordion" 
      autocomplete="off" 
      v-model="openSectors[sector]"
    />
    <div class="collapse-title flex items-start gap-4 px-2 md:px-4">
      <img :src="sectorImages[sector]" class="h-auto w-12 opacity-50 md:w-14 lg:w-18" />
      <div class="grow">
        <h2 class="mb-2 font-heading text-h2 leading-none text-green">
          {{ $t(`measure_sectors.${sector}.title`) }}
        </h2>
        <ProgressBar
          :score-total="Math.round(Number(municipality['score_' + sector]) * 10) / 10"
          layout="compact"
        />
      </div>
    </div>
    <div class="collapse-content px-2 md:px-4">
      <h3 class="mb-2 font-heading text-h2 text-black">
        {{ $t("measure_sector.measures_in_detail") }}
      </h3>
      <ul class="mb-2 flex items-end justify-center gap-4">
        <li
          v-for="(rating, _) in [0, 1, 2, 3, 4, null]"
          :key="`rating-image-${rating}`"
          class="flex flex-col items-center"
        >
          <img :src="ratingIcons[rating]" class="h-auto w-5" />
          <div class="text-sm">
            {{ $t(rating === null ? 'measure_rating.not_applicable_caption' : `measure_rating.${rating}_caption`) }}
          </div>
        </li>
      </ul>
      <ul class="mb-8 divide-y-2 divide-slate-300">
        <li v-for="item in sectorRatings" :key="item.id">
          <div class="collapse-plus collapse rounded-none" :name="`measure-${item.measure.measure_id}`">
            <input
              type="checkbox"
              :id="`rating-${item.id}-accordion`"
              v-model="openItems[item.measure.measure_id]"
              autocomplete="off"
            />

            <!-- Header -->
            <div
              :class="[
                `${ratingColor[ratingIndex(item.rating)]}-light`,
                'collapse-title flex items-center justify-stretch gap-3 p-3 px-2 pr-6 md:px-4'
              ]"
            >
              <div class="shrink-0">
                <img
                  :src="ratingIcons[ratingIndex(item.rating)]"
                  class="my-auto h-auto w-5"
                />
              </div>

              <h3 class="font-heading text-h3 text-black font-medium">
                {{ item.measure.name }}
              </h3>
            </div>

            <!-- Content (lazy loaded) -->
            <div
              :class="[
                  `${ratingColor[ratingIndex(item.rating)]}-very-light`,
                  'collapse-content md:px-12 lg:px-12'
                ]"
            >
              <!-- Mount only when collapse is opened -->
              <KeepAlive>
                <MeasureDetails
                  v-if="openItems[item.measure.measure_id]"
                  :measure_rating="item"
                  :municipality="municipality"
                />
              </KeepAlive>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import sectorImages from "../shared/sectorImages.js";
import ratingIcons, { ratingIndex } from "../shared/ratingIcons.js";
import { ratingColor } from "../shared/ratingColors.js";
import ProgressBar from '~/components/ProgressBar.vue'
import MeasureDetails from '~/components/MeasureDetails.vue'
import { reactive, computed, onMounted, nextTick, watch } from 'vue'

// Track which collapses are open
const openItems = reactive({})
const openSectors = reactive({})

const props = defineProps({
  municipality: {
    type: Object,
    required: true,
  },
  sortedRatings: {
    type: Object,
    required: true,
  },
});

// Create mapping of sectors to measurement IDs
const sectorToMeasureIDs = computed(() => {
  const mapping = {}
  Object.entries(props.sortedRatings).forEach(([sector, ratings]) => {
    mapping[sector] = ratings.map(rating => rating.measure.measure_id)
  })
  return mapping
})

// Create mapping of measurement IDs to sectors
const measureIDToSector = computed(() => {
  const mapping = {}
  Object.entries(sectorToMeasureIDs.value).forEach(([sector, measureIDs]) => {
    measureIDs.forEach(measureID => {
      mapping[measureID] = sector
    })
  })
  return mapping
})

// Function to check if element is visible
const isElementVisible = (element) => {
  const rect = element.getBoundingClientRect()
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top >= 0 &&
    rect.left >= 0
  )
}

// Function to find visible element by name
const findVisibleElementByName = (name) => {
  const elements = document.getElementsByName(name)
  for (let element of elements) {
    if (isElementVisible(element)) {
      return element
    }
  }
  return elements[0] // fallback to first element if none are clearly visible
}

// Alternative approach using transition events
const waitForTransition = (element) => {
  return new Promise(resolve => {
    const handler = () => {
      element.removeEventListener('transitionend', handler)
      resolve()
    }
    element.addEventListener('transitionend', handler)
    // Fallback timeout in case transition doesn't fire
    setTimeout(resolve, 500)
  })
}

const handleNavigation = async () => {
  const hash = window.location.hash.substring(1)
  
  if (!hash) {
    // If no hash, scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  if (hash.startsWith('sector-')) {
    const sector = hash.replace('sector-', '')
    if (props.sortedRatings[sector]) {
      openSectors[sector] = true
      await nextTick()
      
      // Wait for DOM updates and then scroll
      setTimeout(async () => {
        const element = findVisibleElementByName(`sector-${sector}`)
        if (element) {
          await waitForTransition(element)
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  } else if (hash.startsWith('measure-')) {
    // Navigate to measure
    const measureID = hash.replace('measure-', '')
    const sector = measureIDToSector.value[measureID]

    if (sector) {
      // Open both sector and measure
      openSectors[sector] = true
      openItems[measureID] = true

      await nextTick()
      // Wait longer for content to load and animations to complete
      setTimeout(() => {
        const element = findVisibleElementByName(`measure-${measureID}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 800)
    }
  }
}

// Watch for hash changes
watch(() => window.location.hash, handleNavigation)

// Reset scroll position on route change (if using Vue Router)
watch(() => window.location.pathname, () => {
  // Reset scroll to top when navigating to a new page
  window.scrollTo(0, 0)
  // Clear any open state when navigating to new page
  Object.keys(openItems).forEach(key => openItems[key] = false)
  Object.keys(openSectors).forEach(key => openSectors[key] = false)
})

onMounted(() => {
  // Reset scroll position first
  if (!window.location.hash) {
    window.scrollTo(0, 0)
  }
  
  // Wait for page to be fully rendered before handling navigation
  setTimeout(() => {
    handleNavigation()
  }, 200)
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleNavigation)
})
</script>
