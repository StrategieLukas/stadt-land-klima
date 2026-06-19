<template>
  <div>

    <!-- ── Sticky breadcrumb nav ──────────────────────────────────────────── -->
    <nav
      class="sticky z-30"
      :style="`top: ${pillTop}px`"
    >
      <div
        class="absolute bg-white/90 backdrop-blur-sm border-b border-gray-100"
        style="top: 0; bottom: 0; left: calc((100% - 100vw) / 2); right: calc((100% - 100vw) / 2);"
      />
      <div class="relative flex items-center gap-3 py-2 min-w-0">
        <div class="flex-none">
          <GermanyMapIndicator
            :lat="indicatorCenter.lat"
            :lon="indicatorCenter.lon"
            :size="30"
          />
        </div>
        <ol class="flex items-center gap-1 flex-wrap min-w-0 text-xs">
          <template v-if="selectedState">
            <li>
              <BreadcrumbItem
                label="Deutschland"
                href="/data"
                :sibling-level="null"
              />
            </li>
            <li class="text-gray-300 select-none">›</li>
            <li>
              <BreadcrumbItem
                :label="`${selectedState.prefix} ${selectedState.name}`.trim()"
                is-current
                :sibling-level="null"
              />
            </li>
          </template>
          <template v-else>
            <li>
              <BreadcrumbItem
                label="Deutschland"
                is-current
                :sibling-level="null"
              />
            </li>
          </template>
        </ol>
      </div>
    </nav>

    <AreaOverview
      :area="GERMANY_AREA"
      :contained-by="[]"
      @state-selected="selectedState = $event"
      @state-exited="selectedState = null"
    />

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
import { useMobileHeaderHidden } from '~/composables/useMobileHeaderHidden.js'

const headerHeight = useHeaderHeight()
const mobileHeaderHidden = useMobileHeaderHidden()
const isDesktop = useState('layout-isDesktop')

const pillTop = computed(() =>
  isDesktop.value ? headerHeight.value : (mobileHeaderHidden.value ? 0 : 64)
)

const selectedState = ref(null)

const GERMANY_CENTER = {
  lat: 51.1657,
  lon: 10.4515,
}

const indicatorCenter = computed(() => selectedState.value?.geoCenter ?? GERMANY_CENTER)

const GERMANY_AREA = {
  name: 'Deutschland',
  prefix: 'Bundesrepublik',
  ars: '00000000',
  level: 1,
  population: null,
  geo_center: null,
  is_reasonable_for_municipal_rating: false,
  stadtlandklima_data_all: [],
}

useHead({
  title: 'Deutschland – Klimadaten',
  meta: [
    {
      name: 'description',
      content: 'Klimadaten und Bewertungen für alle Bundesländer und Kommunen in Deutschland.',
    },
  ],
})
</script>
