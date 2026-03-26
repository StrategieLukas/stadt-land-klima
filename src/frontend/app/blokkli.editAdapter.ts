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
      default:
        return {}
    }
  }

  /** Find a block by uuid anywhere in the tree (root + nested containers). */
  function findBlock(uuid: string, list: FieldListItem[]): FieldListItem | undefined {
    for (const block of list) {
      if (block.uuid === uuid) return block
      const nested = (block.props as any)?.blocks
      if (Array.isArray(nested)) {
        const found = findBlock(uuid, nested)
        if (found) return found
      }
    }
    return undefined
  }

  /** Find the list that contains a given uuid (root or nested). */
  function findParentList(uuid: string, list: FieldListItem[]): FieldListItem[] | undefined {
    for (const block of list) {
      if (block.uuid === uuid) return list
      const nested = (block.props as any)?.blocks
      if (Array.isArray(nested)) {
        const found = findParentList(uuid, nested)
        if (found) return found
      }
    }
    return undefined
  }

  /** Move a block within any list in the tree. */
  function moveBlockInTree(uuid: string, afterUuid?: string, hostUuid?: string): boolean {
    // Determine target container list
    let targetList: FieldListItem[]
    if (hostUuid && hostUuid !== ctx.value.entityUuid) {
      const container = findBlock(hostUuid, state.blocks)
      if (!container) return false
      if (!Array.isArray((container.props as any).blocks)) {
        ;(container.props as any).blocks = []
      }
      targetList = (container.props as any).blocks
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
      // Collect mutated options for all blocks (including nested)
      function collectOptions(list: FieldListItem[], acc: Record<string, Record<string, any>>) {
        for (const block of list) {
          acc[block.uuid] = {}
          Object.entries(block.options || {}).forEach(([key, value]) => {
            acc[block.uuid][key] = value
          })
          const nested = (block.props as any)?.blocks
          if (Array.isArray(nested)) collectOptions(nested, acc)
        }
        return acc
      }

      // Build extra nested fields for each container block
      function collectContainerFields(list: FieldListItem[]): MutatedField[] {
        const fields: MutatedField[] = []
        for (const block of list) {
          if (block.bundle === 'container') {
            const nestedList: FieldListItem[] = (block.props as any)?.blocks || []
            fields.push({
              name: 'blocks',
              entityType: 'block',
              entityUuid: block.uuid,
              list: nestedList.map((b) => ({ ...b })),
            })
            fields.push(...collectContainerFields(nestedList))
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
        { id: 'text', label: 'Text', description: 'Rich text content block' },
        { id: 'richtext', label: 'Markdown', description: 'Rich text with Markdown editor' },
        { id: 'heading', label: 'Ueberschrift', description: 'Heading block' },
        { id: 'image', label: 'Bild', description: 'Image block with caption' },
        { id: 'button', label: 'Button', description: 'Button with internal page link' },
        { id: 'container', label: 'Container', description: 'Layout container with nested blocks' },
        { id: 'directus_page', label: 'Directus Seite', description: 'Legacy HTML/Markdown content' },
      ])
    },

    getFieldConfig(): Promise<FieldConfig[]> {
      const allowedInRoot = ['text', 'richtext', 'heading', 'image', 'button', 'container', 'directus_page']
      const allowedInContainer = ['text', 'richtext', 'heading', 'image', 'button', 'container']
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
      ])
    },

    addNewBlock(e: AddNewBlockEvent) {
      const newBlock: FieldListItem = {
        uuid: crypto.randomUUID(),
        bundle: e.bundle,
        props: getPropsForNewBlock(e.bundle),
        options: {},
      }

      // Nested container: host.type === 'block' and host.fieldName === 'blocks'
      if (e.host.type === 'block' && e.host.fieldName === 'blocks') {
        const container = findBlock(e.host.uuid, state.blocks)
        if (container) {
          if (!Array.isArray((container.props as any).blocks)) {
            ;(container.props as any).blocks = []
          }
          const nestedList = (container.props as any).blocks as FieldListItem[]
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
      const success = moveBlockInTree(e.item.uuid, e.afterUuid, e.host.uuid)
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
            const nested = (v.props as any)?.blocks
            if (Array.isArray(nested)) {
              ;(v.props as any).blocks = removeFromList(nested)
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
        // Re-UUID nested container blocks too
        const nested = (dup.props as any)?.blocks
        if (Array.isArray(nested)) {
          ;(dup.props as any).blocks = nested.map(deepDuplicate)
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
