<template>
  <div class="blokkli-block-button" :id="'block-' + uuid">
    <!-- External link -->
    <a
      v-if="options.linkType === 'external'"
      :href="options.link || '#'"
      target="_blank"
      rel="noopener noreferrer"
      class="button-link inline-flex items-stretch rounded-md font-semibold transition-colors no-underline relative overflow-hidden"
      :class="[styleClass, textColorClass, hasIcon ? 'gap-0 px-0 py-0' : 'gap-2 px-6 py-3']"
      :data-hover="options.hoverEffect"
    >
      <!-- Left icon (position: left or both) -->
      <span
        v-if="hasIcon && (options.iconPosition === 'left' || options.iconPosition === 'both')"
        class="blokkli-button-icon flex-shrink-0 w-12 [&>svg]:h-7 [&>svg]:w-7 self-stretch flex items-center justify-center px-2 border-r-2 border-current"
      >
        <span v-if="currentIconSvg" class="h-7 w-7 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" v-html="currentIconSvg" />
        <Icon v-else-if="iconifySlug" :icon="iconifySlug" class="h-7 w-7" />
      </span>
      <!-- Label -->
      <span class="flex items-center gap-1" :class="labelClass">
        <Icon icon="mdi:open-in-new" class="w-4 h-4 flex-shrink-0 opacity-80" />
        <span v-blokkli-editable:label v-text="props.label" />
      </span>
      <!-- Right icon (position: right or both) -->
      <span
        v-if="hasIcon && (options.iconPosition === 'right' || options.iconPosition === 'both')"
        class="blokkli-button-icon flex-shrink-0 w-12 [&>svg]:h-7 [&>svg]:w-7 self-stretch flex items-center justify-center px-2 border-l-2 border-current"
      >
        <span v-if="currentIconSvg" class="h-7 w-7 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" v-html="currentIconSvg" />
        <Icon v-else-if="iconifySlug" :icon="iconifySlug" class="h-7 w-7" />
      </span>
    </a>
    <!-- Internal link -->
    <NuxtLink
      v-else
      :to="'/' + (options.link || '').replace(/^\//, '')"
      class="button-link inline-flex items-stretch rounded-md font-semibold transition-colors no-underline relative overflow-hidden"
      :class="[styleClass, textColorClass, hasIcon ? 'gap-0 px-0 py-0' : 'gap-2 px-6 py-3']"
      :data-hover="options.hoverEffect"
    >
      <!-- Left icon (position: left or both) -->
      <span
        v-if="hasIcon && (options.iconPosition === 'left' || options.iconPosition === 'both')"
        class="blokkli-button-icon flex-shrink-0 w-12 [&>svg]:h-7 [&>svg]:w-7 self-stretch flex items-center justify-center px-2 border-r-2 border-current"
      >
        <span v-if="currentIconSvg" class="h-7 w-7 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" v-html="currentIconSvg" />
        <Icon v-else-if="iconifySlug" :icon="iconifySlug" class="h-7 w-7" />
      </span>
      <!-- Label -->
      <span class="flex items-center" :class="labelClass">
        <span v-blokkli-editable:label v-text="props.label" />
      </span>
      <!-- Right icon (position: right or both) -->
      <span
        v-if="hasIcon && (options.iconPosition === 'right' || options.iconPosition === 'both')"
        class="blokkli-button-icon flex-shrink-0 w-12 [&>svg]:h-7 [&>svg]:w-7 self-stretch flex items-center justify-center px-2 border-l-2 border-current"
      >
        <span v-if="currentIconSvg" class="h-7 w-7 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" v-html="currentIconSvg" />
        <Icon v-else-if="iconifySlug" :icon="iconifySlug" class="h-7 w-7" />
      </span>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const svgFiles = import.meta.glob('@/assets/icons/*.svg', { as: 'raw', eager: true })

