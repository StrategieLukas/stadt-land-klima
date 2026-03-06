/**
 * Composable for using blökkli with Directus
 * 
 * Provides easy access to blökkli editor functionality
 * integrated with the Directus backend.
 */

import { useBlokkli } from '@blokkli/adapter'
import { directusAdapter } from '~/lib/blokkli/adapters/directus-adapter'

export function useBlokkliDirectus() {
  const config = useRuntimeConfig()
  const { $directus } = useNuxtApp()
  
  // Initialize blökkli with Directus adapter
  const blokkli = useBlokkli({
    adapter: directusAdapter,
    adapterOptions: {
      directusUrl: config.public.clientDirectusUrl,
      directusToken: config.public.directusToken,
      globalClient: $directus, // Use existing Directus client from Nuxt plugin
    },
  })
  
  return blokkli
}
