import { CollectionSchema, RenderResponseSchema, type RenderElement } from "~/shared/contracts/slz";
import { ref } from "vue";
import type { LayoutHint } from "~/types/slz-api";

export interface ResolvedStep {
  index: number;
  title: Record<string, string>;
  description: Record<string, string>;
  layout: LayoutHint;
  elements: RenderElement[];
}

export function useCollectionRender(baseUrl: string) {
  const { $locale } = useNuxtApp();
  const language = $locale === "en-GB" ? "en-US" : $locale;
  const loading = ref(false);
  const error = ref(false);
  const steps = ref<ResolvedStep[]>([]);
  const elementByPlotId = ref<Map<string, RenderElement>>(new Map());

  let generation = 0;

  function buildFromCollection(input: unknown) {
    const collection = CollectionSchema.parse(input);
    const elements = collection.render_elements ?? [];
    const map = new Map<string, RenderElement>();
    for (const el of elements) {
      if (el.plot_id) map.set(el.plot_id, el);
    }
    elementByPlotId.value = map;

    if (collection.narrative_steps?.length) {
      steps.value = collection.narrative_steps.map((ns) => ({
        index: ns.index,
        title: ns.title,
        description: ns.description,
        layout: ns.layout,
        elements: ns.plot_ids.map((id) => map.get(id)).filter((element): element is RenderElement => Boolean(element)),
      }));
    } else {
      // Synthesize a single default step from all render_elements
      steps.value = elements.length
        ? [
            {
              index: 0,
              title: collection.title,
              description: collection.description,
              layout: "default",
              elements,
            },
          ]
        : [];
    }
  }

  async function load(collectionSlug: string, collection?: unknown) {
    const current = ++generation;
    loading.value = true;
    error.value = false;
    try {
      const data: unknown = collection ?? (await $fetch(`${baseUrl}/api/collections/${collectionSlug}/`));
      if (current !== generation) return;
      buildFromCollection(data);
    } catch {
      if (current !== generation) return;
      error.value = true;
      steps.value = [];
      elementByPlotId.value = new Map();
    } finally {
      if (current === generation) loading.value = false;
    }
  }

  // Fetches area-injected specs from /render/?area={ars} endpoint.
  // The endpoint returns a flat render_elements list + narrative_steps with plot_ids.
  async function loadFromRender(collectionSlug: string, ars: string) {
    const current = ++generation;
    loading.value = true;
    error.value = false;
    try {
      const data: unknown = await $fetch(`${baseUrl}/api/collections/${collectionSlug}/render/`, {
        params: { area: ars, lang: language },
      });
      if (current !== generation) return;

      const parsed = RenderResponseSchema.parse(data);
      const elements = parsed.render_elements;
      const map = new Map<string, RenderElement>();
      for (const el of elements) {
        if (el.plot_id) map.set(el.plot_id, el);
      }
      elementByPlotId.value = map;

      const narrativeSteps = parsed.narrative_steps;
      if (narrativeSteps.length) {
        steps.value = narrativeSteps.map((ns) => ({
          index: ns.index,
          title: ns.title,
          description: ns.description,
          layout: ns.layout,
          elements: ns.plot_ids
            .map((id) => map.get(id))
            .filter((element): element is RenderElement => Boolean(element)),
        }));
      } else {
        steps.value = elements.length
          ? [{ index: 0, title: {}, description: {}, layout: "default" as LayoutHint, elements }]
          : [];
      }
    } catch {
      if (current !== generation) return;
      error.value = true;
      steps.value = [];
      elementByPlotId.value = new Map();
    } finally {
      if (current === generation) loading.value = false;
    }
  }

  return { steps, elementByPlotId, loading, error, load, loadFromRender };
}
