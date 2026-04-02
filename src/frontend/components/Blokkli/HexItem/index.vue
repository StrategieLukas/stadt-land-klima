<template>
  <div
    class="blokkli-block-hex-item"
    :id="'block-' + uuid"
  >
    <!--
      hex-outer: contains the border pseudo-element (::before) and is the
      transition target for the hover "move forward" effect.
      In editor mode the ::before is hidden to keep the edit layout clean.
    -->
    <component
      :is="linkComponent"
      v-bind="linkAttrs"
      class="hex-outer"
      :class="{ 'hex-outer--editing': isEditing }"
      :style="outerStyle"
    >
      <!--
        hex-tile: the visible hexagonal surface.
        clip-path creates the flat-top hexagon shape.
        Background image (if set) is blended with the solid color via multiply.
      -->
      <div
        class="hex-tile"
        :style="tileStyle"
        v-blokkli-droppable:imageId
      >
        <!-- Translucent color overlay when a background image is active -->
        <div v-if="imageUrl" class="hex-overlay" :style="{ backgroundColor: hexColor + 'b3' }" />

        <div class="hex-content">
          <img
            v-if="iconSlug && localIconUrl"
            :src="localIconUrl"
            class="hex-icon hex-icon--local"
            aria-hidden="true"
          />
          <Icon
            v-else-if="iconSlug"
            :icon="iconSlug"
            class="hex-icon"
            aria-hidden="true"
          />
          <div v-else-if="!imageUrl" class="hex-icon-placeholder" />
          <span
            v-blokkli-editable:label
            class="hex-label"
            v-text="props.label || 'Hexagon'"
          />
        </div>
      </div>
    </component>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'hex_item',
  options: {
    color: {
      type: 'radios',
      label: 'Farbe',
      default: 'teal',
      displayAs: 'colors',
      options: {
        teal: { label: 'Petrol', hex: '#0C7A82' },
        green: { label: 'Grün', hex: '#1DA64A' },
        'dark-green': { label: 'Dunkelgrün', hex: '#3F8342' },
        lime: { label: 'Hellgrün', hex: '#AFCA0B' },
        orange: { label: 'Orange', hex: '#F39200' },
        'dark-blue': { label: 'Dunkelblau', hex: '#006E94' },
        gray: { label: 'Grau', hex: '#7A7A7A' },
        black: { label: 'Schwarz', hex: '#2C2C2C' },
      },
    },
    icon: {
      type: 'text',
      label: 'Icon (z.B. mdi:home)',
      default: 'mdi:hexagon-outline',
    },
    link: {
      type: 'text',
      label: 'Link',
      default: '',
    },
    linkType: {
      type: 'radios',
      label: 'Link-Typ',
      default: 'internal',
      options: {
        internal: 'Intern',
        external: 'Extern',
      },
    },
  },
  editor: {
    addBehaviour: 'editable:label',
    editTitle: (el) => el.textContent?.trim().slice(0, 40) || 'Hexagon',
    mockProps: () => { return { label: 'Hexagon' } },
  },
})

const props = defineProps<{
  label?: string
  imageId?: string
}>()

const config = useRuntimeConfig()

const colorMap: Record<string, string> = {
  teal: '#0C7A82',
  green: '#1DA64A',
  'dark-green': '#3F8342',
  lime: '#AFCA0B',
  orange: '#F39200',
  'dark-blue': '#006E94',
  gray: '#7A7A7A',
  black: '#2C2C2C',
}

const hexColor = computed(() => colorMap[options.value.color] ?? '#0C7A82')

/** Darken a 6-digit hex color by the given fraction (0–1). */
function darkenHex(hex: string, by: number): string {
  const f = 1 - by
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return '#' + [r, g, b].map(v => Math.round(v * f).toString(16).padStart(2, '0')).join('')
}

const borderColor = computed(() => darkenHex(hexColor.value, 0.28))

const imageUrl = computed(() => {
  if (!props.imageId) return ''
  return `${config.public.clientDirectusUrl}/assets/${props.imageId}?width=400&quality=80`
})

