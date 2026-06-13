import { ref, computed } from 'vue'
import type { Collection, RenderElement, NarrativeStep, LayoutHint } from '~/types/slz-api'

export interface ResolvedStep {
  index: number
  title: Record<string, string>
  description: Record<string, string>
  layout: LayoutHint
  elements: RenderElement[]
}

export function useCollectionRender(baseUrl: string) {
  const loading = ref(false)
  const error = ref(false)
  const steps = ref<ResolvedStep[]>([])
  const elementByPlotId = ref<Map<string, RenderElement>>(new Map())

  function buildFromCollection(collection: Collection) {
    const elements = collection.render_elements ?? []
    const map = new Map<string, RenderElement>()
    for (const el of elements) {
      if (el.plot_id) map.set(el.plot_id, el)
    }
    elementByPlotId.value = map

    if (collection.narrative_steps?.length) {
      steps.value = collection.narrative_steps.map(ns => ({
        index: ns.index,
        title: ns.title,
        description: ns.description,
        layout: ns.layout,
        elements: ns.plot_ids.map(id => map.get(id)).filter(Boolean) as RenderElement[],
      }))
    } else {
      // Synthesize a single default step from all render_elements
      steps.value = elements.length
        ? [{
            index: 0,
            title: collection.title,
            description: collection.description,
            layout: 'default',
            elements,
          }]
        : []
    }
  }

  async function load(collectionSlug: string, collection?: Collection) {
    if (collection) {
      buildFromCollection(collection)
      return
    }

    loading.value = true
    error.value = false
    try {
      const data = await $fetch<Collection>(`${baseUrl}/api/collections/${collectionSlug}/`)
      buildFromCollection(data)
    } catch (_) {
      error.value = true
      steps.value = []
    } finally {
      loading.value = false
    }
  }

  // Fetches area-injected specs from /render/?area={ars} endpoint.
  // The endpoint returns a flat render_elements list + narrative_steps with plot_ids.
  async function loadFromRender(collectionSlug: string, ars: string) {
    loading.value = true
    error.value = false
    try {
      const data = await $fetch<{
        narrative_steps: (NarrativeStep & { links?: unknown[] })[]
        render_elements: RenderElement[]
      }>(
        `${baseUrl}/api/collections/${collectionSlug}/render/`,
        { params: { area: ars } },
      )

      const elements = data?.render_elements ?? []
      const map = new Map<string, RenderElement>()
      for (const el of elements) {
        if (el.plot_id) map.set(el.plot_id, el)
      }
      elementByPlotId.value = map

      const narrativeSteps = data?.narrative_steps ?? []
      if (narrativeSteps.length) {
        steps.value = narrativeSteps.map(ns => ({
          index: ns.index,
          title: ns.title,
          description: ns.description,
          layout: ns.layout,
          elements: ns.plot_ids.map(id => map.get(id)).filter(Boolean) as RenderElement[],
        }))
      } else {
        steps.value = elements.length
          ? [{ index: 0, title: {}, description: {}, layout: 'default' as LayoutHint, elements }]
          : []
      }
    } catch (_) {
      error.value = true
      steps.value = []
    } finally {
      loading.value = false
    }
  }

  return { steps, elementByPlotId, loading, error, load, loadFromRender }
}
