<template>
  <div class="blokkli-block-citation" :id="'block-' + uuid">
    <!-- Blockquote style -->
    <component
      :is="linkTag"
      v-bind="linkAttrs"
      v-if="options.style === 'blockquote'"
      class="relative pl-6 py-2 block no-underline"
      :class="borderLeftClass"
    >
      <Icon icon="mdi:format-quote-open" class="w-8 h-8 mb-2 opacity-30" :class="accentTextClass" />
      <p
        v-blokkli-editable:quote
        class="text-lg italic leading-relaxed mb-3"
        v-text="props.quote"
      />
      <footer>
        <cite
          v-if="props.attribution || isEditing"
          v-blokkli-editable:attribution
          class="font-semibold not-italic text-sm block"
          v-text="props.attribution"
        />
        <span
          v-if="options.author"
          class="text-sm opacity-80 block"
          v-text="options.author"
        />
        <span
          v-if="props.source || isEditing"
          v-blokkli-editable:source
          class="text-sm opacity-70 block"
          v-text="props.source"
        />
      </footer>
    </component>

    <!-- Card style -->
    <component
      :is="linkTag"
      v-bind="linkAttrs"
      v-else-if="options.style === 'card'"
      class="block no-underline bg-white rounded-xl shadow-md p-6 border-t-4"
      :class="accentBorderTopClass"
    >
      <Icon icon="mdi:format-quote-open" class="w-8 h-8 mb-3 opacity-40" :class="accentTextClass" />
      <p
        v-blokkli-editable:quote
        class="text-base italic leading-relaxed mb-4"
        v-text="props.quote"
      />
      <div class="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
        <div v-blokkli-droppable:imageId class="flex-shrink-0">
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            alt=""
            class="w-12 h-12 rounded-full object-cover"
          />
          <div
            v-else-if="isEditing"
            class="w-12 h-12 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs"
          >
            Foto
          </div>
        </div>
        <div>
          <cite
            v-if="props.attribution || isEditing"
            v-blokkli-editable:attribution
            class="font-semibold not-italic text-sm block"
            v-text="props.attribution"
          />
          <span
            v-if="options.author"
            class="text-sm opacity-80 block"
            v-text="options.author"
          />
          <span
            v-if="props.source || isEditing"
            v-blokkli-editable:source
            class="text-sm opacity-70"
            v-text="props.source"
          />
        </div>
      </div>
    </component>

    <!-- Pull-quote style -->
    <component
      :is="linkTag"
      v-bind="linkAttrs"
      v-else
      class="block no-underline text-center py-8 px-6"
    >
      <Icon icon="mdi:format-quote-open" class="w-12 h-12 mx-auto mb-3 opacity-20" :class="accentTextClass" />
      <p
        v-blokkli-editable:quote
        class="text-2xl md:text-3xl font-semibold leading-snug mb-2"
        :class="accentTextClass"
        v-text="props.quote"
      />
      <Icon icon="mdi:format-quote-close" class="w-12 h-12 mx-auto mt-3 opacity-20" :class="accentTextClass" />
      <div class="mt-5">
        <cite
          v-if="props.attribution || isEditing"
          v-blokkli-editable:attribution
          class="font-semibold not-italic text-sm block"
          v-text="props.attribution"
        />
        <span
          v-if="options.author"
          class="text-sm opacity-80 block"
          v-text="options.author"
        />
        <span
          v-if="props.source || isEditing"
          v-blokkli-editable:source
          class="text-sm opacity-70"
          v-text="props.source"
        />
      </div>
    </component>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { resolveComponent } from 'vue'

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'citation',
  options: {
    style: {
      type: 'radios',
      label: 'Stil',
      default: 'blockquote',
      options: {
        blockquote: 'Zitat (links)',
        card: 'Karte',
        pull: 'Pull-Quote',
      },
    },
    accentColor: {
      type: 'radios',
      label: 'Akzentfarbe',
      default: 'green',
      displayAs: 'colors',
      options: {
        green: { label: 'Grün', hex: '#1da64a' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
      },
    },
    linkType: {
      type: 'radios',
      label: 'Link-Typ',
      default: 'none',
      options: {
        none: 'Kein',
        internal: 'Intern',
        external: 'Extern',
      },
    },
    link: {
      type: 'text',
      label: 'Link (Slug oder URL)',
      default: '',
      inputType: 'text',
    },
    author: {
      type: 'text',
      label: 'Rolle / Titel (z.B. Bürgermeisterin)',
      default: '',
      inputType: 'text',
    },
  },
  editor: {
    addBehaviour: 'editable:quote',
    editTitle: (el) => el.textContent?.trim().slice(0, 40) || 'Zitat',
    mockProps: () => { return { quote: 'Zitat hier eingeben...', attribution: 'Name', source: 'Quelle / Organisation', imageId: '' } },
  },
})

const props = defineProps<{
  quote?: string
  attribution?: string
  source?: string
  imageId?: string
}>()

const config = useRuntimeConfig()

const avatarUrl = computed(() => {
  if (!props.imageId) return ''
  return `${config.public.clientDirectusUrl}/assets/${props.imageId}?width=100&height=100&fit=cover&quality=80`
})

const linkTag = computed(() => {
  if (isEditing.value) return 'div'
  if (options.value.linkType === 'external') return 'a'
  if (options.value.linkType === 'internal') return resolveComponent('NuxtLink')
  return options.value.style === 'blockquote' ? 'blockquote' : 'div'
})

const linkAttrs = computed(() => {
  if (isEditing.value || options.value.linkType === 'none') return {}
  const lv = options.value.link || '#'
  if (options.value.linkType === 'external') {
    return { href: lv, target: '_blank', rel: 'noopener noreferrer' }
  }
  return { to: '/' + lv.replace(/^\//, '') }
})

const accentTextClass = computed(() => {
  const map: Record<string, string> = {
    green: 'text-ff-green',
    blue: 'text-light-blue',
    dark: 'text-stats-dark',
    orange: 'text-orange',
  }
  return map[options.value.accentColor] || 'text-ff-green'
})

const borderLeftClass = computed(() => {
  const map: Record<string, string> = {
    green: 'border-l-4 border-ff-green',
    blue: 'border-l-4 border-light-blue',
    dark: 'border-l-4 border-stats-dark',
    orange: 'border-l-4 border-orange',
  }
  return map[options.value.accentColor] || 'border-l-4 border-ff-green'
})

const accentBorderTopClass = computed(() => {
  const map: Record<string, string> = {
    green: 'border-ff-green',
    blue: 'border-light-blue',
    dark: 'border-stats-dark',
    orange: 'border-orange',
  }
  return map[options.value.accentColor] || 'border-ff-green'
})
</script>

<style scoped>
.blokkli-block-citation {
  width: 100%;
  margin: 1rem 0;
}
</style>