// Pre-resolve all local icon SVGs at build time so dynamic icon_* slugs work.
const localIconModules = import.meta.glob<string>('~/assets/icons/icon_*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})
const localIconUrls: Record<string, string> = {}
for (const [path, url] of Object.entries(localIconModules)) {
  const name = path.split('/').pop()!.replace('.svg', '')
  localIconUrls[name] = url
}

const iconSlug = computed(() => options.value.icon?.trim() || '')
const localIconUrl = computed(() => {
  if (!iconSlug.value.startsWith('icon_')) return ''
  return localIconUrls[iconSlug.value] || ''
})
const link = computed(() => options.value.link?.trim() || '')

const linkComponent = computed(() => {
  if (!link.value) return 'div'
  if (options.value.linkType === 'external') return 'a'
  return resolveComponent('NuxtLink')
})

const linkAttrs = computed(() => {
  if (!link.value) return {}
  if (options.value.linkType === 'external') {
    return { href: link.value, target: '_blank', rel: 'noopener noreferrer' }
  }
  return { to: '/' + link.value.replace(/^\//, '') }
})

/** Style for the outer wrapper — exposes border color as a CSS variable. */
const outerStyle = computed(() => ({ '--border-color': borderColor.value }))

/** Style for the hex tile surface. */
const tileStyle = computed(() => {
  if (imageUrl.value) {
    return {
      backgroundImage: `url(${imageUrl.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { backgroundColor: hexColor.value }
})
</script>

<style scoped>
/*
 * Width/height are intentionally omitted here — they are set by the parent
 * HexHoneyweb via :deep(> *) with !important so the correct hex dimensions
 * always win regardless of style-sheet load order.
 */
.blokkli-block-hex-item {
  /* Hover transition on the whole item */
  transition: transform 0.2s ease, filter 0.2s ease;
  will-change: transform;
  cursor: default;
}

.blokkli-block-hex-item:has(a):hover,
.blokkli-block-hex-item:has([href]):hover {
  transform: translateY(-7px) scale(1.04);
  filter: drop-shadow(0 14px 22px rgba(0, 0, 0, 0.32));
  z-index: 10;
}

/* ── hex-outer ─────────────────────────────────────────────────────────── */
.hex-outer {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
  text-decoration: none;
}

/*
 * Border layer: a slightly larger flat-top hexagon rendered as a ::before
 * pseudo-element behind the main tile. It extends 4px beyond the outer
 * wrapper in every direction. The CSS var(--border-color) is set inline
 * to the same hue but ~28% darker.
 *
 * filter: blur(0.5px) softens the polygon edges just enough to give the
 * illusion of tiny rounded corners without altering the hex geometry.
 */
.hex-outer:not(.hex-outer--editing)::before {
  content: '';
  position: absolute;
  inset: -4px;
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  background: var(--border-color);
  filter: blur(0.5px);
}

/* ── hex-tile ──────────────────────────────────────────────────────────── */
/*
 * Flat-top hexagon clip:
 *   polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)
 *
 * This produces a correct flat-top regular hexagon only when the element's
 * aspect ratio is W:H = 2:√3 ≈ 1.155. The parent grid guarantees this
 * via --hex-w (= 2r) and --hex-h (= √3·r).
 */
.hex-tile {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ── color overlay over background image ──────────────────────────────── */
.hex-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* ── content ───────────────────────────────────────────────────────────── */
.hex-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* Safe-zone padding: keeps text inside the narrowest part of the hex */
  padding: 0 30%;
  gap: 0.25em;
  pointer-events: none;
}

.hex-icon {
  /* Scale with hex height so it looks proportional across all size options */
  width: calc(var(--hex-h, 130px) * 0.22);
  height: calc(var(--hex-h, 130px) * 0.22);
  color: white;
  flex-shrink: 0;
}

.hex-icon-placeholder {
  width: calc(var(--hex-h, 130px) * 0.16);
  height: calc(var(--hex-h, 130px) * 0.16);
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  flex-shrink: 0;
}

.hex-label {
  font-size: calc(var(--hex-h, 130px) * 0.1);
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1.2;
  color: white;
  hyphens: auto;
  /* hex-content sets pointer-events:none to let the link beneath handle
     clicks; re-enable here so blokkli can attach its inline-edit handler */
  pointer-events: auto;
}
</style>
