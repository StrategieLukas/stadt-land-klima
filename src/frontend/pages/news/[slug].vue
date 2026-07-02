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
      <div class="flex flex-col items-center px-4 py-8 w-full">
        <div class="max-w-3xl w-full">
        <div class="mb-4">
          <NuxtLink :to="backHref" class="inline-flex items-center gap-1 text-sm text-[#006e94] hover:underline">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            {{ backLabel }}
          </NuxtLink>
        </div>
        <article class="prose max-w-none">
          <!-- Header: image, title, teaser -->
          <div v-if="item.image" class="not-prose mb-6 rounded-xl overflow-hidden">
            <SmartImg
              :assetId="item.image.id"
              :isRaster="isRaster(item.image.type)"
              :alt="item.title"
              :width="900"
              img-class="w-full h-auto block"
            />
          </div>
          <time
            v-if="displayDate"
            class="not-prose block text-sm text-gray-500 mb-1"
            :datetime="displayDate"
          >{{ formatDate(displayDate) }}</time>
          <p v-if="item.author" class="not-prose text-sm text-gray-600 italic mb-3">
            {{ $t('article.author_date', { ':author': item.author, ':date': formatDate(displayDate) }) }}
          </p>
          <p v-else-if="displayDate && !item.author" class="not-prose mb-3" />
          <h1>{{ item.title }}</h1>
          <p v-if="item.teaser" class="lead text-gray-600">{{ item.teaser }}</p>

          <!-- blokkli content blocks -->
          <BlokkliField name="content" :list="newsBlocks" />
        </article>

        <!-- Metadata edit panel (visible to authenticated editors only) -->
        <div v-if="canEdit" class="not-prose mt-8 border-t border-gray-200 pt-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ $t('news.editor.metadata') }}</h2>
            <button
              type="button"
              @click="editOpen = !editOpen"
              class="text-xs px-3 py-1.5 rounded-full border border-[#16BAE7] text-[#16BAE7] hover:bg-[#E8F7FD] transition-colors"
            >{{ editOpen ? $t('generic.close') : $t('generic.edit') }}</button>
          </div>

          <form v-if="editOpen" @submit.prevent="saveMetadata" class="flex flex-col gap-4 bg-[#f5fafb] rounded-lg p-5 border border-gray-100">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">{{ $t('news.editor.title_required') }}</label>
              <input
                v-model="editForm.title"
                type="text"
                required
                class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">{{ $t('news.editor.teaser') }}</label>
              <textarea
                v-model="editForm.teaser"
                rows="3"
                class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">{{ $t('news.editor.author') }}</label>
              <input
                v-model="editForm.author"
                type="text"
                :placeholder="$t('news.editor.author_placeholder')"
                class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">{{ $t('news.editor.published_at') }}</label>
                <input
                  v-model="editForm.date_published"
                  type="datetime-local"
                  class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">{{ $t('news.editor.status') }}</label>
                <select
                  v-model="editForm.status"
                  class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#16BAE7]"
                >
                  <option value="draft">{{ $t('status.draft') }}</option>
                  <option value="published">{{ $t('status.published') }}</option>
                  <option value="archived">{{ $t('status.archived') }}</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">{{ $t('news.editor.image_id') }}</label>
              <input
                v-model="editForm.image"
                type="text"
                :placeholder="$t('news.editor.image_id_placeholder')"
                class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#16BAE7]"
              />
              <p class="text-xs text-gray-400 mt-1">
                {{ $t('news.editor.image_id_hint_prefix') }}
                <a :href="`${directusUrl}/admin/files`" target="_blank" class="underline">{{ $t('news.editor.directus_file_manager') }}</a>.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <button
                type="submit"
                :disabled="saving"
                class="px-4 py-2 rounded bg-[#006e94] text-white text-sm font-semibold hover:bg-[#005a7a] disabled:opacity-50 transition-colors"
              >{{ saving ? $t('generic.saving') : $t('generic.save') }}</button>
              <span v-if="saveSuccess" class="text-sm text-green-600 font-medium">✓ {{ $t('generic.saved') }}</span>
              <span v-if="saveError" class="text-sm text-red-600">{{ saveError }}</span>
            </div>
          </form>
        </div><!-- /.canEdit -->
        </div><!-- /.max-w-3xl -->
      </div><!-- /.flex -->
    </template>
  </BlokkliProvider>

  <p v-else-if="authChecked" class="prose py-8">
    {{ $t('page_not_found') }}
  </p>
  <!-- placeholder while waiting for client-side auth check -->
  <div v-else class="py-8" />
</template>

<script setup>
import { readItems, updateItem } from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'
import { useReferrer } from '~/composables/useReferrer'
import { formatBerlinDate } from '~/shared/eventDateTime'

import { isRaster } from '~/shared/utils'
const { $directus, $readItems, $t, $locale } = useNuxtApp()
const { backHref, backLabel } = useReferrer('/news', $t('news.back_to_overview'))
const config = useRuntimeConfig()
const directusUrl = config.public.clientDirectusUrl

const { isAuthenticated, initialize, getAuthenticatedClient } = useAuth()
const canEdit = ref(false)

const route = useRoute()

const { data: itemList, refresh: refreshItemList } = await useAsyncData(`news-item-${route.params.slug}`, async () => {
  // Primary fetch via frontend (static) token — only returns published items
  const result = await $directus.request(
    $readItems('news_items', {
      filter: { slug: { _eq: route.params.slug } },
      fields: ['id', 'slug', 'title', 'teaser', 'author', 'date_published', 'date_created', 'status', { image: ['id', 'type'] }],
      limit: 1,
    })
  )
  if (result?.length) return result

  // Client-side fallback: try the authenticated user client to load draft items
  if (process.client) {
    try {
      const authClient = getAuthenticatedClient()
      const authResult = await authClient.request(
        readItems('news_items', {
          filter: { slug: { _eq: route.params.slug } },
          limit: 1,
        })
      )
      if (authResult?.length) return authResult
    } catch {
      // not authenticated or request failed
    }
  }

  return result
})
const item = computed(() => itemList.value?.[0] || null)

// Do not throw a fatal 404 on SSR — drafts are only visible to authenticated users
// and auth state is only known client-side. onMounted will re-fetch if needed.
const authChecked = ref(false)
onMounted(async () => {
  await initialize()
  canEdit.value = isAuthenticated.value
  watchEffect(() => { canEdit.value = isAuthenticated.value })

  // If item was not returned by the public token, try again with the auth client
  if (!item.value && isAuthenticated.value) {
    await refreshItemList()
  }
  authChecked.value = true
})

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
  return formatBerlinDate(iso, $locale)
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
  author: '',
  date_published: '',
  status: 'draft',
  image: '',
})

// Sync form when item loads or editOpen changes
watch([() => item.value, editOpen], () => {
  if (!item.value || !editOpen.value) return
  editForm.title = item.value.title || ''
  editForm.teaser = item.value.teaser || ''
  editForm.author = item.value.author || ''
  editForm.date_published = toDatetimeLocal(item.value.date_published)
  editForm.status = item.value.status || 'draft'
  editForm.image = item.value.image?.id || item.value.image || ''
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
      author: editForm.author || null,
      date_published: editForm.date_published ? new Date(editForm.date_published).toISOString() : null,
      status: editForm.status,
      image: editForm.image || null,
    }))
    await refreshNuxtData(`news-item-${route.params.slug}`)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err) {
    saveError.value = err?.errors?.[0]?.message || err?.message || $t('news.editor.save_error')
  } finally {
    saving.value = false
  }
}

useHead({ title: computed(() => item.value?.title || $t('news.type.news')) })
</script>
