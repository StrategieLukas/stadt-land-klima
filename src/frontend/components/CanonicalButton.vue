<template>
  <component
    :is="href ? 'a' : 'button'"
    v-bind="linkAttrs"
    class="canonical-button inline-flex items-stretch rounded-md text-sm font-bold transition-all no-underline overflow-hidden whitespace-nowrap hover:brightness-110 shadow-sm ring-1 ring-inset ring-white/20"
    :class="[bgClass, textClass]"
  >
    <!-- Local SVG icon -->
    <span
      v-if="currentIconSvg"
      :class="iconSize === 'lg' ? 'flex-shrink-0 w-12 self-stretch flex items-center justify-center border-r-2 border-current [&>svg]:h-7 [&>svg]:w-7' : 'flex-shrink-0 w-9 self-stretch flex items-center justify-center border-r-2 border-current [&>svg]:h-5 [&>svg]:w-5'"
    >
      <span
        :class="iconSize === 'lg' ? 'h-7 w-7 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full' : 'h-5 w-5 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full'"
        v-html="currentIconSvg"
      />
    </span>
    <!-- Iconify icon (e.g. mdi:arrow-right) -->
    <span
      v-else-if="iconifySlug"
      :class="iconSize === 'lg' ? 'flex-shrink-0 w-12 self-stretch flex items-center justify-center border-r-2 border-current' : 'flex-shrink-0 w-9 self-stretch flex items-center justify-center border-r-2 border-current'"
    >
      <Icon :icon="iconifySlug" :class="iconSize === 'lg' ? 'h-7 w-7' : 'h-5 w-5'" />
    </span>
    <!-- Label -->
    <span
      class="flex-1 flex items-center justify-center"
      :class="hasIcon ? 'py-2 pl-3 pr-4' : 'py-2 px-4'"
    >{{ label }}</span>
  </component>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  label: string
  href?: string
  iconSlug?: string
  color?: string
  textColor?: 'auto' | 'white' | 'black'
  iconSize?: 'sm' | 'lg'
  external?: boolean
}>()

const attrs = useAttrs()

const svgFiles = import.meta.glob('@/assets/icons/*.svg', { query: '?raw', import: 'default', eager: true })

/**
 * Like Blokkli Button's prepareIcon, but also strips <circle class="cls-1">
 * background shapes so icons like icon_newsletter_click render correctly on a
 * coloured button (the white envelope shows on the button background, not its own circle).
 */
function prepareIconForButton(raw: string): string {
  let svg = raw
  svg = svg.replace(/<\?xml[^?]*\?>/g, '')
  svg = svg.replace(/(<svg[^>]*?)\s+width="[^"]*"/g, '$1')
  svg = svg.replace(/(<svg[^>]*?)\s+height="[^"]*"/g, '$1')
  svg = svg.replace(/<rect[^>]*class="cls-[12]"[^/>]*\/>/g, '')
  svg = svg.replace(/<rect[^>]*class="cls-[12]"[^>]*>[^<]*<\/rect>/g, '')
  svg = svg.replace(/<circle[^>]*class="cls-1"[^/>]*\/>/g, '')
  svg = svg.replace(/<circle[^>]*class="cls-1"[^>]*>[^<]*<\/circle>/g, '')
  svg = svg.replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, 'fill: currentColor')
  svg = svg.replace(/stroke:\s*#[0-9a-fA-F]{3,6}/g, 'stroke: currentColor')
  svg = svg.replace(/fill="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'fill="currentColor"')
  svg = svg.replace(/stroke="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'stroke="currentColor"')
  return svg
}

const iconMap: Record<string, string> = Object.fromEntries(
  Object.entries(svgFiles).map(([path, svg]) => {
    const name = path.split('/').pop()?.replace('.svg', '') ?? ''
    return [name, prepareIconForButton(svg as string)]
  }),
)

const currentIconSvg = computed(() => {
  if (!props.iconSlug) return ''
  return iconMap[props.iconSlug] ?? ''
})

const iconifySlug = computed(() => {
  if (!props.iconSlug || iconMap[props.iconSlug]) return ''
  return props.iconSlug
})

const hasIcon = computed(() => !!(currentIconSvg.value || iconifySlug.value))

const colorConfig: Record<string, { bg: string; autoText: string }> = {
  'green':        { bg: 'bg-ff-green',        autoText: 'text-white' },
  'dark-green':   { bg: 'bg-green',            autoText: 'text-white' },
  'bright-green': { bg: 'bg-light-green',      autoText: 'text-black' },
  'blue':         { bg: 'bg-light-blue',       autoText: 'text-white' },
  'dark':         { bg: 'bg-stats-dark',       autoText: 'text-white' },
  'orange':       { bg: 'bg-orange',           autoText: 'text-white' },
  'red':          { bg: 'bg-red',              autoText: 'text-white' },
  'yellow':       { bg: 'bg-localzero-yellow', autoText: 'text-gray' },
}

const cfg = computed(() => colorConfig[props.color ?? 'green'] ?? colorConfig['green'])
const bgClass = computed(() => cfg.value.bg)
const textClass = computed(() => {
  const tc = props.textColor ?? 'auto'
  if (tc === 'white') return 'text-white'
  if (tc === 'black') return 'text-black'
  return cfg.value.autoText
})

const linkAttrs = computed(() => {
  const base: Record<string, unknown> = { ...attrs }
  if (props.href) {
    base.href = props.href
    if (props.external) {
      base.target = '_blank'
      base.rel = 'noopener noreferrer'
    }
  } else {
    if (!base.type) base.type = 'button'
  }
  return base
})
</script>
