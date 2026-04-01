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
} from '#blokkli/adapter'
import {
  readItems,
  readFiles,
  createItem,
  updateItem,
  deleteItem,
} from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'

type AdapterState = {
  blocks: FieldListItem[]
}

export default defineBlokkliEditAdapter<AdapterState>((ctx) => {
  const { $directus } = useNuxtApp()
  const config = useRuntimeConfig()
  const { isAuthenticated, getAuthenticatedClient, user } = useAuth()

  function getClient() {
    if (isAuthenticated.value) {
      return getAuthenticatedClient()
    }
    return $directus
  }

  // --- Typed Directus SDK wrappers ---

  async function fetchBlocks(query: Record<string, any>): Promise<any[]> {
    const cmd = (readItems as Function)('blocks', query)
    const result = await getClient().request(cmd)
    return Array.isArray(result) ? result : []
  }

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
  const blockIdMap = new Map<string, number>()

  // --- Mutation tracking ---

  let mutationIndex = -1
  const mutationItems: MutationItem[] = []

  // --- Initial state snapshot (for revert + publish diff) ---

  let initialBlocks: FieldListItem[] = []
  const initialBlockIds = new Map<string, number>()

  // --- Edit state tracking ---

  let editStateId: number | null = null
  let currentOwnerName = ''
  let isCurrentUserOwner = true

  function getCurrentUserName(): string {
    const u = user.value as any
    if (!u) return ''
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || ''
  }

  async function loadEditState(): Promise<void> {
    const entityType = ctx.value.entityType
    const entityUuid = ctx.value.entityUuid
    const myName = getCurrentUserName()

    try {
      const existing = await getClient().request(
        (readItems as Function)('edit_states', {
          filter: {
            entity_type: { _eq: entityType },
            entity_uuid: { _eq: entityUuid },
          },
          limit: 1,
        }),
      )

      if (Array.isArray(existing) && existing.length > 0) {
        const rec = existing[0]
        editStateId = rec.id
        currentOwnerName = rec.owner_name || ''
        // Current user owns it if the record has no owner or their name matches
        isCurrentUserOwner = !currentOwnerName || currentOwnerName === myName
      } else {
        // No edit state yet — claim ownership
        const created: any = await doCreateItem('edit_states', {
          entity_type: entityType,
          entity_uuid: entityUuid,
          entity_bundle: ctx.value.entityBundle,
          owner_name: myName,
          current_index: -1,
          mutations: [],
        })
        editStateId = created?.id ?? null
        currentOwnerName = myName
        isCurrentUserOwner = true
      }
    } catch (err) {
      console.error('[blokkli] loadEditState failed:', err)
      // Fall back to allowing edit so a broken edit_states table doesn't lock the editor
      isCurrentUserOwner = true
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
  }

  // --- Load blocks from Directus ---

  async function loadBlocksFromDirectus(): Promise<AdapterState> {
    const blocks = await fetchBlocks({
      filter: {
        entity_type: { _eq: ctx.value.entityType },
        entity_uuid: { _eq: ctx.value.entityUuid },
        status: { _neq: 'archived' },
      },
      sort: ['sort_order'],
      limit: -1,
    })

    state.blocks = []
    blockIdMap.clear()

    for (const block of blocks) {
      if (!block.uuid || !block.bundle) continue
      state.blocks.push({
        uuid: block.uuid,
        bundle: block.bundle,
        options: block.options || {},
        props: block.props || {},
      })
      blockIdMap.set(block.uuid, block.id)
    }

    // Save initial snapshot for revert/publish
    initialBlocks = JSON.parse(JSON.stringify(state.blocks))
    initialBlockIds.clear()
    for (const [uuid, id] of blockIdMap) {
      initialBlockIds.set(uuid, id)
    }

    return state
  }

  // --- Default props per bundle ---

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
        return { title: 'Überschrift', subtitle: '', imageId: '' }
      case 'citation':
        return { quote: 'Zitat...', attribution: '', source: '', imageId: '' }
      case 'stat':
        return { value: '100%', unit: '', label: 'Kennzahl', description: '' }
      case 'vega_chart':
        return { spec: '', query: '' }
      case 'timeline':
        return { title: '', items: [] }
      case 'timeline_item':
        return { date: '', title: 'Meilenstein', description: '' }
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
      default:
        return {}
    }
  }

  /** All prop keys that may contain nested FieldListItem arrays. */
  const NESTED_FIELD_KEYS = ['blocks', 'items', 'slides', 'hexagons']

  /** Return all nested FieldListItem arrays for a block. */
  function getNestedLists(block: FieldListItem): FieldListItem[][] {
    return NESTED_FIELD_KEYS
      .map((key) => (block.props as any)?.[key])
      .filter((v): v is FieldListItem[] => Array.isArray(v))
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
      await loadEditState()
      return loadBlocksFromDirectus()
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
        timeline: ['items'],
        hex_grid: ['hexagons'],
        carousel: ['slides'],
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
        { id: 'heading', label: 'Ueberschrift', description: 'Heading block', allowReusable: true },
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
        { id: 'from_library', label: 'From Library', description: 'Reusable block from the library' },
      ])
    },

    getFieldConfig(): Promise<FieldConfig[]> {
      const allowedInRoot = ['text', 'richtext', 'heading', 'image', 'button', 'container', 'directus_page', 'video', 'hero', 'citation', 'stat', 'vega_chart', 'timeline', 'carousel', 'progress_bar', 'page_nav', 'hex_grid', 'projects_carousel', 'municipality_search_hero', 'from_library']
      const allowedInContainer = ['text', 'richtext', 'heading', 'image', 'button', 'container', 'video', 'citation', 'stat', 'vega_chart', 'timeline', 'carousel', 'progress_bar', 'hex_grid', 'projects_carousel', 'from_library']
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
          name: 'items',
          entityType: 'block',
          entityBundle: 'timeline',
          label: 'Einträge',
          cardinality: -1,
          canEdit: true,
          allowedBundles: ['timeline_item'],
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
        block.props[e.fieldName] = e.fieldValue
        trackMutation("Edit '" + block.bundle + "' block", block.uuid)
      }
      return ok()
    },

    /**
     * Revert all changes: restore from initial snapshot and clear mutations.
     */
    async revertAllChanges() {
      state.blocks = JSON.parse(JSON.stringify(initialBlocks))
      blockIdMap.clear()
      for (const [uuid, id] of initialBlockIds) {
        blockIdMap.set(uuid, id)
      }
      mutationIndex = -1
      mutationItems.length = 0
      return { success: true as const, state }
    },

    /**
     * Publish: persist current in-memory state to Directus, then reset mutations.
     */
    async publish() {
      const currentUuids = new Set(state.blocks.map((b) => b.uuid))

      // Delete blocks that were removed
      for (const [uuid, id] of initialBlockIds) {
        if (!currentUuids.has(uuid)) {
          try {
            await doDeleteItem('blocks', id)
          } catch (err) {
            console.error('[blokkli] publish delete failed:', err)
          }
        }
      }

      // Create or update all current blocks
      for (let i = 0; i < state.blocks.length; i++) {
        const block = state.blocks[i]
        const existingId = blockIdMap.get(block.uuid)
        try {
          if (existingId) {
            await doUpdateItem('blocks', existingId, {
              sort_order: i,
              status: 'published',
              props: block.props || {},
              options: block.options || {},
            })
          } else {
            const result: any = await doCreateItem('blocks', {
              uuid: block.uuid,
              bundle: block.bundle,
              entity_type: ctx.value.entityType,
              entity_uuid: ctx.value.entityUuid,
              field_name: 'content',
              sort_order: i,
              status: 'published',
              props: block.props || {},
              options: block.options || {},
            })
            if (result?.id) {
              blockIdMap.set(block.uuid, result.id)
            }
          }
        } catch (err) {
          console.error('[blokkli] publish create/update failed:', err)
        }
      }

      // Save new initial state and reset mutations
      initialBlocks = JSON.parse(JSON.stringify(state.blocks))
      initialBlockIds.clear()
      for (const [uuid, id] of blockIdMap) {
        initialBlockIds.set(uuid, id)
      }
      mutationIndex = -1
      mutationItems.length = 0

      // Refresh Nuxt data cache so the page re-fetches blocks immediately
      // (Directus Redis cache is auto-purged on mutation via CACHE_AUTO_PURGE=true)
      await refreshNuxtData(`blocks-${ctx.value.entityUuid}`)

      // Clean up edit state on successful publish
      if (editStateId) {
        try {
          await doDeleteItem('edit_states', editStateId)
          editStateId = null
          currentOwnerName = ''
          isCurrentUserOwner = true
        } catch (err) {
          console.warn('[blokkli] Failed to delete edit state after publish:', err)
        }
      }

      return { success: true as const, state }
    },

    async takeOwnership() {
      const myName = getCurrentUserName()
      try {
        if (editStateId) {
          await doUpdateItem('edit_states', editStateId, {
            owner_name: myName,
            current_index: mutationIndex,
          })
        } else {
          const created: any = await doCreateItem('edit_states', {
            entity_type: ctx.value.entityType,
            entity_uuid: ctx.value.entityUuid,
            entity_bundle: ctx.value.entityBundle,
            owner_name: myName,
            current_index: mutationIndex,
            mutations: [],
          })
          editStateId = created?.id ?? null
        }
        currentOwnerName = myName
        isCurrentUserOwner = true
      } catch (err) {
        console.error('[blokkli] takeOwnership failed:', err)
        return { success: false as const, state }
      }
      return { success: true as const, state }
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
          type: 'plain',
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
          type: 'plain',
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
        {
          name: 'description',
          entityType: 'block',
          entityBundle: 'timeline_item',
          label: 'Beschreibung',
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
        if (Array.isArray(cloned.blocks)) {
          cloned.blocks = cloned.blocks.map((nested: any) => ({
            ...nested,
            uuid: crypto.randomUUID(),
            props: cloneWithNewUuids(nested.props || {}),
          }))
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
      let targetList: FieldListItem[]
      if (e.host.type === 'block' && e.host.fieldName === 'blocks') {
        const container = findBlock(e.host.uuid, state.blocks)
        if (container) {
          if (!Array.isArray((container.props as any).blocks)) {
            ;(container.props as any).blocks = []
          }
          targetList = (container.props as any).blocks
        } else {
          targetList = state.blocks
        }
      } else {
        targetList = state.blocks
      }

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
      const files = await getClient().request(
        readFiles({
          filter: { type: { _starts_with: 'image/' } } as any,
          sort: ['-uploaded_on'] as any,
          limit: 24,
          page: e.page,
          fields: ['id', 'title', 'filename_download'] as any,
        }),
      )
      return {
        filters: {},
        items: (files || []).map((file: any) => ({
          mediaId: file.id,
          label: file.title || file.filename_download,
          context: 'directus',
          targetBundles: ['image'],
          mediaBundle: 'image',
          thumbnail: `${config.public.clientDirectusUrl}/assets/${file.id}?width=200&quality=70`,
        })),
        total: (files || []).length,
        perPage: 24,
      }
    }) as GetMediaLibraryFunction,

    mediaLibraryAddBlock(e: MediaLibraryAddBlockEvent) {
      const newBlock: FieldListItem = {
        uuid: crypto.randomUUID(),
        bundle: 'image',
        props: { imageId: e.item.mediaId },
        options: {},
      }

      const insertInto = state.blocks
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
