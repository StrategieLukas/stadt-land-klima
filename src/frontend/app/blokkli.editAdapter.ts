/**
 * blökkli Edit Adapter for Directus
 *
 * Maintains an in-memory block list, tracks mutations for undo/redo and
 * publish/discard, and only persists to Directus on publish.
 */

import { defineBlokkliEditAdapter } from '#blokkli/adapter'
import type {
  MappedState,
  MutationItem,
  FieldListItem,
  FieldConfig,
  EditableFieldConfig,
  DroppableFieldConfig,
  BlockBundleDefinition,
  AddNewBlockEvent,
  MoveBlockEvent,
  MoveMultipleBlocksEvent,
  UpdateFieldValueEvent,
  MutatedField,
  MakeReusableEvent,
  DetachReusableBlockEvent,
  AddReusableItemEvent,
  LibraryItem,
} from '#blokkli/types'
import type {
  GetMediaLibraryFunction,
  MediaLibraryAddBlockEvent,
  MediaLibraryReplaceMediaEvent,
  BlokkliAdapterGetLibraryItemsData,
  BlokkliAdapterGetLibraryItemsResult,
  BlokkliAdapterPublishOptions,
} from '#blokkli/adapter'
import {
  readItems,
  readFiles,
  createItem,
  updateItem,
  deleteItem,
  customEndpoint,
} from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'
import { useAuthStore } from '~/stores/auth'
import {
  BLOKKLI_CONTENT_FIELD,
  getBlokkliDataKey,
  mapBlokkliBlocks,
} from '~/shared/blokkliPersistence'

type AdapterState = {
  blocks: FieldListItem[]
}

type PersistenceResponse = {
  blocks: FieldListItem[]
  revision: string
}

type StoredDraft = {
  blocks: FieldListItem[]
  mutations: MutationItem[]
  currentIndex: number
  baseRevision: string
  updatedAt: string
  ownerId: string
}

