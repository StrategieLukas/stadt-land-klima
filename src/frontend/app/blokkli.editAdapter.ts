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
} from '#blokkli/types'
import type {
  GetMediaLibraryFunction,
  MediaLibraryAddBlockEvent,
  MediaLibraryReplaceMediaEvent,
} from '#blokkli/adapter'
import {
  readItems,
  readFiles,
  createItem,
  updateItem,
  deleteItem,
  clearCache,
} from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'

type AdapterState = {
  blocks: FieldListItem[]
}

export default defineBlokkliEditAdapter<AdapterState>((ctx) => {
  const { $directus } = useNuxtApp()
  const config = useRuntimeConfig()
  const { isAuthenticated, getAuthenticatedClient } = useAuth()

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

  // --- Helper to move a block in the in-memory array ---

  function moveBlockInArray(uuid: string, afterUuid?: string): boolean {
    const blockIndex = state.blocks.findIndex((v) => v.uuid === uuid)
    if (blockIndex === -1) return false

    const block = state.blocks.splice(blockIndex, 1)[0]
    const afterIndex = afterUuid
      ? state.blocks.findIndex((v) => v.uuid === afterUuid)
      : -1

    if (afterIndex === -1) {
      if (!afterUuid) {
        state.blocks.unshift(block)
      } else {
        state.blocks.push(block)
      }
    } else {
      state.blocks.splice(afterIndex + 1, 0, block)
    }

    return true
  }

  // --- Default props per bundle ---

  function getPropsForNewBlock(bundle: string): Record<string, any> {
    switch (bundle) {
      case 'text':
        return { content: '<p>Text hier eingeben...</p>' }
      case 'heading':
        return { text: 'Neue Ueberschrift' }
      case 'image':
        return { imageId: '', alt: '', caption: '' }
      case 'cta':
        return {
          title: 'Handeln Sie jetzt!',
          text: 'Gemeinsam koennen wir den Klimaschutz vorantreiben.',
          primaryButtonText: 'Mehr erfahren',
          primaryButtonLink: '#',
        }
      case 'directus_page':
        return { pageSlug: ctx.value.entityUuid }
      default:
        return {}
    }
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
      // Purge Directus Redis cache so we always load fresh block data
      try {
        await getClient().request(clearCache())
      } catch (_) { /* non-critical */ }
      return loadBlocksFromDirectus()
    },

    /**
     * Map in-memory state to blokkli's MappedState.
     * Includes mutation tracking for publish/discard/undo UI.
     */
    mapState(s: AdapterState): MappedState {
      return {
        currentIndex: mutationIndex,
        mutations: [...mutationItems],
        currentUserIsOwner: true,
        ownerName: '',
        mutatedState: {
          mutatedOptions: s.blocks.reduce<
            Record<string, Record<string, any>>
          >((acc, block) => {
            acc[block.uuid] = {}
            Object.entries(block.options || {}).forEach(([key, value]) => {
              acc[block.uuid][key] = value
            })
            return acc
          }, {}),
          fields: [
            {
              name: 'content',
              entityType: ctx.value.entityType,
              entityUuid: ctx.value.entityUuid,
              list: s.blocks.map((b) => ({ ...b })),
            },
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
        { id: 'text', label: 'Text', description: 'Rich text content block' },
        {
          id: 'heading',
          label: 'Ueberschrift',
          description: 'Heading block',
        },
        {
          id: 'image',
          label: 'Bild',
          description: 'Image block with caption',
        },
        {
          id: 'cta',
          label: 'Call to Action',
          description: 'CTA block with buttons',
        },
        {
          id: 'directus_page',
          label: 'Directus Seite',
          description: 'Legacy HTML/Markdown content',
        },
      ])
    },

    getFieldConfig(): Promise<FieldConfig[]> {
      return Promise.resolve([
        {
          name: 'content',
          entityType: ctx.value.entityType,
          entityBundle: ctx.value.entityBundle,
          label: 'Inhalt',
          cardinality: -1,
          canEdit: true,
          allowedBundles: [
            'text',
            'heading',
            'image',
            'cta',
            'directus_page',
          ],
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
      const success = moveBlockInArray(e.item.uuid, e.afterUuid)
      if (success) {
        trackMutation("Move '" + e.item.itemBundle + "' block", e.item.uuid)
      }
      return Promise.resolve({ success, state })
    },

    moveMultipleBlocks(e: MoveMultipleBlocksEvent) {
      e.uuids.forEach((uuid) => moveBlockInArray(uuid, e.afterUuid))
      trackMutation('Move ' + e.uuids.length + ' blocks')
      return ok()
    },

    deleteBlocks(uuids: string[]) {
      state.blocks = state.blocks.filter((v) => !uuids.includes(v.uuid))
      trackMutation('Delete ' + uuids.length + ' block(s)')
      return ok()
    },

    duplicateBlocks(uuids: string[]) {
      for (const uuid of uuids) {
        const original = state.blocks.find((v) => v.uuid === uuid)
        if (!original) continue

        const duplicate: FieldListItem = {
          uuid: crypto.randomUUID(),
          bundle: original.bundle,
          props: JSON.parse(JSON.stringify(original.props || {})),
          options: JSON.parse(JSON.stringify(original.options || {})),
        }

        const idx = state.blocks.indexOf(original)
        state.blocks.splice(idx + 1, 0, duplicate)
      }

      trackMutation('Duplicate ' + uuids.length + ' block(s)')
      return ok()
    },

    updateOptions(updates: Array<{ uuid: string; key: string; value: any }>) {
      for (const update of updates) {
        const block = state.blocks.find((v) => v.uuid === update.uuid)
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
      const block = state.blocks.find((v) => v.uuid === e.uuid)
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

      // Clear Directus Redis cache so subsequent reads get fresh data
      try {
        await getClient().request(clearCache())
      } catch (e) {
        console.warn('[blokkli] Directus cache clear failed:', e)
      }

      // Refresh Nuxt data cache so the page re-fetches blocks immediately
      await refreshNuxtData(`blocks-${ctx.value.entityUuid}`)

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
          name: 'title',
          entityType: 'block',
          entityBundle: 'cta',
          label: 'Titel',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
        {
          name: 'text',
          entityType: 'block',
          entityBundle: 'cta',
          label: 'Text',
          type: 'plain',
          required: false,
          maxLength: 0,
        },
      ])
    },

    getDroppableFieldConfig(): Promise<DroppableFieldConfig[]> {
      return Promise.resolve([
        {
          name: 'imageReference',
          label: 'Image',
          entityType: 'block',
          entityBundle: 'image',
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
        'library',
        'conversion',
        'translations',
        'assistant',
        'search',
      ])
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

      const afterIndex = e.preceedingUuid
        ? state.blocks.findIndex((v) => v.uuid === e.preceedingUuid)
        : -1

      if (afterIndex === -1) {
        state.blocks.push(newBlock)
      } else {
        state.blocks.splice(afterIndex + 1, 0, newBlock)
      }

      trackMutation('Add image block', newBlock.uuid)
      return ok()
    },

    mediaLibraryReplaceMedia(e: MediaLibraryReplaceMediaEvent) {
      const block = state.blocks.find((v) => v.uuid === e.host.uuid)
      if (block) {
        if (!block.props) block.props = {}
        block.props.imageId = e.mediaId
        trackMutation('Replace image', block.uuid)
      }
      return ok()
    },
  }
})
