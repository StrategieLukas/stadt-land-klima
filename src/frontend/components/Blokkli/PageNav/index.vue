<template>
  <nav
    class="blokkli-block-page-nav"
    :class="[stickyClass, bgClass, paddingClass]"
    aria-label="Seitennavigation"
  >
    <ul :class="['flex flex-wrap gap-2', alignmentClass]">
      <li v-for="item in parsedItems" :key="item.href">
        <a
          :href="item.href"
          class="transition-colors no-underline"
          :class="linkClass"
          v-text="item.label"
        />
      </li>
      <li v-if="isEditing && !parsedItems.length" class="text-sm opacity-50 italic py-1 px-3">
        Links als JSON eingeben: [{"label": "Abschnitt", "href": "#abschnitt"}]
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
const { options, isEditing } = defineBlokkli({
  bundle: 'page_nav',
  options: {
    items: {
      type: 'text',
      label: 'Links (JSON)',
      default: '',
      inputType: 'text',
    },
    style: {
      type: 'radios',
      label: 'Stil',
      default: 'pills',
      options: {
        pills: 'Pillen',
        tabs: 'Tabs',
        underline: 'Unterstrichen',
        plain: 'Einfach',
      },
    },
    color: {
      type: 'radios',
      label: 'Farbe',
      default: 'green',
      displayAs: 'colors',
      options: {
        green: { label: 'Grün', hex: '#1da64a' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
      },
    },
    alignment: {
      type: 'radios',
      label: 'Ausrichtung',
      default: 'left',
      options: {
        left: 'Links',
        center: 'Mitte',
        right: 'Rechts',
      },
    },
    background: {
      type: 'radios',
      label: 'Hintergrund',
      default: 'none',
      options: {
        none: 'Kein',
        white: 'Weiß',
        light: 'Hell',
      },
    },
    sticky: {
      type: 'checkbox',
      label: 'Fixiert (sticky)',
      default: false,
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Seitennavigation',
    mockProps: () => { return {} },
  },
})

interface NavItem {
  label: string
  href: string
}

const parsedItems = computed<NavItem[]>(() => {
  const raw = options.value.items?.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item.label === 'string' && typeof item.href === 'string')
  } catch {
    return []
  }
})

const colorTokens: Record<string, { active: string; hover: string; border: string; text: string }> = {
  green: { active: 'bg-ff-green text-white', hover: 'hover:bg-ff-green hover:text-white', border: 'border-ff-green', text: 'text-ff-green' },
  blue: { active: 'bg-light-blue text-white', hover: 'hover:bg-light-blue hover:text-white', border: 'border-light-blue', text: 'text-light-blue' },
  dark: { active: 'bg-stats-dark text-white', hover: 'hover:bg-stats-dark hover:text-white', border: 'border-stats-dark', text: 'text-stats-dark' },
  orange: { active: 'bg-orange text-white', hover: 'hover:bg-orange hover:text-white', border: 'border-orange', text: 'text-orange' },
}

const colorToken = computed(() => colorTokens[options.value.color] || colorTokens.green)

const linkClass = computed(() => {
  const { hover, border, text } = colorToken.value
  const styleMap: Record<string, string> = {
    pills: `px-4 py-1.5 rounded-full text-sm font-medium border ${border} ${text} ${hover} transition-colors`,
    tabs: `px-4 py-2 text-sm font-medium border-b-2 ${border} ${text} ${hover}`,
    underline: `text-sm font-medium underline underline-offset-4 ${text} ${hover}`,
    plain: `text-sm text-gray hover:underline`,
  }
  return styleMap[options.value.style] || styleMap.pills
})

const alignmentClass = computed(() => {
  const map: Record<string, string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }
  return map[options.value.alignment] || 'justify-start'
})

const bgClass = computed(() => {
  const map: Record<string, string> = {
    none: '',
    white: 'bg-white shadow-sm',
    light: 'bg-mild-white shadow-sm',
  }
  return map[options.value.background] || ''
})

const paddingClass = computed(() => {
  return options.value.background !== 'none' ? 'px-4 py-3 rounded-lg' : 'py-2'
})

const stickyClass = computed(() => {
  return options.value.sticky && !isEditing.value ? 'sticky top-0 z-40' : ''
})
</script>

<style scoped>
.blokkli-block-page-nav {
  width: 100%;
}
</style>
