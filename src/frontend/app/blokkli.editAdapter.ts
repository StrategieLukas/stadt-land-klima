/**
 * blökkli Edit Adapter for Directus
 *
 * This file is automatically loaded by the @blokkli/editor module.
 * It implements the BlokkliAdapter interface to connect blökkli
 * with a Directus backend for block management.
 */

import { defineBlokkliEditAdapter } from '#blokkli/adapter'
import type {
  MappedState,
  FieldListItem,
  MutatedField,
  FieldConfig,
  BlockBundleDefinition,
  AddNewBlockEvent,
  MoveBlockEvent,
  MoveMultipleBlocksEvent,
  EditEntity,
  TranslationState,
} from '#blokkli/types'
import { readItems, createItem, updateItem, deleteItem } from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'

/**
 * The raw state shape returned by loadState() and used in MutationResponseLike<T>.
 */
type DirectusState = {
  editStateId: string | null
  entityType: string
  entityUuid: string
  entityBundle: string
  currentIndex: number
  mutations: any[]
  ownerName: string
  currentUserIsOwner: boolean
  fields: MutatedField[]
  mutatedOptions: Record<string, Record<string, string>>
  entity: EditEntity
}

export default defineBlokkliEditAdapter((ctx) => {
  const { $directus } = useNuxtApp()
  const config = useRuntimeConfig()
  const { getAuthenticatedClient, isAuthenticated } = useAuth()

  /**
   * Get the appropriate Directus client.
   * Uses authenticated user client for write operations,
   * falls back to the static-token client for reads.
   */
  function getClient() {
    if (isAuthenticated.value) {
      return getAuthenticatedClient()
    }
    return $directus
  }

  /**
   * Helper: load blocks for this entity from Directus
   */
  async function loadBlocksForEntity(): Promise<{ fields: MutatedField[]; mutatedOptions: Record<string, Record<string, string>> }> {
    const blocks = await getClient().request(
      readItems('blocks', {
        filter: {
          entity_type: { _eq: ctx.value.entityType },
          entity_uuid: { _eq: ctx.value.entityUuid },
          status: { _neq: 'archived' },
        },
        sort: ['sort_order'],
        limit: -1,
      }),
    )

    // Group blocks by field_name and collect options
    const fieldMap = new Map<string, FieldListItem[]>()
    const optionsMap: Record<string, Record<string, string>> = {}

    for (const block of blocks) {
      const fieldName = block.field_name || 'content'
      if (!fieldMap.has(fieldName)) {
        fieldMap.set(fieldName, [])
      }
      fieldMap.get(fieldName)!.push({
        uuid: block.uuid,
        bundle: block.bundle,
        options: block.options || {},
        props: block.props || {},
      })

      // Build mutatedOptions keyed by block UUID
      if (block.options && Object.keys(block.options).length > 0) {
        const opts: Record<string, string> = {}
        for (const [k, v] of Object.entries(block.options)) {
          opts[k] = String(v)
        }
        optionsMap[block.uuid] = opts
      }
    }

    const fields: MutatedField[] = []
    for (const [name, list] of fieldMap) {
      fields.push({
        name,
        entityType: ctx.value.entityType,
        entityUuid: ctx.value.entityUuid,
        list,
      })
    }

    // If no blocks, still return an empty content field
    if (fields.length === 0) {
      fields.push({
        name: 'content',
        entityType: ctx.value.entityType,
        entityUuid: ctx.value.entityUuid,
        list: [],
      })
    }

    return { fields, mutatedOptions: optionsMap }
  }

  /**
   * Helper: build the full state object
   */
  async function buildState(): Promise<DirectusState> {
    const { fields, mutatedOptions } = await loadBlocksForEntity()

    // Try to load existing edit_state
    let editState: any = null
    try {
      const states = await getClient().request(
        readItems('edit_states', {
          filter: {
            entity_type: { _eq: ctx.value.entityType },
            entity_uuid: { _eq: ctx.value.entityUuid },
          },
          limit: 1,
        }),
      )
      editState = states?.[0] || null
    } catch {
      // edit_states collection might not exist yet
    }

    // entityUuid is now the slug — use it directly as the label
    const entityLabel = ctx.value.entityUuid

    return {
      editStateId: editState?.id || null,
      entityType: ctx.value.entityType,
      entityUuid: ctx.value.entityUuid,
      entityBundle: ctx.value.entityBundle,
      currentIndex: editState?.current_index || 0,
      mutations: editState?.mutations || [],
      ownerName: editState?.owner_name || '',
      currentUserIsOwner: true, // Simplified: single-user editing
      fields,
      mutatedOptions,
      entity: {
        label: entityLabel,
        status: true,
        bundleLabel: ctx.value.entityBundle,
      },
    }
  }

  return {
    /**
     * Load the current state from Directus.
     */
    async loadState(): Promise<DirectusState> {
      return buildState()
    },

    /**
     * Map raw state to blökkli's MappedState format.
     */
    mapState(state: DirectusState): MappedState {
      return {
        currentIndex: state.currentIndex,
        mutations: state.mutations,
        currentUserIsOwner: state.currentUserIsOwner,
        ownerName: state.ownerName,
        mutatedState: {
          fields: state.fields,
          mutatedOptions: state.mutatedOptions,
          violations: [],
        },
        entity: state.entity,
        translationState: {
          isTranslatable: false,
          sourceLanguage: 'de',
          availableLanguages: [],
          translations: [],
        },
      }
    },

    /**
     * Return all available block bundles.
     */
    async getAllBundles(): Promise<BlockBundleDefinition[]> {
      return [
        {
          id: 'text',
          label: 'Text',
          description: 'Rich text content block',
        },
        {
          id: 'heading',
          label: 'Überschrift',
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
          description: 'Call to action block with buttons',
        },
        {
          id: 'directus_page',
          label: 'Directus Seite',
          description: 'Legacy HTML/Markdown content from Directus editor',
        },
      ]
    },

    /**
     * Return field configuration.
     */
    async getFieldConfig(): Promise<FieldConfig[]> {
      return [
        {
          name: 'content',
          entityType: ctx.value.entityType,
          entityBundle: ctx.value.entityBundle,
          label: 'Inhalt',
          cardinality: -1, // unlimited
          canEdit: true,
          allowedBundles: ['text', 'heading', 'image', 'cta', 'directus_page'],
        },
      ]
    },

    /**
     * Add a new block.
     */
    async addNewBlock(e: AddNewBlockEvent) {
      const { bundle, afterUuid, host } = e

      // Determine sort_order
      let sortOrder = 0
      if (afterUuid) {
        // Find the block to insert after
        try {
          const afterBlocks = await getClient().request(
            readItems('blocks', {
              filter: { uuid: { _eq: afterUuid } },
              limit: 1,
              fields: ['sort_order'],
            }),
          )
          if (afterBlocks?.[0]) {
            sortOrder = (afterBlocks[0].sort_order || 0) + 1
          }
        } catch {
          // ignore
        }
        // Shift subsequent blocks
        try {
          const subsequentBlocks = await getClient().request(
            readItems('blocks', {
              filter: {
                entity_type: { _eq: ctx.value.entityType },
                entity_uuid: { _eq: ctx.value.entityUuid },
                field_name: { _eq: host.fieldName },
                sort_order: { _gte: sortOrder },
              },
              fields: ['id', 'sort_order'],
              sort: ['sort_order'],
            }),
          )
          for (const block of subsequentBlocks) {
            await getClient().request(
              updateItem('blocks', block.id, {
                sort_order: (block.sort_order || 0) + 1,
              }),
            )
          }
        } catch {
          // ignore
        }
      }

      // Create the new block
      const newUuid = crypto.randomUUID()
      await getClient().request(
        createItem('blocks', {
          uuid: newUuid,
          bundle,
          entity_type: ctx.value.entityType,
          entity_uuid: ctx.value.entityUuid,
          field_name: host.fieldName,
          sort_order: sortOrder,
          status: 'draft',
          props: {},
          options: {},
        }),
      )

      const state = await buildState()
      return { success: true, state }
    },

    /**
     * Move a single block.
     */
    async moveBlock(e: MoveBlockEvent) {
      const { item, afterUuid, host } = e

      // Get all blocks in this field sorted
      const fieldBlocks = await getClient().request(
        readItems('blocks', {
          filter: {
            entity_type: { _eq: ctx.value.entityType },
            entity_uuid: { _eq: ctx.value.entityUuid },
            field_name: { _eq: host.fieldName },
            uuid: { _neq: item.uuid },
          },
          sort: ['sort_order'],
          fields: ['id', 'uuid', 'sort_order'],
        }),
      )

      // Build new order: insert item after afterUuid
      const newOrder: string[] = []
      if (!afterUuid) {
        newOrder.push(item.uuid)
      }
      for (const block of fieldBlocks) {
        newOrder.push(block.uuid)
        if (block.uuid === afterUuid) {
          newOrder.push(item.uuid)
        }
      }

      // Update sort_order for all blocks
      for (let i = 0; i < newOrder.length; i++) {
        const block = fieldBlocks.find((b: any) => b.uuid === newOrder[i])
        if (block) {
          await getClient().request(
            updateItem('blocks', block.id, { sort_order: i, field_name: host.fieldName }),
          )
        } else {
          // This is the moved block — find its real ID
          const movedBlocks = await getClient().request(
            readItems('blocks', {
              filter: { uuid: { _eq: item.uuid } },
              limit: 1,
              fields: ['id'],
            }),
          )
          if (movedBlocks?.[0]) {
            await getClient().request(
              updateItem('blocks', movedBlocks[0].id, {
                sort_order: i,
                field_name: host.fieldName,
              }),
            )
          }
        }
      }

      const state = await buildState()
      return { success: true, state }
    },

    /**
     * Move multiple blocks.
     */
    async moveMultipleBlocks(e: MoveMultipleBlocksEvent) {
      const { uuids, afterUuid, host } = e

      const movedUuids = new Set(uuids)

      // Get all blocks in the field except the moved ones
      const fieldBlocks = await getClient().request(
        readItems('blocks', {
          filter: {
            entity_type: { _eq: ctx.value.entityType },
            entity_uuid: { _eq: ctx.value.entityUuid },
            field_name: { _eq: host.fieldName },
            uuid: { _nin: Array.from(movedUuids) },
          },
          sort: ['sort_order'],
          fields: ['id', 'uuid', 'sort_order'],
        }),
      )

      const newOrder: string[] = []
      if (!afterUuid) {
        newOrder.push(...uuids)
      }
      for (const block of fieldBlocks) {
        newOrder.push(block.uuid)
        if (block.uuid === afterUuid) {
          newOrder.push(...uuids)
        }
      }

      // Update all sort orders
      for (let i = 0; i < newOrder.length; i++) {
        const allBlocks = await getClient().request(
          readItems('blocks', {
            filter: { uuid: { _eq: newOrder[i] } },
            limit: 1,
            fields: ['id'],
          }),
        )
        if (allBlocks?.[0]) {
          await getClient().request(
            updateItem('blocks', allBlocks[0].id, {
              sort_order: i,
              field_name: host.fieldName,
            }),
          )
        }
      }

      const state = await buildState()
      return { success: true, state }
    },

    /**
     * Delete blocks.
     */
    async deleteBlocks(uuids: string[]) {
      for (const uuid of uuids) {
        const blocks = await getClient().request(
          readItems('blocks', {
            filter: { uuid: { _eq: uuid } },
            limit: 1,
            fields: ['id'],
          }),
        )
        if (blocks?.[0]) {
          await getClient().request(deleteItem('blocks', blocks[0].id))
        }
      }

      const state = await buildState()
      return { success: true, state }
    },

    /**
     * Update a block option.
     */
    async updateBlockOption(e: { uuid: string; key: string; value: any }) {
      const blocks = await getClient().request(
        readItems('blocks', {
          filter: { uuid: { _eq: e.uuid } },
          limit: 1,
          fields: ['id', 'options'],
        }),
      )
      if (blocks?.[0]) {
        const currentOptions = blocks[0].options || {}
        await getClient().request(
          updateItem('blocks', blocks[0].id, {
            options: { ...currentOptions, [e.key]: e.value },
          }),
        )
      }

      const state = await buildState()
      return { success: true, state }
    },

    /**
     * Update block props (via edit form).
     */
    async updateBlock(e: { uuid: string; fields: Record<string, any> }) {
      const blocks = await getClient().request(
        readItems('blocks', {
          filter: { uuid: { _eq: e.uuid } },
          limit: 1,
          fields: ['id', 'props'],
        }),
      )
      if (blocks?.[0]) {
        const currentProps = blocks[0].props || {}
        await getClient().request(
          updateItem('blocks', blocks[0].id, {
            props: { ...currentProps, ...e.fields },
          }),
        )
      }

      const state = await buildState()
      return { success: true, state }
    },

    /**
     * Duplicate blocks.
     */
    async duplicateBlocks(uuids: string[]) {
      for (const uuid of uuids) {
        const blocks = await getClient().request(
          readItems('blocks', {
            filter: { uuid: { _eq: uuid } },
            limit: 1,
          }),
        )
        if (blocks?.[0]) {
          const original = blocks[0]
          await getClient().request(
            createItem('blocks', {
              uuid: crypto.randomUUID(),
              bundle: original.bundle,
              entity_type: original.entity_type,
              entity_uuid: original.entity_uuid,
              field_name: original.field_name,
              sort_order: (original.sort_order || 0) + 1,
              status: 'draft',
              props: original.props || {},
              options: original.options || {},
            }),
          )
        }
      }

      const state = await buildState()
      return { success: true, state }
    },
  }
})
