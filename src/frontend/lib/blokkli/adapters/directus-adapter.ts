/**
 * Directus Adapter for blökkli
 * 
 * This adapter implements the blökkli adapter interface to enable
 * communication between blökkli editor and Directus CMS backend.
 * 
 * Key responsibilities:
 * - Fetch block data from Directus
 * - Handle mutations (create, move, delete, edit blocks)
 * - Manage edit state and mutations
 * - Handle media library integration
 * - Provide search functionality
 */

import { defineAdapter } from '@blokkli/adapter'
import type { 
  Adapter, 
  AdapterContext, 
  Block, 
  MutationResponse,
  EditState 
} from '@blokkli/types'

export interface DirectusAdapterOptions {
  directusUrl: string
  directusToken: string
  globalClient?: any
}

/**
 * Directus Adapter for blökkli
 */
export const directusAdapter = defineAdapter<DirectusAdapterOptions>({
  name: 'directus',
  
  /**
   * Initialize the adapter with configuration
   */
  async init(options: DirectusAdapterOptions, context: AdapterContext) {
    const { directusUrl, directusToken, globalClient } = options
    
    // Use global Directus client if available (from Nuxt plugin)
    const client = globalClient || createDirectusClient(directusUrl, directusToken)
    
    return {
      client,
      directusUrl,
      directusToken,
    }
  },

  /**
   * Load current edit state for an entity
   */
  async loadEditState(entityType: string, entityUuid: string, context: any) {
    const { client } = context
    
    try {
      // Fetch or create edit state from Directus
      const response = await client.request(
        readItems('edit_states', {
          filter: {
            entity_type: { _eq: entityType },
            entity_uuid: { _eq: entityUuid },
          },
          limit: 1,
        })
      )
      
      if (response.length > 0) {
        return response[0]
      }
      
      // Create new edit state if none exists
      const newState = await client.request(
        createItem('edit_states', {
          entity_type: entityType,
          entity_uuid: entityUuid,
          mutations: [],
          state: 'draft',
        })
      )
      
      return newState
    } catch (error) {
      console.error('Failed to load edit state:', error)
      throw error
    }
  },

  /**
   * Load blocks for a specific field
   */
  async loadBlocks(entityType: string, entityUuid: string, fieldName: string, context: any) {
    const { client } = context
    
    try {
      // Fetch blocks from Directus
      const response = await client.request(
        readItems('blocks', {
          filter: {
            entity_type: { _eq: entityType },
            entity_uuid: { _eq: entityUuid },
            field_name: { _eq: fieldName },
          },
          sort: ['sort_order'],
          fields: [
            'id',
            'uuid',
            'bundle',
            'props',
            'parent_uuid',
            'sort_order',
            'field_name',
          ],
        })
      )
      
      return response.map(transformDirectusBlockToBlokkliBlock)
    } catch (error) {
      console.error('Failed to load blocks:', error)
      return []
    }
  },

  /**
   * Apply a mutation (create, move, delete, edit block)
   */
  async mutate(mutation: any, context: any) {
    const { client } = context
    
    try {
      let result: MutationResponse
      
      switch (mutation.type) {
        case 'create':
          result = await handleCreateBlock(mutation, client)
          break
        case 'move':
          result = await handleMoveBlock(mutation, client)
          break
        case 'delete':
          result = await handleDeleteBlock(mutation, client)
          break
        case 'edit':
          result = await handleEditBlock(mutation, client)
          break
        default:
          throw new Error(`Unknown mutation type: ${mutation.type}`)
      }
      
      // Store mutation in edit state
      await storeMutation(mutation, context)
      
      return result
    } catch (error) {
      console.error('Mutation failed:', error)
      throw error
    }
  },

  /**
   * Search for existing content or media
   */
  async search(query: string, type: string, context: any) {
    const { client } = context
    
    try {
      let results = []
      
      if (type === 'media') {
        // Search in Directus media library
        results = await client.request(
          readItems('directus_files', {
            filter: {
              _or: [
                { title: { _contains: query } },
                { filename_download: { _contains: query } },
              ],
            },
            limit: 20,
          })
        )
      } else if (type === 'content') {
        // Search across content collections
        results = await searchContent(query, client)
      }
      
      return results
    } catch (error) {
      console.error('Search failed:', error)
      return []
    }
  },

  /**
   * Publish changes (commit edit state)
   */
  async publish(entityType: string, entityUuid: string, context: any) {
    const { client } = context
    
    try {
      // Update edit state status to published
      await client.request(
        updateItem('edit_states', {
          filter: {
            entity_type: { _eq: entityType },
            entity_uuid: { _eq: entityUuid },
          },
        }, {
          state: 'published',
          published_at: new Date().toISOString(),
        })
      )
      
      return { success: true }
    } catch (error) {
      console.error('Publish failed:', error)
      throw error
    }
  },

  /**
   * Revert all changes in edit state
   */
  async revert(entityType: string, entityUuid: string, context: any) {
    const { client } = context
    
    try {
      // Delete edit state and reload original blocks
      await client.request(
        deleteItem('edit_states', {
          filter: {
            entity_type: { _eq: entityType },
            entity_uuid: { _eq: entityUuid },
          },
        })
      )
      
      return { success: true }
    } catch (error) {
      console.error('Revert failed:', error)
      throw error
    }
  },
})