export default defineBlokkliEditAdapter<AdapterState>((ctx) => {
  const { $directus, $t } = useNuxtApp()
  const config = useRuntimeConfig()
  const { isAuthenticated, getAuthenticatedClient, user } = useAuth()

  function getClient() {
    if (isAuthenticated.value) {
      return getAuthenticatedClient()
    }
    return $directus
  }

  // --- Typed Directus SDK wrappers ---

  function doCreateItem(collection: string, data: Record<string, any>) {
    return getClient().request((createItem as Function)(collection, data))
  }

  function doUpdateItem(
    collection: string,
    id: any,
    data: Record<string, any>,
  ) {
    return getClient().request((updateItem as Function)(collection, id, data))
  }

  function doDeleteItem(collection: string, id: any) {
    return getClient().request((deleteItem as Function)(collection, id))
  }

  // --- In-memory state ---

  const state: AdapterState = { blocks: [] }

  // --- Mutation tracking ---

  let mutationIndex = -1
  const mutationItems: MutationItem[] = []

  // --- Initial state snapshot (for revert + publish diff) ---

  let initialBlocks: FieldListItem[] = []
  let baseRevision = ''

  // --- Edit state tracking ---

  let editStateId: number | null = null
  let currentOwnerName = ''
  let isCurrentUserOwner = true
  let editStateDateUpdated = 0
  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null
  let draftWriteQueue: Promise<void> = Promise.resolve()

  function cloneBlocks(blocks: FieldListItem[]): FieldListItem[] {
    return JSON.parse(JSON.stringify(blocks))
  }

  function getCurrentUserName(): string {
    const u = user.value as any
    if (!u) return ''
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || ''
  }

  function getCurrentUserId(): string {
    return String((user.value as any)?.id || '')
  }

  function getLocalDraftKey(): string {
    return `slk:blokkli-draft:${ctx.value.entityType}:${ctx.value.entityUuid}`
  }

  function parseStoredDraft(value: unknown): StoredDraft | null {
    if (!value || typeof value !== 'object') return null
    const candidate = value as Partial<StoredDraft>
    if (!Array.isArray(candidate.blocks)) return null

    return {
      blocks: mapBlokkliBlocks(candidate.blocks) as FieldListItem[],
      mutations: Array.isArray(candidate.mutations) ? candidate.mutations : [],
      currentIndex: Number.isInteger(candidate.currentIndex) ? candidate.currentIndex! : -1,
      baseRevision: typeof candidate.baseRevision === 'string' ? candidate.baseRevision : '',
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : '',
      ownerId: typeof candidate.ownerId === 'string' ? candidate.ownerId : '',
    }
  }

  function loadLocalDraft(): StoredDraft | null {
    if (!import.meta.client) return null
    try {
      const raw = window.localStorage.getItem(getLocalDraftKey())
      const draft = raw ? parseStoredDraft(JSON.parse(raw)) : null
      return draft?.ownerId === getCurrentUserId() ? draft : null
    } catch (err) {
      console.warn('[blokkli] Failed to read local draft backup:', err)
      return null
    }
  }

  function saveLocalDraft(draft: StoredDraft) {
    if (!import.meta.client) return
    try {
      window.localStorage.setItem(getLocalDraftKey(), JSON.stringify(draft))
    } catch (err) {
      console.warn('[blokkli] Failed to write local draft backup:', err)
    }
  }

  function clearLocalDraft() {
    if (!import.meta.client) return
    try {
      window.localStorage.removeItem(getLocalDraftKey())
    } catch (err) {
      console.warn('[blokkli] Failed to clear local draft backup:', err)
    }
  }

  function draftSnapshot(): StoredDraft {
    return {
      blocks: cloneBlocks(state.blocks),
      mutations: JSON.parse(JSON.stringify(mutationItems)),
      currentIndex: mutationIndex,
      baseRevision,
      updatedAt: new Date().toISOString(),
      ownerId: getCurrentUserId(),
    }
  }

  async function persistDraftNow(): Promise<void> {
    if (!editStateId || !isCurrentUserOwner) return
    const snapshot = draftSnapshot()
    saveLocalDraft(snapshot)

    draftWriteQueue = draftWriteQueue
      .catch(() => undefined)
      .then(async () => {
        await doUpdateItem('edit_states', editStateId, {
          owner: getCurrentUserId() || null,
          owner_name: getCurrentUserName(),
          current_index: snapshot.currentIndex,
          mutations: snapshot.mutations,
          draft_blocks: snapshot.blocks,
          base_revision: snapshot.baseRevision,
        })
        editStateDateUpdated = Date.now()
      })
    return draftWriteQueue
  }

  function scheduleDraftSave() {
    if (!editStateId || !isCurrentUserOwner || !import.meta.client) return
    // Keep a synchronous browser copy even if the tab closes before the
    // debounced Directus autosave starts.
    saveLocalDraft(draftSnapshot())
    if (draftSaveTimer) window.clearTimeout(draftSaveTimer)
    draftSaveTimer = window.setTimeout(() => {
      draftSaveTimer = null
      void persistDraftNow().catch((err) => {
        console.error('[blokkli] Autosave failed; the in-browser draft is retained:', err)
      })
    }, 750)
  }

  async function flushDraftSave(): Promise<void> {
    if (draftSaveTimer && import.meta.client) {
      window.clearTimeout(draftSaveTimer)
      draftSaveTimer = null
      await persistDraftNow()
    } else {
      await draftWriteQueue
    }
  }

  async function loadEditState(): Promise<StoredDraft | null> {
    const entityType = ctx.value.entityType
    const entityUuid = ctx.value.entityUuid
    const myName = getCurrentUserName()
    const myId = getCurrentUserId()

    if (!isAuthenticated.value || !myId) {
      throw new Error('Authentication is required to load a Blökkli edit state.')
    }

    try {
      const existing = await getClient().request(
        (readItems as Function)('edit_states', {
          filter: {
            entity_type: { _eq: entityType },
            entity_uuid: { _eq: entityUuid },
          },
          fields: [
            'id',
            'owner',
            'owner_name',
            'current_index',
            'mutations',
            'draft_blocks',
            'base_revision',
            'date_updated',
          ],
          limit: 1,
        }),
      )

      if (Array.isArray(existing) && existing.length > 0) {
        const rec = existing[0]
        editStateId = rec.id
        currentOwnerName = rec.owner_name || ''
        const ownerId = typeof rec.owner === 'object' ? rec.owner?.id : rec.owner
        // Legacy states have no owner UUID, so retain the old name comparison once.
        isCurrentUserOwner = ownerId
          ? String(ownerId) === myId
          : !currentOwnerName || currentOwnerName === myName
        editStateDateUpdated = Date.parse(rec.date_updated || '') || 0

        // A foreign lock makes the editor read-only. Its private draft must not
        // replace the published state rendered for this user.
        if (!isCurrentUserOwner) return null

        const serverDraft = parseStoredDraft({
          blocks: rec.draft_blocks,
          mutations: rec.mutations,
          currentIndex: rec.current_index,
          baseRevision: rec.base_revision,
          updatedAt: rec.date_updated,
          ownerId: String(ownerId || ''),
        })
        const localDraft = loadLocalDraft()
        if (
          localDraft &&
          (!serverDraft || Date.parse(localDraft.updatedAt) > Date.parse(serverDraft.updatedAt))
        ) {
          return localDraft
        }
        return serverDraft
      } else {
        // No edit state yet — claim ownership
        const created: any = await doCreateItem('edit_states', {
          entity_type: entityType,
          entity_uuid: entityUuid,
          entity_bundle: ctx.value.entityBundle,
          owner: myId,
          owner_name: myName,
          current_index: -1,
          mutations: [],
          draft_blocks: null,
          base_revision: baseRevision,
        })
        editStateId = created?.id ?? null
        currentOwnerName = myName
        isCurrentUserOwner = true
        editStateDateUpdated = Date.now()
        return loadLocalDraft()
      }
    } catch (err) {
      console.error('[blokkli] loadEditState failed:', err)
      // Editing without a working lock/recovery state risks concurrent data loss.
      isCurrentUserOwner = false
      throw err
    }
  }

  /** Return success with current state. */
  function ok(): Promise<{ success: true; state: AdapterState }> {
    return Promise.resolve({ success: true, state })
  }

  /** Record a mutation for the history/undo UI. */
  function trackMutation(label: string, affectedUuid?: string) {
    // Clear any "future" mutations (if user had undone some)
    if (mutationIndex < mutationItems.length - 1) {
      mutationItems.splice(mutationIndex + 1)
    }
    mutationItems.push({
      timestamp: Math.floor(Date.now() / 1000).toString(),
      pluginId: label.toLowerCase().replace(/\s+/g, '_'),
      plugin: {
        label,
        affectedItemUuid: affectedUuid,
      },
    })
    mutationIndex = mutationItems.length - 1
    scheduleDraftSave()
  }

  // --- Load blocks from Directus ---

  async function loadBlocksFromDirectus(): Promise<AdapterState> {
    const query = new URLSearchParams({
      entity_type: ctx.value.entityType,
      entity_uuid: ctx.value.entityUuid,
      field_name: BLOKKLI_CONTENT_FIELD,
    })
    const result = await getClient().request(
      customEndpoint<PersistenceResponse>({
        path: `/blokkli-persistence/state?${query.toString()}`,
        method: 'GET',
      }),
    )

    state.blocks = mapBlokkliBlocks(result.blocks) as FieldListItem[]
    baseRevision = result.revision

    // Save initial snapshot for revert/publish
    initialBlocks = cloneBlocks(state.blocks)

    return state
  }

  // --- Default props per bundle ---

  function createNestedBlock(
    bundle: string,
    props: Record<string, any> = {},
    options: Record<string, any> = {},
  ): FieldListItem {
    return {
      uuid: crypto.randomUUID(),
      bundle,
      props,
      options,
    }
  }

  function getPropsForNewBlock(bundle: string): Record<string, any> {
    switch (bundle) {
      case 'text':
        return { content: '<p>Text hier eingeben...</p>' }
      case 'heading':
        return { text: 'Neue Überschrift' }
      case 'image':
        return { imageId: '', alt: '', caption: '' }
      case 'button':
        return { label: 'Button' }
      case 'richtext':
        return { content: '## Überschrift\n\nHier können Sie **Markdown** schreiben.' }
      case 'container':
        return { blocks: [] }
      case 'directus_page':
        return { pageSlug: ctx.value.entityUuid }
      case 'video':
        return { caption: '' }
      case 'hero':
        return { title: 'Überschrift', subtitle: '', imageId: '', blocks: [] }
      case 'citation':
        return { quote: 'Zitat...', attribution: '', source: '', imageId: '' }
      case 'stat':
        return { value: '100%', unit: '', label: 'Kennzahl', description: '' }
      case 'vega_chart':
        return { spec: '', query: '' }
      case 'timeline':
        return { title: '', items: [] }
      case 'timeline_item':
        return { date: '', title: 'Meilenstein', blocks: [] }
      case 'carousel':
        return { slides: [] }
      case 'progress_bar':
        return { label: 'Fortschritt', value: '0', unit: '%', description: '' }
      case 'page_nav':
        return {}
      case 'hex_grid':
        return { hexagons: [] }
      case 'hex_item':
        return { label: 'Hexagon', imageId: '' }
      case 'municipality_search_hero':
        return { title: 'Gemeinde finden', subtitle: 'Suche deine Gemeinde und entdecke deren Klimaschutz-Bewertung.' }
      case 'newsletter_signup':
        return { title: 'Newsletter abonnieren', description: 'Bleib auf dem Laufenden mit Neuigkeiten und Tipps zu kommunalem Klimaschutz.' }
      case 'donation_widget':
        return {}
      case 'form':
        return {
          title: 'Kontaktformular',
          description: '',
          successMessage: '',
          fields: [
            createNestedBlock('form_field', {
              label: [createNestedBlock('form_label', { text: 'Name', description: '' })],
            }),
            createNestedBlock(
              'form_field',
              {
                label: [createNestedBlock('form_label', { text: 'E-Mail', description: '' })],
              },
              { fieldType: 'email', required: true },
            ),
            createNestedBlock(
              'form_field',
              {
                label: [createNestedBlock('form_label', { text: 'Nachricht', description: '' })],
              },
              { fieldType: 'textarea', required: true },
            ),
          ],
        }
      case 'form_field':
        return {
          label: [createNestedBlock('form_label', { text: 'Feldbeschriftung', description: '' })],
        }
      case 'form_label':
        return { text: 'Feldbeschriftung', description: '' }
      case 'icon':
        return { iconifySlug: 'mdi:star', slkIcon: '' }
      default:
        return {}
    }
  }

  /** All prop keys that may contain nested FieldListItem arrays. */
  const NESTED_FIELD_KEYS = ['blocks', 'items', 'slides', 'hexagons', 'fields', 'label']

  /** Return all nested FieldListItem arrays for a block. */
  function getNestedLists(block: FieldListItem): FieldListItem[][] {
    return NESTED_FIELD_KEYS
      .map((key) => (block.props as any)?.[key])
      .filter((v): v is FieldListItem[] => Array.isArray(v))
  }

  /**
   * Contenteditable represents Enter in different ways across browsers. Keep
   * headings inline-only and turn those wrappers into explicit line breaks.
   */
  function normalizeInlineMarkup(value: unknown): string {
    if (typeof value !== 'string') return ''

    return value
      .replace(/<div><br\s*\/?>\s*<\/div>/gi, '<br>')
      .replace(/<\/?(?:div|p)(?:\s[^>]*)?>/gi, (tag) =>
        tag.startsWith('</') ? '' : '<br>',
      )
      .replace(/^(?:\s*<br>)+|(?:<br>\s*)+$/gi, '')
  }

  /** Find a block by uuid anywhere in the tree (root + all nested fields). */
  function findBlock(uuid: string, list: FieldListItem[]): FieldListItem | undefined {
    for (const block of list) {
      if (block.uuid === uuid) return block
      for (const nested of getNestedLists(block)) {
        const found = findBlock(uuid, nested)
        if (found) return found
      }
    }
    return undefined
  }

  /** Find the list that contains a given uuid (root or any nested field). */
  function findParentList(uuid: string, list: FieldListItem[]): FieldListItem[] | undefined {
    for (const block of list) {
      if (block.uuid === uuid) return list
      for (const nested of getNestedLists(block)) {
        const found = findParentList(uuid, nested)
        if (found) return found
      }
    }
    return undefined
  }

  /** Move a block within any list in the tree. */
  function moveBlockInTree(uuid: string, afterUuid?: string, hostUuid?: string, hostFieldName?: string): boolean {
    // Determine target container list
    let targetList: FieldListItem[]
    if (hostUuid && hostUuid !== ctx.value.entityUuid) {
      const container = findBlock(hostUuid, state.blocks)
      if (!container) return false
      const fieldKey = hostFieldName && NESTED_FIELD_KEYS.includes(hostFieldName) ? hostFieldName : 'blocks'
      if (!Array.isArray((container.props as any)[fieldKey])) {
        ;(container.props as any)[fieldKey] = []
      }
      targetList = (container.props as any)[fieldKey]
    } else {
      targetList = state.blocks
    }

    // Remove from wherever it lives
    const sourceList = findParentList(uuid, state.blocks)
    if (!sourceList) return false
    const sourceIdx = sourceList.findIndex((v) => v.uuid === uuid)
    if (sourceIdx === -1) return false
    const [block] = sourceList.splice(sourceIdx, 1)

    // Insert into target
    const afterIndex = afterUuid ? targetList.findIndex((v) => v.uuid === afterUuid) : -1
    if (afterIndex === -1) {
      if (!afterUuid) targetList.unshift(block)
      else targetList.push(block)
    } else {
      targetList.splice(afterIndex + 1, 0, block)
    }

    return true
  }

  function getTargetList(host: {
    type: string
    uuid: string
    fieldName?: string
  }): FieldListItem[] {
    if (
      host.type === 'block' &&
      host.uuid !== ctx.value.entityUuid &&
      host.fieldName &&
      NESTED_FIELD_KEYS.includes(host.fieldName)
    ) {
      const parent = findBlock(host.uuid, state.blocks)
      if (parent) {
        if (!Array.isArray((parent.props as any)[host.fieldName])) {
          ;(parent.props as any)[host.fieldName] = []
        }
        return (parent.props as any)[host.fieldName]
      }
    }

    return state.blocks
  }

  // ==========================================
  // Adapter methods
  // ==========================================

  return {
    /**
     * Load state from Directus. Resets mutation tracking.
     */
    async loadState(): Promise<AdapterState> {
      mutationIndex = -1
      mutationItems.length = 0
      await loadBlocksFromDirectus()
      const draft = await loadEditState()

      if (draft) {
        state.blocks = cloneBlocks(draft.blocks)
        mutationItems.push(...draft.mutations)
        mutationIndex = Math.min(
          Math.max(draft.currentIndex, -1),
          mutationItems.length - 1,
        )
        // Keep the revision on which the recovered draft was originally based.
        // A concurrent publish will then be detected instead of overwritten.
        if (draft.baseRevision) baseRevision = draft.baseRevision
      }

      return state
    },

    /**
     * Map in-memory state to blokkli's MappedState.
     * Includes mutation tracking for publish/discard/undo UI.
     */
    mapState(s: AdapterState): MappedState {
      // Collect mutated options for all blocks (including all nested fields)
      function collectOptions(list: FieldListItem[], acc: Record<string, Record<string, any>>) {
        for (const block of list) {
          acc[block.uuid] = {}
          Object.entries(block.options || {}).forEach(([key, value]) => {
            acc[block.uuid][key] = value
          })
          for (const fieldKey of NESTED_FIELD_KEYS) {
            const nested = (block.props as any)?.[fieldKey]
            if (Array.isArray(nested)) collectOptions(nested, acc)
          }
        }
        return acc
      }

      // Build extra nested fields for each block that contains nested lists
      const NESTED_FIELD_MAP: Record<string, string[]> = {
        container: ['blocks'],
        hero: ['blocks'],
        timeline: ['items'],
        timeline_item: ['blocks'],
        hex_grid: ['hexagons'],
        carousel: ['slides'],
        form: ['fields'],
        form_field: ['label'],
      }
      function collectContainerFields(list: FieldListItem[]): MutatedField[] {
        const fields: MutatedField[] = []
        for (const block of list) {
          const fieldKeys = NESTED_FIELD_MAP[block.bundle]
          if (fieldKeys) {
            for (const key of fieldKeys) {
              const nestedList: FieldListItem[] = (block.props as any)?.[key] || []
              fields.push({
                name: key,
                entityType: 'block',
                entityUuid: block.uuid,
                list: nestedList.map((b) => ({ ...b })),
              })
              fields.push(...collectContainerFields(nestedList))
            }
          }
        }
        return fields
      }

      return {
        currentIndex: mutationIndex,
        mutations: [...mutationItems],
        currentUserIsOwner: isCurrentUserOwner,
        ownerName: currentOwnerName,
        mutatedState: {
          mutatedOptions: collectOptions(s.blocks, {}),
          fields: [
            {
              name: 'content',
              entityType: ctx.value.entityType,
              entityUuid: ctx.value.entityUuid,
              list: s.blocks.map((b) => ({ ...b })),
            },
            ...collectContainerFields(s.blocks),
          ],
        },
        entity: {
          label: ctx.value.entityUuid,
          status: true,
          bundleLabel: ctx.value.entityBundle,
        },
        translationState: {
          isTranslatable: false,
        },
      }
    },

    getAllBundles(): Promise<BlockBundleDefinition[]> {
      return Promise.resolve([
        { id: 'text', label: 'Text', description: 'Rich text content block', allowReusable: true },
        { id: 'richtext', label: 'Markdown', description: 'Rich text with Markdown editor', allowReusable: true },
        { id: 'heading', label: 'Überschrift', description: 'Heading block', allowReusable: true },
        { id: 'image', label: 'Bild', description: 'Image block with caption', allowReusable: true },
        { id: 'button', label: 'Button', description: 'Button with internal page link', allowReusable: true },
        { id: 'container', label: 'Container', description: 'Layout container with nested blocks', allowReusable: true },
        { id: 'directus_page', label: 'Directus Seite', description: 'Legacy HTML/Markdown content', allowReusable: true },
        { id: 'video', label: 'Video', description: 'Eingebettetes Video (YouTube, Vimeo, MP4)', allowReusable: true },
        { id: 'hero', label: 'Hero', description: 'Großflächige Hero-Sektion mit Hintergrundbild', allowReusable: true },
        { id: 'citation', label: 'Zitat', description: 'Zitat oder Testimonial', allowReusable: true },
        { id: 'stat', label: 'Kennzahl', description: 'Statistische Kennzahl / Zahl', allowReusable: true },
        { id: 'vega_chart', label: 'Vega-Lite Chart', description: 'Datenvisualisierung mit Vega-Lite', allowReusable: true },
        { id: 'timeline', label: 'Zeitstrahl', description: 'Zeitstrahl mit Einträgen', allowReusable: true },
        { id: 'timeline_item', label: 'Zeitstrahl-Eintrag', description: 'Einzelner Eintrag im Zeitstrahl', allowReusable: false },
        { id: 'carousel', label: 'Karussell', description: 'Bild- oder Inhaltskarussell', allowReusable: true },
        { id: 'progress_bar', label: 'Fortschrittsbalken', description: 'Fortschrittsbalken mit Prozentanzeige', allowReusable: true },
        { id: 'page_nav', label: 'Seitennavigation', description: 'Horizontale Ankerlink-Navigation', allowReusable: true },
        { id: 'hex_grid', label: 'Honeyweb', description: 'Sechseck-Waben-Raster mit verlinkten Kacheln', allowReusable: true },
        { id: 'hex_item', label: 'Honeyweb-Kachel', description: 'Einzelne Kachel im Honeyweb', allowReusable: false },
        { id: 'projects_carousel', label: 'Projektkarussell', description: 'Automatisches Karussell der Erfolgsprojekte', allowReusable: true },
        { id: 'municipality_search_hero', label: 'Gemeinde-Suche', description: 'Vollflächen-Sektion mit Wortwolke und Gemeinde-Suchfeld', allowReusable: true },
        { id: 'newsletter_signup', label: 'Newsletter-Anmeldung', description: 'E-Mail-Anmeldeformular für Newsletter-Listen', allowReusable: true },
        { id: 'donation_widget', label: 'Spenden-Widget', description: 'betterplace.org Spenden-Widget', allowReusable: true },
        { id: 'form', label: 'Formular', description: 'Formular mit Feldern und Antwortspeicherung', allowReusable: true },
        { id: 'form_field', label: 'Formularfeld', description: 'Einzelnes Feld in einem Formular', allowReusable: false },
        { id: 'form_label', label: 'Formularbeschriftung', description: 'Beschriftung und Hilfetext für ein Formularfeld', allowReusable: false },
        { id: 'icon', label: 'Icon', description: 'Icon aus SLK-Bibliothek oder Iconify', allowReusable: true },
        { id: 'from_library', label: 'Aus Bibliothek', description: 'Wiederverwendbaren Block aus der Bibliothek einfügen' },
      ])
    },

    getFieldConfig(): Promise<FieldConfig[]> {
      const allowedInRoot = ['text', 'richtext', 'heading', 'image', 'button', 'container', 'directus_page', 'video', 'hero', 'citation', 'stat', 'vega_chart', 'timeline', 'carousel', 'progress_bar', 'page_nav', 'hex_grid', 'projects_carousel', 'municipality_search_hero', 'newsletter_signup', 'form', 'donation_widget', 'icon', 'from_library']
      const allowedInContainer = ['text', 'richtext', 'heading', 'image', 'button', 'container', 'video', 'citation', 'stat', 'vega_chart', 'timeline', 'carousel', 'progress_bar', 'hex_grid', 'projects_carousel', 'newsletter_signup', 'form', 'donation_widget', 'icon', 'from_library']
      const allowedInCarousel = allowedInRoot
      return Promise.resolve([
        {
          name: 'content',
          entityType: ctx.value.entityType,
          entityBundle: ctx.value.entityBundle,
          label: 'Inhalt',
          cardinality: -1,
          canEdit: true,
          allowedBundles: allowedInRoot,
        },
        {
          name: 'blocks',
          entityType: 'block',
          entityBundle: 'container',
          label: 'Blöcke',
          cardinality: -1,
          canEdit: true,
          allowedBundles: allowedInContainer,
        },
        {
          name: 'blocks',
          entityType: 'block',
          entityBundle: 'hero',
          label: 'Blöcke',
          cardinality: -1,
          canEdit: true,
          allowedBundles: allowedInContainer,
        },
        {
          name: 'items',
          entityType: 'block',
          entityBundle: 'timeline',
          label: 'Einträge',
          cardinality: -1,
          canEdit: true,
          allowedBundles: ['timeline_item'],
        },
        {
          name: 'blocks',
          entityType: 'block',
          entityBundle: 'timeline_item',
          label: 'Blöcke',
          cardinality: -1,
          canEdit: true,
          allowedBundles: allowedInContainer,
        },
        {
          name: 'slides',
          entityType: 'block',
          entityBundle: 'carousel',
          label: 'Folien',
          cardinality: -1,
          canEdit: true,
          allowedBundles: allowedInCarousel,
        },
        {
          name: 'hexagons',
          entityType: 'block',
          entityBundle: 'hex_grid',
          label: 'Hexagone',
          cardinality: 15,
          canEdit: true,
          allowedBundles: ['hex_item'],
        },
        {
          name: 'fields',
          entityType: 'block',
          entityBundle: 'form',
          label: 'Felder',
          cardinality: -1,
          canEdit: true,
          allowedBundles: ['form_field'],
        },
        {
          name: 'label',
          entityType: 'block',
          entityBundle: 'form_field',
          label: 'Beschriftung',
          cardinality: 1,
          canEdit: true,
          allowedBundles: ['form_label'],
        },
      ])
    },

    addNewBlock(e: AddNewBlockEvent) {
      const newBlock: FieldListItem = {
        uuid: crypto.randomUUID(),
        bundle: e.bundle,
        props: getPropsForNewBlock(e.bundle),
        options: {},
      }

      // Nested block field (container.blocks, timeline.items, carousel.slides, …)
      if (e.host.type === 'block' && e.host.fieldName && NESTED_FIELD_KEYS.includes(e.host.fieldName)) {
        const container = findBlock(e.host.uuid, state.blocks)
        if (container) {
          const fieldKey = e.host.fieldName
          if (!Array.isArray((container.props as any)[fieldKey])) {
            ;(container.props as any)[fieldKey] = []
          }
          const nestedList = (container.props as any)[fieldKey] as FieldListItem[]
          const afterIndex = e.afterUuid
            ? nestedList.findIndex((v) => v.uuid === e.afterUuid)
            : -1
          if (afterIndex === -1) nestedList.push(newBlock)
          else nestedList.splice(afterIndex + 1, 0, newBlock)
          trackMutation("Add '" + e.bundle + "' block", newBlock.uuid)
          return ok()
        }
      }

      // Root field
      const afterIndex = e.afterUuid
        ? state.blocks.findIndex((v) => v.uuid === e.afterUuid)
        : -1

      if (afterIndex === -1) {
        state.blocks.push(newBlock)
      } else {
        state.blocks.splice(afterIndex + 1, 0, newBlock)
      }

      trackMutation("Add '" + e.bundle + "' block", newBlock.uuid)
      return ok()
    },

    moveBlock(e: MoveBlockEvent) {
      const success = moveBlockInTree(e.item.uuid, e.afterUuid, e.host.uuid, (e.host as any).fieldName)
      if (success) {
        trackMutation("Move '" + e.item.itemBundle + "' block", e.item.uuid)
      }
      return Promise.resolve({ success, state })
    },

    moveMultipleBlocks(e: MoveMultipleBlocksEvent) {
      e.uuids.forEach((uuid) => moveBlockInTree(uuid, e.afterUuid, e.host.uuid))
      trackMutation('Move ' + e.uuids.length + ' blocks')
      return ok()
    },

    deleteBlocks(uuids: string[]) {
      function removeFromList(list: FieldListItem[]): FieldListItem[] {
        return list
          .filter((v) => !uuids.includes(v.uuid))
          .map((v) => {
            for (const key of NESTED_FIELD_KEYS) {
              const nested = (v.props as any)?.[key]
              if (Array.isArray(nested)) {
                ;(v.props as any)[key] = removeFromList(nested)
              }
            }
            return v
          })
      }
      state.blocks = removeFromList(state.blocks)
      trackMutation('Delete ' + uuids.length + ' block(s)')
      return ok()
    },

    duplicateBlocks(uuids: string[]) {
      function deepDuplicate(block: FieldListItem): FieldListItem {
        const dup: FieldListItem = {
          uuid: crypto.randomUUID(),
          bundle: block.bundle,
          props: JSON.parse(JSON.stringify(block.props || {})),
          options: JSON.parse(JSON.stringify(block.options || {})),
        }
        // Re-UUID nested blocks in all known nested fields
        for (const key of NESTED_FIELD_KEYS) {
          const nested = (dup.props as any)?.[key]
          if (Array.isArray(nested)) {
            ;(dup.props as any)[key] = nested.map(deepDuplicate)
          }
        }
        return dup
      }

      for (const uuid of uuids) {
        const parentList = findParentList(uuid, state.blocks) || state.blocks
        const original = parentList.find((v) => v.uuid === uuid)
        if (!original) continue
        const duplicate = deepDuplicate(original)
        const idx = parentList.indexOf(original)
        parentList.splice(idx + 1, 0, duplicate)
      }

      trackMutation('Duplicate ' + uuids.length + ' block(s)')
      return ok()
    },

    updateOptions(updates: Array<{ uuid: string; key: string; value: any }>) {
      for (const update of updates) {
        const block = findBlock(update.uuid, state.blocks)
        if (block) {
          if (!block.options) block.options = {}
          block.options[update.key] = update.value
        }
      }
      if (updates.length > 0) {
        trackMutation('Update options')
      }
      return ok()
    },

    updateFieldValue(e: UpdateFieldValueEvent) {
      const block = findBlock(e.uuid, state.blocks)
      if (block) {
        if (!block.props) block.props = {}
        const isInlineMarkup =
          (block.bundle === 'heading' && e.fieldName === 'text') ||
          (block.bundle === 'hero' && e.fieldName === 'title')
        block.props[e.fieldName] = isInlineMarkup
          ? normalizeInlineMarkup(e.fieldValue)
          : e.fieldValue
        trackMutation("Edit '" + block.bundle + "' block", block.uuid)
      }
      return ok()
    },

    /**
     * Revert all changes: restore from initial snapshot and clear mutations.
     */
    async revertAllChanges() {
      state.blocks = cloneBlocks(initialBlocks)
      mutationIndex = -1
      mutationItems.length = 0
      clearLocalDraft()
      if (editStateId) {
        try {
          await doUpdateItem('edit_states', editStateId, {
            current_index: -1,
            mutations: [],
            draft_blocks: null,
            base_revision: baseRevision,
          })
          editStateDateUpdated = Date.now()
        } catch (err) {
          console.error('[blokkli] Failed to discard recoverable draft:', err)
          return {
            success: false as const,
            state,
            errors: [$t('blokkli.editor.discard_draft_error')],
          }
        }
      }
      return { success: true as const, state }
    },

    /**
     * Publish: persist current in-memory state to Directus, then reset mutations.
     */
    async publish(options: BlokkliAdapterPublishOptions = {}) {
      try {
        // Ensure the recoverable copy contains the exact state being published.
        await flushDraftSave()
      } catch (err) {
        console.warn('[blokkli] Server autosave failed before publish; local backup remains:', err)
      }

      let result: PersistenceResponse
      try {
        result = await getClient().request(
          customEndpoint<PersistenceResponse>({
            path: '/blokkli-persistence/publish',
            method: 'POST',
            body: JSON.stringify({
              entityType: ctx.value.entityType,
              entityUuid: ctx.value.entityUuid,
              fieldName: BLOKKLI_CONTENT_FIELD,
              baseRevision,
              blocks: state.blocks,
            }),
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      } catch (err: any) {
        console.error('[blokkli] Atomic publish failed; draft was retained:', err)
        const status = err?.response?.status || err?.status
        const message = $t(
          status === 409
            ? 'blokkli.editor.publish_conflict'
            : 'blokkli.editor.publish_error',
        )
        return { success: false as const, state, errors: [message] }
      }

      state.blocks = mapBlokkliBlocks(result.blocks) as FieldListItem[]
      baseRevision = result.revision
      initialBlocks = cloneBlocks(state.blocks)
      mutationIndex = -1
      mutationItems.length = 0

      // Do not immediately re-fetch through a possibly stale shared API cache.
      // Put the transaction's canonical response directly into this page's data.
      const dataKey = getBlokkliDataKey(ctx.value.entityType, ctx.value.entityUuid)
      const pageData = useNuxtData<FieldListItem[]>(dataKey)
      pageData.data.value = cloneBlocks(state.blocks)
      clearLocalDraft()

      // Clean up edit state on successful publish
      if (editStateId) {
        if (options.closeAfterPublish) {
          try {
            await doDeleteItem('edit_states', editStateId)
            editStateId = null
            currentOwnerName = ''
            isCurrentUserOwner = true
          } catch (err) {
            console.warn('[blokkli] Failed to delete edit state after publish:', err)
          }
        }

        // When the editor stays open, retain its lock and reset the recoverable
        // draft to the newly published revision. Subsequent edits then continue
        // to be autosaved instead of becoming memory-only again.
        if (editStateId) {
          try {
            await doUpdateItem('edit_states', editStateId, {
              current_index: -1,
              mutations: [],
              draft_blocks: null,
              base_revision: baseRevision,
            })
            editStateDateUpdated = Date.now()
          } catch (cleanupError) {
            console.warn('[blokkli] Failed to clear edit state after publish:', cleanupError)
          }
        }
      }

      return { success: true as const, state }
    },

    async takeOwnership() {
      const myName = getCurrentUserName()
      try {
        if (editStateId) {
          await doUpdateItem('edit_states', editStateId, {
            owner: getCurrentUserId() || null,
            owner_name: myName,
            current_index: mutationIndex,
          })
        } else {
          const created: any = await doCreateItem('edit_states', {
            entity_type: ctx.value.entityType,
            entity_uuid: ctx.value.entityUuid,
            entity_bundle: ctx.value.entityBundle,
            owner: getCurrentUserId() || null,
            owner_name: myName,
            current_index: mutationIndex,
            mutations: [],
            draft_blocks: state.blocks,
            base_revision: baseRevision,
          })
          editStateId = created?.id ?? null
        }
        currentOwnerName = myName
        isCurrentUserOwner = true
        await persistDraftNow()
      } catch (err) {
        console.error('[blokkli] takeOwnership failed:', err)
        return { success: false as const, state }
      }
      return { success: true as const, state }
    },

    getLastChanged() {
      return Promise.resolve(editStateDateUpdated)
    },

    getEditableFieldConfig(): Promise<EditableFieldConfig[]> {
      return Promise.resolve([
        {
          name: 'content',
          entityType: 'block',
          entityBundle: 'text',
          label: 'Inhalt',
          type: 'markup',
          required: false,
          maxLength: 0,
        },
        {
          name: 'text',
          entityType: 'block',
          entityBundle: 'heading',
          label: 'Text',
          type: 'markup',
          required: false,
          maxLength: 0,
        },
        {
          name: 'label',
          entityType: 'block',
          entityBundle: 'button',
          label: 'Button Text',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'content',
          entityType: 'block',
          entityBundle: 'richtext',
          label: 'Markdown Inhalt',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'caption',
          entityType: 'block',
          entityBundle: 'image',
          label: 'Bildunterschrift',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // video
        {
          name: 'caption',
          entityType: 'block',
          entityBundle: 'video',
          label: 'Bildunterschrift',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // hero
        {
          name: 'title',
          entityType: 'block',
          entityBundle: 'hero',
          label: 'Titel',
          type: 'markup',
          required: false,
          maxLength: 0,
        },
        {
          name: 'subtitle',
          entityType: 'block',
          entityBundle: 'hero',
          label: 'Untertitel',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // citation
        {
          name: 'quote',
          entityType: 'block',
          entityBundle: 'citation',
          label: 'Zitat',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'attribution',
          entityType: 'block',
          entityBundle: 'citation',
          label: 'Person',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'source',
          entityType: 'block',
          entityBundle: 'citation',
          label: 'Quelle',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // stat
        {
          name: 'value',
          entityType: 'block',
          entityBundle: 'stat',
          label: 'Wert',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'unit',
          entityType: 'block',
          entityBundle: 'stat',
          label: 'Einheit',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'label',
          entityType: 'block',
          entityBundle: 'stat',
          label: 'Bezeichnung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'description',
          entityType: 'block',
          entityBundle: 'stat',
          label: 'Beschreibung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // vega_chart
        {
          name: 'spec',
          entityType: 'block',
          entityBundle: 'vega_chart',
          label: 'Vega-Lite Spezifikation',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'query',
          entityType: 'block',
          entityBundle: 'vega_chart',
          label: 'Daten-Query',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // timeline
        {
          name: 'title',
          entityType: 'block',
          entityBundle: 'timeline',
          label: 'Titel',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // timeline_item
        {
          name: 'date',
          entityType: 'block',
          entityBundle: 'timeline_item',
          label: 'Datum / Jahr',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'title',
          entityType: 'block',
          entityBundle: 'timeline_item',
          label: 'Titel',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // projects_carousel
        {
          name: 'label',
          entityType: 'block',
          entityBundle: 'projects_carousel',
          label: 'Kategorie-Label',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'heading',
          entityType: 'block',
          entityBundle: 'projects_carousel',
          label: 'Überschrift',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'linkText',
          entityType: 'block',
          entityBundle: 'projects_carousel',
          label: 'Link-Text',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // progress_bar
        {
          name: 'label',
          entityType: 'block',
          entityBundle: 'progress_bar',
          label: 'Bezeichnung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'value',
          entityType: 'block',
          entityBundle: 'progress_bar',
          label: 'Wert (0–100)',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'unit',
          entityType: 'block',
          entityBundle: 'progress_bar',
          label: 'Einheit',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'description',
          entityType: 'block',
          entityBundle: 'progress_bar',
          label: 'Beschreibung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // hex_item
        {
          name: 'label',
          entityType: 'block',
          entityBundle: 'hex_item',
          label: 'Bezeichnung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // newsletter_signup
        {
          name: 'title',
          entityType: 'block',
          entityBundle: 'newsletter_signup',
          label: 'Titel',
          type: 'plain',
          required: true,
          maxLength: 0,
        },
        {
          name: 'description',
          entityType: 'block',
          entityBundle: 'newsletter_signup',
          label: 'Beschreibung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        // form
        {
          name: 'title',
          entityType: 'block',
          entityBundle: 'form',
          label: 'Titel',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'description',
          entityType: 'block',
          entityBundle: 'form',
          label: 'Beschreibung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'successMessage',
          entityType: 'block',
          entityBundle: 'form',
          label: 'Erfolgsmeldung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'text',
          entityType: 'block',
          entityBundle: 'form_label',
          label: 'Beschriftung',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'description',
          entityType: 'block',
          entityBundle: 'form_label',
          label: 'Hilfetext',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
      ])
    },

    getDroppableFieldConfig(): Promise<DroppableFieldConfig[]> {
      return Promise.resolve([
        {
          name: 'imageId',
          label: 'Bild',
          entityType: 'block',
          entityBundle: 'image',
          allowedEntityType: 'media',
          allowedBundles: ['image'],
          cardinality: 1,
          required: false,
        },
        {
          name: 'imageId',
          label: 'Hintergrundbild',
          entityType: 'block',
          entityBundle: 'hero',
          allowedEntityType: 'media',
          allowedBundles: ['image'],
          cardinality: 1,
          required: false,
        },
        {
          name: 'imageId',
          label: 'Portraitbild',
          entityType: 'block',
          entityBundle: 'citation',
          allowedEntityType: 'media',
          allowedBundles: ['image'],
          cardinality: 1,
          required: false,
        },
        {
          name: 'imageId',
          label: 'Hintergrundbild',
          entityType: 'block',
          entityBundle: 'hex_item',
          allowedEntityType: 'media',
          allowedBundles: ['image'],
          cardinality: 1,
          required: false,
        },
      ])
    },

    getDisabledFeatures(): Promise<string[]> {
      return Promise.resolve([
        'comments',
        'import',
        'conversion',
        'translations',
        'assistant',
        'search',
      ])
    },

    // --- Library (reusable blocks) ---

    async getLibraryItems(data: BlokkliAdapterGetLibraryItemsData): Promise<BlokkliAdapterGetLibraryItemsResult> {
      const perPage = 20
      const filter: Record<string, any> = {}
      if (data.bundles && data.bundles.length > 0) {
        filter.bundle = { _in: data.bundles }
      }
      if (data.text) {
        filter.label = { _contains: data.text }
      }

      const items = await getClient().request(
        (readItems as Function)('library_items', {
          filter,
          sort: ['-date_created'],
          limit: perPage,
          page: data.page,
          fields: ['id', 'uuid', 'label', 'bundle', 'props', 'options'],
        }),
      )

      return {
        items: (Array.isArray(items) ? items : []).map((item: any): LibraryItem => ({
          uuid: item.uuid,
          label: item.label,
          bundle: item.bundle,
          item: {
            uuid: item.uuid,
            bundle: item.bundle,
            props: item.props || {},
            options: item.options || {},
          },
        })),
        total: Array.isArray(items) ? items.length : 0,
        perPage,
      }
    },

    async makeBlockReusable(e: MakeReusableEvent) {
      const block = findBlock(e.uuid, state.blocks)
      if (!block) {
        return { success: false as const, state }
      }

      const libraryUuid = crypto.randomUUID()
      await doCreateItem('library_items', {
        uuid: libraryUuid,
        label: e.label,
        bundle: block.bundle,
        props: JSON.parse(JSON.stringify(block.props || {})),
        options: JSON.parse(JSON.stringify(block.options || {})),
      })

      trackMutation('Make block reusable', e.uuid)
      return ok()
    },

    async addLibraryItem(e: AddReusableItemEvent) {
      // Fetch library item from Directus
      const items = await getClient().request(
        (readItems as Function)('library_items', {
          filter: { uuid: { _eq: e.libraryItemUuid } },
          limit: 1,
          fields: ['uuid', 'bundle', 'props', 'options'],
        }),
      )

      if (!Array.isArray(items) || items.length === 0) {
        return { success: false as const, state }
      }

      const libItem = items[0]

      // Deep-clone and assign new UUIDs to the block (and any nested blocks)
      function cloneWithNewUuids(props: Record<string, any>): Record<string, any> {
        const cloned = JSON.parse(JSON.stringify(props))
        for (const key of NESTED_FIELD_KEYS) {
          if (Array.isArray(cloned[key])) {
            cloned[key] = cloned[key].map((nested: any) => ({
              ...nested,
              uuid: crypto.randomUUID(),
              props: cloneWithNewUuids(nested.props || {}),
            }))
          }
        }
        return cloned
      }

      const newBlock: FieldListItem = {
        uuid: crypto.randomUUID(),
        bundle: libItem.bundle,
        props: cloneWithNewUuids(libItem.props || {}),
        options: JSON.parse(JSON.stringify(libItem.options || {})),
      }

      // Insert into the right location
      const targetList = getTargetList(e.host)

      const afterIndex = e.afterUuid
        ? targetList.findIndex((v) => v.uuid === e.afterUuid)
        : -1

      if (afterIndex === -1) {
        targetList.push(newBlock)
      } else {
        targetList.splice(afterIndex + 1, 0, newBlock)
      }

      trackMutation('Add library item', newBlock.uuid)
      return ok()
    },

    async detachReusableBlock(e: DetachReusableBlockEvent) {
      // In our implementation blocks placed from the library are already
      // independent copies (deep-cloned with new UUIDs), so detaching is a
      // no-op — we just track the mutation for the UI.
      trackMutation('Detach reusable block')
      return ok()
    },

    mediaLibraryGetResults: (async (e) => {
      const PER_PAGE = 24
      // e.page is 0-based (blökkli internal); Directus uses offset instead
      const offset = e.page * PER_PAGE
      const search = typeof e.filters.search === 'string'
        ? e.filters.search.trim()
        : ''
      const filter: Record<string, any> = {
        type: { _starts_with: 'image/' },
      }
      if (search) {
        filter._or = [
          { title: { _icontains: search } },
          { filename_download: { _icontains: search } },
          { description: { _icontains: search } },
        ]
      }
      // Fetch one extra item to detect if a next page exists (sentinel approach)
      const files = await getClient().request(
        readFiles({
          filter: filter as any,
          sort: ['-uploaded_on'] as any,
          limit: PER_PAGE + 1,
          offset,
          fields: ['id', 'title', 'filename_download'] as any,
        }),
      )
      const fileList = files || []
      const hasMore = fileList.length > PER_PAGE
      const pageItems = hasMore ? fileList.slice(0, PER_PAGE) : fileList
      // total must be large enough so blökkli shows a next-page button when hasMore
      const total = hasMore
        ? offset + PER_PAGE + 1
        : offset + fileList.length

      // Append access_token so Directus serves protected assets without 403
      const authStore = useAuthStore()
      const token = authStore._accessToken.value
      const tokenParam = token ? `&access_token=${encodeURIComponent(token)}` : ''

      return {
        filters: {
          search: {
            type: 'text',
            placeholder: $t('blokkli.media.search_placeholder'),
          },
        },
        items: pageItems.map((file: any) => ({
          mediaId: file.id,
          label: file.title || file.filename_download,
          context: 'directus',
          targetBundles: ['image'],
          mediaBundle: 'image',
          thumbnail: `${config.public.clientDirectusUrl}/assets/${file.id}?width=200&quality=70${tokenParam}`,
        })),
        total,
        perPage: PER_PAGE,
      }
    }) as GetMediaLibraryFunction,

    mediaLibraryAddBlock(e: MediaLibraryAddBlockEvent) {
      const newBlock: FieldListItem = {
        uuid: crypto.randomUUID(),
        bundle: 'image',
        props: { imageId: e.item.mediaId },
        options: {},
      }

      const insertInto = getTargetList(e.host)
      const afterIndex = e.preceedingUuid
        ? insertInto.findIndex((v) => v.uuid === e.preceedingUuid)
        : -1

      if (afterIndex === -1) insertInto.push(newBlock)
      else insertInto.splice(afterIndex + 1, 0, newBlock)

      trackMutation('Add image block', newBlock.uuid)
      return ok()
    },

    mediaLibraryReplaceMedia(e: MediaLibraryReplaceMediaEvent) {
      const block = findBlock(e.host.uuid, state.blocks)
      if (block) {
        if (!block.props) block.props = {}
        block.props.imageId = e.mediaId
        trackMutation('Replace image', block.uuid)
      }
      return ok()
    },
  }
})
