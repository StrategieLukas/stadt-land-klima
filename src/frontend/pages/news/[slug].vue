<template>
  <BlokkliProvider
    v-if="item"
    entity-type="news_items"
    entity-bundle="news_item"
    :entity-uuid="item.slug"
    :can-edit="canEdit"
    :entity="item"
  >
    <template #default>
      <div class="px-4 py-8 max-w-4xl mx-auto w-full">
        <div class="mb-4">
          <NuxtLink to="/news" class="inline-flex items-center gap-1 text-sm text-[#006e94] hover:underline">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            Zurück zur News-Übersicht
          </NuxtLink>
        </div>
        <article class="prose max-w-none">
          <!-- Header: image, title, teaser -->
          <div v-if="item.image" class="not-prose mb-6 rounded-lg overflow-hidden">
            <img
              :src="`${directusUrl}/assets/${item.image}?width=900&quality=80`"
              :alt="item.title"
              class="w-full max-h-80 object-cover"
            />
          </div>
          <time
            v-if="displayDate"
            class="not-prose block text-sm text-gray-500 mb-2"
            :datetime="displayDate"
          >{{ formatDate(displayDate) }}</time>
          <h1>{{ item.title }}</h1>
          <p v-if="item.teaser" class="lead text-gray-600">{{ item.teaser }}</p>

          <!-- blokkli content blocks -->
          <BlokkliField name="content" :list="newsBlocks" />
        </article>

        <!-- Metadata edit panel (visible to authenticated editors only) -->
        <div v-if="canEdit" class="not-prose mt-8 border-t border-gray-200 pt-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Metadaten bearbeiten</h2>
            <button
              type="button"
              @click="editOpen = !editOpen"
              class="text-xs px-3 py-1.5 rounded-full border border-[#16BAE7] text-[#16BAE7] hover:bg-[#E8F7FD] transition-colors"
            >{{ editOpen ? 'Schließen' : 'Bearbeiten' }}</button>
          </div>

          <form v-if="editOpen" @submit.prevent="saveMetadata" class="flex flex-col gap-4 bg-[#f5fafb] rounded-lg p-5 border border-gray-100">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Titel *</label>
              <input
                v-model="editForm.title"
                type="text"
                required
                class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Teaser (Feed-Karte)</label>
              <textarea
                v-model="editForm.teaser"
                rows="3"
                class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Veröffentlichungsdatum</label>
                <input
                  v-model="editForm.date_published"
                  type="datetime-local"
                  class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select
                  v-model="editForm.status"
                  class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
                >
                  <option value="draft">Entwurf</option>
                  <option value="published">Veröffentlicht</option>
                  <option value="archived">Archiviert</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Bild-ID (Directus Asset UUID)</label>
              <input
                v-model="editForm.image"
                type="text"
                placeholder="z.B. 82d3f1c5-9a8d-4aeb-8335-ca9330a43b90"
                class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#16BAE7]"
              />
              <p class="text-xs text-gray-400 mt-1">
                UUID des Bildes aus dem
                <a :href="`${directusUrl}/admin/files`" target="_blank" class="underline">Directus Dateimanager</a>.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <button
                type="submit"
                :disabled="saving"
                class="px-4 py-2 rounded bg-[#006e94] text-white text-sm font-semibold hover:bg-[#005a7a] disabled:opacity-50 transition-colors"
              >{{ saving ? 'Speichern…' : 'Speichern' }}</button>
              <span v-if="saveSuccess" class="text-sm text-green-600 font-medium">✓ Gespeichert</span>
              <span v-if="saveError" class="text-sm text-red-600">{{ saveError }}</span>
            </div>
          </form>
        </div>
      </div>
    </template>
  </BlokkliProvider>

  <p v-else class="prose py-8">
    {{ $t('page_not_found') }}
  </p>
</template>

<script setup>
import { readItems, updateItem } from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'

const { $directus, $readItems, $t } = useNuxtApp()
const config = useRuntimeConfig()
const directusUrl = config.public.clientDirectusUrl

const { isAuthenticated, initialize, getAuthenticatedClient } = useAuth()
const canEdit = ref(false)
onMounted(() => {
  initialize()
  watchEffect(() => { canEdit.value = isAuthenticated.value })
})

const route = useRoute()

const { data: itemList } = await useAsyncData(`news-item-${route.params.slug}`, () =>
  $directus.request(
    $readItems('news_items', {
      filter: { slug: { _eq: route.params.slug } },
      limit: 1,
    })
  )
)
const item = computed(() => itemList.value?.[0] || null)

if (!item.value) {
  throw createError({ statusCode: 404, statusMessage: 'News item not found', fatal: true })
}

const { data: blocksData } = await useAsyncData(
  `blocks-news-${route.params.slug}`,
  async () => {
    if (!item.value) return []
    try {
      const blocks = await $directus.request(
        readItems('blocks', {
          filter: {
            entity_type: { _eq: 'news_items' },
            entity_uuid: { _eq: item.value.slug },
            field_name: { _eq: 'content' },
            status: { _neq: 'archived' },
          },
          sort: ['sort_order'],
        })
      )
      return (blocks || []).map(block => ({
        uuid: block.uuid,
        bundle: block.bundle,
        options: block.options || {},
        props: block.props || {},
      }))
    } catch {
      return []
    }
  },
  { watch: [item] }
)
const newsBlocks = computed(() => blocksData.value || [])

const displayDate = computed(() => item.value?.date_published || item.value?.date_created)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── Metadata editing ───────────────────────────────────────────────────────────

const editOpen = ref(false)
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref(null)

// Convert ISO datetime to datetime-local input format (strips seconds + timezone)
function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const editForm = reactive({
  title: '',
  teaser: '',
  date_published: '',
  status: 'draft',
  image: '',
})

// Sync form when item loads or editOpen changes
watch([() => item.value, editOpen], () => {
  if (!item.value || !editOpen.value) return
  editForm.title = item.value.title || ''
  editForm.teaser = item.value.teaser || ''
  editForm.date_published = toDatetimeLocal(item.value.date_published)
  editForm.status = item.value.status || 'draft'
  editForm.image = item.value.image || ''
}, { immediate: true })

async function saveMetadata() {
  if (!item.value?.id) return
  saving.value = true
  saveSuccess.value = false
  saveError.value = null
  try {
    const client = getAuthenticatedClient()
    await client.request(updateItem('news_items', item.value.id, {
      title: editForm.title,
      teaser: editForm.teaser || null,
      date_published: editForm.date_published ? new Date(editForm.date_published).toISOString() : null,
      status: editForm.status,
      image: editForm.image || null,
    }))
    await refreshNuxtData(`news-item-${route.params.slug}`)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err) {
    saveError.value = err?.errors?.[0]?.message || err?.message || 'Fehler beim Speichern'
  } finally {
    saving.value = false
  }
}

useHead({ title: computed(() => item.value?.title || 'Neuigkeit') })
</script>
