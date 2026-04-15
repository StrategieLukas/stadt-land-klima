<template>
  <div :id="'block-' + uuid" class="blokkli-block-newsletter-signup">
    <div :class="wrapperClass">
      <div class="max-w-2xl mx-auto text-center">
        <!-- Heading (editable) -->
        <div class="mb-6">
          <h2
            v-blokkli-editable:title
            v-text="props.title"
            class="font-heading text-2xl font-bold mb-2"
            :class="headingClass"
          />
          <p
            v-if="props.description || isEditing"
            v-blokkli-editable:description
            v-text="props.description"
            class="text-base"
            :class="subtextClass"
          />
        </div>

        <!-- List selection checkboxes (only shown if multiple lists are available) -->
        <div
          v-if="filteredLists.length > 1"
          class="mb-5 flex flex-wrap justify-center gap-x-6 gap-y-2"
        >
          <label
            v-for="list in filteredLists"
            :key="list.id"
            class="flex items-center gap-2 cursor-pointer text-left"
          >
            <input
              type="checkbox"
              :value="list.id"
              v-model="selectedIds"
              class="rounded border-gray-300 text-green focus:ring-green"
            />
            <span class="text-sm">{{ list.name }}</span>
          </label>
        </div>

        <!-- Success state -->
        <div
          v-if="subscribeState === 'success'"
          class="flex items-center justify-center gap-2 text-sm font-medium"
          :class="successClass"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          {{ alreadySubscribed ? 'Du bist bereits angemeldet.' : 'Bestätigungsmail gesendet – bitte prüfe dein Postfach.' }}
        </div>

        <!-- Email input + button -->
        <div v-else class="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="Deine E-Mail-Adresse"
            class="flex-1 px-4 py-2.5 text-sm rounded-md border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
            @keydown.enter.prevent="subscribe"
          />
          <button
            type="button"
            :disabled="subscribeState === 'subscribing'"
            class="px-5 py-2.5 font-semibold text-sm rounded-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            :class="buttonClass"
            @click="subscribe"
          >
            <span v-if="subscribeState === 'subscribing'">…</span>
            <span v-else>Anmelden</span>
          </button>
        </div>

        <p v-if="subscribeError" class="mt-2 text-xs text-red-500">{{ subscribeError }}</p>
        <p class="mt-2 text-xs" :class="hintClass">Abmeldung jederzeit möglich. Kein Spam.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface NewsletterList {
  id: number
  name: string
  description: string
}

const props = defineProps<{
  title: string
  description?: string
}>()

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'newsletter_signup',
  options: {
    listIds: {
      type: 'text',
      label: 'Listen-IDs (kommagetrennt, leer = alle)',
      default: '',
    },
    background: {
      type: 'radios',
      label: 'Hintergrund',
      default: 'light',
      options: {
        white: 'Weiß',
        light: 'Hellblau',
        green: 'Grün',
        olive: 'Dunkelgrün',
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: (el) => { return el.textContent?.trim() },
    mockProps: () => { return { title: 'Newsletter abonnieren', description: 'Bleib auf dem Laufenden mit Neuigkeiten und Tipps zu kommunalem Klimaschutz.' } },
  },
})

// Fetch all public lists from the server once per page load
const { data: listsData } = await useAsyncData('newsletter-lists', () =>
  $fetch<{ lists: NewsletterList[] }>('/api/newsletter-lists').catch(() => ({ lists: [] })),
)

const allLists = computed<NewsletterList[]>(() => listsData.value?.lists ?? [])

// Parse configured list IDs from the editor option
const configuredIds = computed<number[]>(() => {
  const raw = (options.value as any)?.listIds ?? ''
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((s: string) => parseInt(s.trim(), 10))
    .filter((n: number) => Number.isInteger(n) && n > 0)
})

const filteredLists = computed<NewsletterList[]>(() => {
  if (configuredIds.value.length === 0) return allLists.value
  return allLists.value.filter((l) => configuredIds.value.includes(l.id))
})

// Pre-select all visible lists when the list changes
const selectedIds = ref<number[]>([])
watch(
  filteredLists,
  (lists) => {
    selectedIds.value = lists.map((l) => l.id)
  },
  { immediate: true },
)

// Form state
const email = ref('')
const subscribeState = ref<'idle' | 'subscribing' | 'success'>('idle')
const alreadySubscribed = ref(false)
const subscribeError = ref('')

// Dynamic style classes based on background option
const bg = computed(() => (options.value as any)?.background ?? 'light')

const wrapperClass = computed(() => {
  const map: Record<string, string> = {
    white: 'bg-white py-12 px-6',
    light: 'bg-very-light-blue py-12 px-6',
    green: 'bg-rating-4-very-light py-12 px-6',
    olive: 'bg-olive-green text-white py-12 px-6',
  }
  return map[bg.value] ?? map.light
})

const headingClass = computed(() =>
  bg.value === 'olive' ? 'text-white' : 'text-gray-900',
)

const subtextClass = computed(() =>
  bg.value === 'olive' ? 'text-white/80' : 'text-gray-500',
)

const buttonClass = computed(() =>
  bg.value === 'olive'
    ? 'bg-white text-olive-green hover:bg-white/90'
    : 'bg-green text-white hover:opacity-90',
)

const successClass = computed(() =>
  bg.value === 'olive' ? 'text-white' : 'text-green',
)

const hintClass = computed(() =>
  bg.value === 'olive' ? 'text-white/50' : 'text-gray-400',
)

async function subscribe() {
  subscribeError.value = ''
  if (!email.value.trim()) {
    subscribeError.value = 'Bitte gib deine E-Mail-Adresse ein.'
    return
  }
  // Prevent form submission in editor mode
  if (isEditing.value) return

  const listIds = selectedIds.value.length > 0 ? selectedIds.value : undefined
  subscribeState.value = 'subscribing'
  try {
    const result = await $fetch<{ success: boolean; alreadySubscribed: boolean }>(
      '/api/newsletter-subscribe',
      { method: 'POST', body: { email: email.value.trim(), listIds } },
    )
    alreadySubscribed.value = result.alreadySubscribed
    subscribeState.value = 'success'
  } catch (err: any) {
    subscribeState.value = 'idle'
    subscribeError.value = err?.data?.message ?? 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.'
  }
}
</script>
