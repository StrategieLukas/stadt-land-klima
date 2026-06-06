<template>
  <div :id="'block-' + uuid" class="blokkli-block-icon" :class="alignClass">
    <div
      :class="[shapeClass, sizeClass, bgColorClass]"
      :style="customSizeStyle"
      class="inline-flex items-center justify-center overflow-hidden"
    >
      <!-- SLK local SVG -->
      <span
        v-if="options.source === 'slk' && currentSlkSvg"
        v-html="currentSlkSvg"
        :class="[iconInnerClass, iconColorClass]"
        class="flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
      />
      <!-- Iconify icon -->
      <Icon
        v-else-if="options.source === 'iconify' && options.iconifySlug"
        :icon="options.iconifySlug"
        :class="[iconInnerClass, iconColorClass]"
      />
      <!-- Editor placeholder -->
      <span v-else-if="isEditing" class="text-xs opacity-40 text-current font-mono">?</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const svgFiles = import.meta.glob('@/assets/icons/*.svg', { query: '?raw', eager: true })

/** Strip background rects, hardcoded dimensions, and rewrite fills/strokes to currentColor */
function prepareIcon(raw: string): string {
  let svg = raw
  svg = svg.replace(/<\?xml[^?]*\?>/g, '')
  svg = svg.replace(/(<svg[^>]*?)\s+width="[^"]*"/g, '$1')
  svg = svg.replace(/(<svg[^>]*?)\s+height="[^"]*"/g, '$1')
  svg = svg.replace(/<rect[^>]*class="cls-2"[^/>]*\/>/g, '')
  svg = svg.replace(/<rect[^>]*class="cls-2"[^>]*>[^<]*<\/rect>/g, '')
  // Remove cls-3 background rects (agriculture, hint icons)
  svg = svg.replace(/<rect[^>]*class="cls-3"[^/>]*\/>/g, '')
  svg = svg.replace(/<rect[^>]*class="cls-3"[^>]*>[^<]*<\/rect>/g, '')
  // Remove st0 background circles (impact, invest, evaluation_criteria, politics icons)
  svg = svg.replace(/<circle[^>]*class="st0"[^/>]*\/>/g, '')
  svg = svg.replace(/<circle[^>]*class="st0"[^>]*>[^<]*<\/circle>/g, '')
  svg = svg.replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, 'fill: currentColor')
  svg = svg.replace(/stroke:\s*#[0-9a-fA-F]{3,6}/g, 'stroke: currentColor')
  svg = svg.replace(/fill="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'fill="currentColor"')
  svg = svg.replace(/stroke="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'stroke="currentColor"')
  return svg
}

const iconMap: Record<string, string> = Object.fromEntries(
  Object.entries(svgFiles).map(([path, svg]) => {
    const name = path.split('/').pop()?.replace('.svg', '') || ''
    return [name, prepareIcon(svg as string)]
  }),
)

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'icon',
  options: {
    // ── Quelle ───────────────────────────────────────────────────────────────
    source: {
      type: 'radios',
      label: 'Quelle',
      default: 'iconify',
      group: 'Quelle',
      options: {
        iconify: 'Iconify',
        slk: 'SLK Bibliothek',
      },
    },
    slkIcon: {
      type: 'radios',
      label: 'SLK Icon',
      default: '',
      displayAs: 'grid',
      group: 'Quelle',
      options: {
        '': 'Keines',
        'icon_category_agriculture': 'Landwirtschaft',
        'icon_category_buildings':   'Gebäude',
        'icon_category_energy':      'Energie',
        'icon_category_industry':    'Industrie',
        'icon_category_management':  'Verwaltung',
        'icon_category_transport':   'Verkehr',
        'icon_evaluation_criteria':  'Bewertungskriterien',
        'icon_hand_holding_heart':   'Gemeinwohl',
        'icon_hint':                 'Hinweis',
        'icon_impact':               'Wirkung',
        'icon_info':                 'Info',
        'icon_info_outline':         'Info (Umriss)',
        'icon_invest':               'Investitionen',
        'icon_klimachecker':         'Klimachecker',
        'icon_location':             'Standort',
        'icon_politics':             'Politik',
        'icon_rating_0':             'Bewertung: keine',
        'icon_rating_1':             'Bewertung: 1',
        'icon_rating_2':             'Bewertung: 2',
        'icon_rating_3':             'Bewertung: 3',
        'icon_rating_4':             'Bewertung: 4',
        'icon_signal':               'Signal',
        'icon_team':                 'Team',
      },
    },
    iconifySlug: {
      type: 'text',
      label: 'Iconify Slug (z.B. mdi:star)',
      default: 'mdi:star',
      inputType: 'text',
      group: 'Quelle',
    },
    // ── Darstellung ──────────────────────────────────────────────────────────
    size: {
      type: 'radios',
      label: 'Größe (Preset)',
      default: 'medium',
      group: 'Darstellung',
      options: {
        small:  'Klein (2rem)',
        medium: 'Mittel (3rem)',
        large:  'Groß (4rem)',
        xl:     'XL (6rem)',
      },
    },
    customSize: {
      type: 'number',
      label: 'Benutzerdefinierte Größe (rem, 0 = Preset)',
      default: 0,
      min: 0,
      max: 24,
      group: 'Darstellung',
    },
    shape: {
      type: 'radios',
      label: 'Form',
      default: 'circle',
      group: 'Darstellung',
      options: {
        none:   'Rechteckig',
        square: 'Abgerundet',
        circle: 'Kreis',
      },
    },
    // ── Farben ───────────────────────────────────────────────────────────────
    iconColor: {
      type: 'radios',
      label: 'Icon-Farbe',
      default: 'white',
      displayAs: 'colors',
      group: 'Farben',
      options: {
        white:        { label: 'Weiß',        hex: '#fbfbfb' },
        black:        { label: 'Schwarz',     hex: '#000000' },
        gray:         { label: 'Grau',        hex: '#505050' },
        green:        { label: 'Grün',        hex: '#1da64a' },
        'dark-green': { label: 'Dunkelgrün',  hex: '#339737' },
        blue:         { label: 'Blau',        hex: '#16bae7' },
        dark:         { label: 'Dunkelblau',  hex: '#006e94' },
        orange:       { label: 'Orange',      hex: '#f39200' },
        yellow:       { label: 'Gelb',        hex: '#ffc80c' },
        lime:         { label: 'Lime',        hex: '#afca0b' },
        red:          { label: 'Rot',         hex: '#e30613' },
        transparent:  { label: 'Transparent', hex: 'transparent' },
      },
    },
    bgColor: {
      type: 'radios',
      label: 'Hintergrundfarbe',
      default: 'green',
      displayAs: 'colors',
      group: 'Farben',
      options: {
        transparent:  { label: 'Transparent', hex: 'transparent' },
        green:        { label: 'Grün',        hex: '#1da64a' },
        'dark-green': { label: 'Dunkelgrün',  hex: '#339737' },
        blue:         { label: 'Blau',        hex: '#16bae7' },
        dark:         { label: 'Dunkelblau',  hex: '#006e94' },
        orange:       { label: 'Orange',      hex: '#f39200' },
        yellow:       { label: 'Gelb',        hex: '#ffc80c' },
        lime:         { label: 'Lime',        hex: '#afca0b' },
        red:          { label: 'Rot',         hex: '#e30613' },
        white:        { label: 'Weiß',        hex: '#fbfbfb' },
        gray:         { label: 'Grau',        hex: '#505050' },
        black:        { label: 'Schwarz',     hex: '#000000' },
      },
    },
    // ── Position ─────────────────────────────────────────────────────────────
    align: {
      type: 'radios',
      label: 'Ausrichtung',
      default: 'left',
      group: 'Position',
      options: {
        left:   'Links',
        center: 'Zentriert',
        right:  'Rechts',
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Icon',
    mockProps: () => { return {} },
  },
})

const currentSlkSvg = computed(() => {
  if (!options.value.slkIcon) return null
  return iconMap[options.value.slkIcon] || null
})

// ── Size ─────────────────────────────────────────────────────────────────────
const sizeMap = {
  small:  { container: 'w-8 h-8',   icon: 'w-5 h-5'   },
  medium: { container: 'w-12 h-12', icon: 'w-7 h-7'   },
  large:  { container: 'w-16 h-16', icon: 'w-10 h-10' },
  xl:     { container: 'w-24 h-24', icon: 'w-16 h-16' },
}

const currentSize    = computed(() => sizeMap[options.value.size as keyof typeof sizeMap] || sizeMap.medium)
const sizeClass      = computed(() => options.value.customSize > 0 ? '' : currentSize.value.container)
const iconInnerClass = computed(() => options.value.customSize > 0 ? 'w-3/4 h-3/4' : currentSize.value.icon)
const customSizeStyle = computed(() => {
  const n = options.value.customSize as number
  return n > 0 ? { width: `${n}rem`, height: `${n}rem` } : {}
})

// ── Colors ───────────────────────────────────────────────────────────────────
const iconColorMap: Record<string, string> = {
  white:        'text-white',
  black:        'text-black',
  gray:         'text-gray-500',
  green:        'text-ff-green',
  'dark-green': 'text-green-700',
  blue:         'text-light-blue',
  dark:         'text-stats-dark',
  orange:       'text-orange',
  yellow:       'text-localzero-yellow',
  lime:         'text-light-green',
  red:          'text-red-600',
  transparent:  'text-transparent',
}
const iconColorClass = computed(() => iconColorMap[options.value.iconColor] || 'text-white')

const bgColorMap: Record<string, string> = {
  transparent:  '',
  green:        'bg-ff-green',
  'dark-green': 'bg-green-700',
  blue:         'bg-light-blue',
  dark:         'bg-stats-dark',
  orange:       'bg-orange',
  yellow:       'bg-localzero-yellow',
  lime:         'bg-light-green',
  red:          'bg-red-600',
  white:        'bg-white',
  gray:         'bg-gray-500',
  black:        'bg-black',
}
const bgColorClass = computed(() => bgColorMap[options.value.bgColor] ?? '')

// ── Shape & layout ───────────────────────────────────────────────────────────
const shapeClass = computed(() => {
  const s = options.value.shape
  if (s === 'circle') return 'rounded-full'
  if (s === 'square') return 'rounded-md'
  return ''
})

const alignClass = computed(() => {
  const map: Record<string, string> = {
    left:   'flex justify-start',
    center: 'flex justify-center',
    right:  'flex justify-end',
  }
  return map[options.value.align] || 'flex justify-start'
})
</script>
