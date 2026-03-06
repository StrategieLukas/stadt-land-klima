/**
 * blökkli Edit Adapter Configuration
 * 
 * This file is automatically loaded by the @blokkli/editor module.
 * It exports the adapter that blökkli will use to communicate with the backend.
 */

import { defineEditAdapter } from '@blokkli/editor'
import { readItems, readItem, createItem, updateItem, deleteItem } from '@directus/sdk'

/**
 * Directus Edit Adapter for blökkli
 */
export default defineEditAdapter({
  name: 'directus',
  
  /**
   * Get runtime configuration
   */
  useRuntimeConfig() {
    const config = useRuntimeConfig()
    return {
      directusUrl: config.public.clientDirectusUrl,
      directusToken: config.public.directusToken,
    }
  },

  /**
   * Load edit state for an entity
   */
  async getEditState(entityType: string, entityUuid: string) {
    const { $directus } = useNuxtApp()
    
    try {
      const states = await $directus.request(
        readItems('edit_states', {
          filter: {
            entity_type: { _eq: entityType },
            entity_uuid: { _eq: entityUuid },
          },
          limit: 1,
        })
      )
      
      if (states && states.length > 0) {
        return states[0]
      }
      
      // Create new edit state
      return await $directus.request(
        createItem('edit_states', {
          entity_type: entityType,
          entity_uuid: entityUuid,
          mutations: [],
          state: 'draft',
        })
      )
    } catch (error) {
      console.error('Failed to load edit state:', error)
      return null
    }
  },

  /**
   * Load blocks for a field
   */
  async getBlocks(entityType: string, entityUuid: string, fieldName: string) {
    const { $directus } = useNuxtApp()
    
    try {
      const blocks = await $directus.request(
        readItems('blocks', {
          filter: {
            entity_type: { _eq: entityType },
            entity_uuid: { _eq: entityUuid },
            field_name: { _eq: fieldName },
          },
          sort: ['sort_order'],
        })
      )
      
      return blocks || []
    } catch (error) {
      console.error('Failed to load blocks:', error)
      return []
    }
  },

  /**
   * Create a new block
   */
  async createBlock(data: any) {
    const { $directus } = useNuxtApp()
    
    try {
      return await $directus.request(createItem('blocks', data))
    } catch (error) {
      console.error('Failed to create block:', error)
      throw error
    }
  },

  /**
   * Update a block
   */
  async updateBlock(uuid: string, data: any) {
    const { $directus } = useNuxtApp()
    
    try {
      return await $directus.request(updateItem('blocks', uuid, data))
    } catch (error) {
      console.error('Failed to update block:', error)
      throw error
    }
  },

  /**
   * Delete a block
   */
  async deleteBlock(uuid: string) {
    const { $directus } = useNuxtApp()
    
    try {
      await $directus.request(deleteItem('blocks', uuid))
      return { success: true }
    } catch (error) {
      console.error('Failed to delete block:', error)
      throw error
    }
  },

  /**
   * Search for content or media
   */
  async search(query: string, type: 'media' | 'content' = 'content') {
    const { $directus } = useNuxtApp()
    
    try {
      if (type === 'media') {
        return await $directus.request(
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
      }
      
      // Search content
      const [articles, pages] = await Promise.all([
        $directus.request(
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
        $directus.request(
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
      ])
      
      return [...(articles || []), ...(pages || [])]
    } catch (error) {
      console.error('Search failed:', error)
      return []
    }
  },
})