/**
 * Helper: Transform Directus block to blökkli block format
 */
function transformDirectusBlockToBlokkliBlock(directusBlock: any): Block {
  return {
    uuid: directusBlock.uuid,
    bundle: directusBlock.bundle,
    props: directusBlock.props || {},
    parentUuid: directusBlock.parent_uuid,
  }
}

/**
 * Helper: Create a new block in Directus
 */
async function handleCreateBlock(mutation: any, client: any): Promise<MutationResponse> {
  const { uuid, bundle, props, parentUuid, fieldName, entityType, entityUuid } = mutation
  
  const newBlock = await client.request(
    createItem('blocks', {
      uuid,
      bundle,
      props,
      parent_uuid: parentUuid,
      field_name: fieldName,
      entity_type: entityType,
      entity_uuid: entityUuid,
      sort_order: mutation.sortOrder || 0,
    })
  )
  
  return {
    success: true,
    block: transformDirectusBlockToBlokkliBlock(newBlock),
  }
}

/**
 * Helper: Move/reorder a block
 */
async function handleMoveBlock(mutation: any, client: any): Promise<MutationResponse> {
  const { uuid, parentUuid, afterUuid, sortOrder } = mutation
  
  await client.request(
    updateItem('blocks', uuid, {
      parent_uuid: parentUuid,
      sort_order: sortOrder,
    })
  )
  
  return { success: true }
}

/**
 * Helper: Delete a block
 */
async function handleDeleteBlock(mutation: any, client: any): Promise<MutationResponse> {
  const { uuid } = mutation
  
  await client.request(deleteItem('blocks', uuid))
  
  return { success: true }
}

/**
 * Helper: Edit block properties
 */
async function handleEditBlock(mutation: any, client: any): Promise<MutationResponse> {
  const { uuid, props } = mutation
  
  await client.request(
    updateItem('blocks', uuid, {
      props,
    })
  )
  
  return { success: true }
}

/**
 * Helper: Store mutation in edit state
 */
async function storeMutation(mutation: any, context: any) {
  // Store mutation for history/undo functionality
  // Implementation depends on edit state structure
}

/**
 * Helper: Search across content collections
 */
async function searchContent(query: string, client: any) {
  // Search in articles, pages, and other content
  const searchPromises = [
    client.request(
      readItems('articles', {
        filter: {
          _or: [
            { title: { _contains: query } },
            { abstract: { _contains: query } },
          ],
        },
        limit: 10,
      })
    ),
    client.request(
      readItems('pages', {
        filter: {
          _or: [
            { name: { _contains: query } },
            { contents: { _contains: query } },
          ],
        },
        limit: 10,
      })
    ),
  ]
  
  const results = await Promise.all(searchPromises)
  return results.flat()
}

/**
 * Helper: Create Directus client (fallback if not using global client)
 */
function createDirectusClient(url: string, token: string) {
  // Basic client creation - in practice, use @directus/sdk properly
  return {
    request: async (operation: any) => {
      const response = await fetch(`${url}/items/${operation.collection}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      return response.json()
    },
  }
}

// Import Directus SDK helpers (these need to be properly imported)
// Placeholder imports - actual implementation would use @directus/sdk
const readItems = (collection: string, query?: any) => ({ collection, query, type: 'read' })
const createItem = (collection: string, data: any) => ({ collection, data, type: 'create' })
const updateItem = (collection: string, id: string, data: any) => ({ collection, id, data, type: 'update' })
const deleteItem = (collection: string, id: string) => ({ collection, id, type: 'delete' })