/** Strip background rects, hardcoded dimensions, and rewrite fills/strokes to currentColor */
function prepareIcon(raw: string): string {
  let svg = raw
  // Remove XML declaration
  svg = svg.replace(/<\?xml[^?]*\?>/g, '')
  // Remove hardcoded width/height so the SVG scales with its container
  svg = svg.replace(/(<svg[^>]*?)\s+width="[^"]*"/g, '$1')
  svg = svg.replace(/(<svg[^>]*?)\s+height="[^"]*"/g, '$1')
  // Remove background <rect> with cls-2 class (solid bg)
  svg = svg.replace(/<rect[^>]*class="cls-2"[^/>]*\/>/g, '')
  svg = svg.replace(/<rect[^>]*class="cls-2"[^>]*>[^<]*<\/rect>/g, '')
  // Replace CSS fill/stroke declarations with currentColor
  svg = svg.replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, 'fill: currentColor')
  svg = svg.replace(/stroke:\s*#[0-9a-fA-F]{3,6}/g, 'stroke: currentColor')
  // Replace inline fill/stroke attributes with currentColor
  svg = svg.replace(/fill="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'fill="currentColor"')
  svg = svg.replace(/stroke="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'stroke="currentColor"')
  // Keep fill="none" intact (restore after blanket replace)
  // Not needed — our regex only matches color values, not "none"
  return svg
}

const iconMap: Record<string, string> = Object.fromEntries(
  Object.entries(svgFiles).map(([path, svg]) => {
    const name = path.split('/').pop()?.replace('.svg', '') || ''
    return [name, prepareIcon(svg as string)]
  }),
)

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'button',
  options: {
    linkType: {
      type: 'radios',
      label: 'Link-Typ',
      default: 'internal',
      options: {
        internal: 'Intern',
        external: 'Extern',
      },
    },
    link: {
      type: 'text',
      label: 'Link (Slug oder URL)',
      default: 'index',
      inputType: 'text',
    },
    variant: {
      type: 'radios',
      label: 'Variante',
      default: 'filled',
      group: 'Stil',
      options: {
        filled: 'Gefüllt',
        outline: 'Rahmen',
      },
    },
    color: {
      type: 'radios',
      label: 'Hintergrundfarbe',
      default: 'green',
      group: 'Stil',
      displayAs: 'colors',
      options: {
        green: { label: 'Grün', hex: '#1da64a' },
        'dark-green': { label: 'Dunkelgrün', hex: '#339737' },
        'bright-green': { label: 'Hellgrün', hex: '#AFCA0B' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
        red: { label: 'Rot', hex: '#e30613' },
        yellow: { label: 'Gelb', hex: '#ffc80c' },
      },
    },
    textColor: {
      type: 'radios',
      label: 'Textfarbe',
      default: 'auto',
      group: 'Stil',
      displayAs: 'colors',
      options: {
        auto: { label: 'Auto', hex: '#888888' },
        white: { label: 'Weiß', hex: '#ffffff' },
        black: { label: 'Schwarz', hex: '#000000' },
        green: { label: 'Grün', hex: '#1da64a' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
      },
    },
    iconSlug: {
      type: 'text',
      label: 'Icon (Iconify-Slug oder lokaler Name)',
      default: '',
      inputType: 'text',
      group: 'Icon',
    },
    iconPosition: {
      type: 'radios',
      label: 'Icon-Position',
      default: 'left',
      group: 'Icon',
      options: {
        left: 'Links',
        right: 'Rechts',
        both: 'Beides',
      },
    },
    hoverEffect: {
      type: 'radios',
      label: 'Hover-Effekt',
      default: 'darker',
      group: 'Stil',
      options: {
        darker: 'Dunkler',
        brighter: 'Heller',
        none: 'Kein',
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: (el) => el.textContent || 'Button',
    mockProps: () => {
      return { label: 'Button', link: '' }
    },
  },
})

const props = defineProps<{
  label: string
}>()

const currentIconSvg = computed(() => {
  const key = options.value.iconSlug
  if (!key) return ''
  return iconMap[key] || ''
})

// If not a local icon, treat it as an Iconify slug (e.g. "mdi:home", "heroicons:arrow-right")
const iconifySlug = computed(() => {
  const key = options.value.iconSlug
  if (!key || iconMap[key]) return ''
  return key
})

const hasIcon = computed(() => !!(currentIconSvg.value || iconifySlug.value))

const labelClass = computed(() => {
  if (!hasIcon.value) return ''
  const pos = options.value.iconPosition
  if (pos === 'right') return 'py-3 pl-6 pr-4'
  if (pos === 'both') return 'py-3 px-4'
  // left (default)
  return 'py-3 pl-4 pr-6'
})

const colorConfig: Record<string, { filled: string; outline: string; autoTextFilled: string; autoTextOutline: string }> = {
  green: {
    filled: 'bg-ff-green',
    outline: 'border-2 border-ff-green hover:bg-ff-green',
    autoTextFilled: 'text-white',
    autoTextOutline: 'text-ff-green hover:text-white',
  },
  'dark-green': {
    filled: 'bg-green',
    outline: 'border-2 border-green hover:bg-green',
    autoTextFilled: 'text-white',
    autoTextOutline: 'text-green hover:text-white',
  },
  'bright-green': {
    filled: 'bg-light-green',
    outline: 'border-2 border-light-green hover:bg-light-green',
    autoTextFilled: 'text-black',
    autoTextOutline: 'text-green hover:text-black',
  },
  blue: {
    filled: 'bg-light-blue',
    outline: 'border-2 border-light-blue hover:bg-light-blue',
    autoTextFilled: 'text-white',
    autoTextOutline: 'text-light-blue hover:text-white',
  },
  dark: {
    filled: 'bg-stats-dark',
    outline: 'border-2 border-stats-dark hover:bg-stats-dark',
    autoTextFilled: 'text-white',
    autoTextOutline: 'text-stats-dark hover:text-white',
  },
  orange: {
    filled: 'bg-orange',
    outline: 'border-2 border-orange hover:bg-orange',
    autoTextFilled: 'text-white',
    autoTextOutline: 'text-orange hover:text-white',
  },
  red: {
    filled: 'bg-red',
    outline: 'border-2 border-red hover:bg-red',
    autoTextFilled: 'text-white',
    autoTextOutline: 'text-red hover:text-white',
  },
  yellow: {
    filled: 'bg-localzero-yellow',
    outline: 'border-2 border-localzero-yellow hover:bg-localzero-yellow',
    autoTextFilled: 'text-gray',
    autoTextOutline: 'text-localzero-yellow hover:text-gray',
  },
}

const styleClass = computed(() => {
  const c = colorConfig[options.value.color] || colorConfig.green
  return options.value.variant === 'outline' ? c.outline : c.filled
})

const textColorClass = computed(() => {
  const tc = options.value.textColor
  const c = colorConfig[options.value.color] || colorConfig.green
  const isOutline = options.value.variant === 'outline'

  if (tc !== 'auto') {
    const map: Record<string, string> = {
      white: 'text-white',
      black: 'text-black',
      green: 'text-ff-green',
      blue: 'text-light-blue',
      dark: 'text-stats-dark',
    }
    const base = map[tc] || ''
    // For outline with manual text color, still invert on hover for legibility
    if (isOutline) {
      return base + ' hover:text-white'
    }
    return base
  }

  return isOutline ? c.autoTextOutline : c.autoTextFilled
})
</script>

<style scoped>
/* Overlay approach: ::after sits on top of the button, zero opacity at rest,
   fades to a dark or light tint on hover. Works with any background color. */
.button-link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.button-link[data-hover='darker']::after {
  background: black;
}
.button-link[data-hover='darker']:hover::after {
  opacity: 0.15;
}

.button-link[data-hover='brighter']::after {
  background: white;
}
.button-link[data-hover='brighter']:hover::after {
  opacity: 0.2;
}

/* data-hover="none" — no ::after effect, nothing to do */
</style>
