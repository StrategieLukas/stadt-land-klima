<template>
  <BlokkliPageProvider
    entity-type="success_project_tour_stops"
    entity-bundle="success_project_tour_stop"
    :entity-uuid="stop.id"
    :can-edit="canEdit"
    :entity="stop"
  >
    <BlokkliField name="content" :list="blocks" />
  </BlokkliPageProvider>
</template>
<script setup lang="ts">
import { readItems } from "@directus/sdk";
import { useAuth } from "~/composables/useAuth";
import { getBlokkliDataKey, mapBlokkliBlocks } from "~/shared/blokkliPersistence";
import { TOUR_REPORT_MEDIA, type SuccessProjectTourStop } from "~/shared/successProjectTour";
import { relationId } from "~/shared/tour";
const fetchContent = useContentFetch();

const props = defineProps<{ stop: SuccessProjectTourStop; canEdit: boolean; editorPreview?: boolean | undefined }>();
provide(
  TOUR_REPORT_MEDIA,
  computed(() => ({
    fileIds: new Set(
      [props.stop.image, ...(props.stop.media || []).flatMap((item) => [item.file, item.poster])]
        .map(relationId)
        .filter((id): id is string => Boolean(id)),
    ),
    editorPreview: props.editorPreview,
  })),
);
const { getAuthenticatedClient } = useAuth();
const { data } = await useAsyncData(
  getBlokkliDataKey("success_project_tour_stops", props.stop.id),
  async () => {
    if (!import.meta.client || !props.canEdit) {
      const result = await fetchContent("/api/public/blocks", {
        query: { entityType: "success_project_tour_stops", entityUuid: props.stop.id, fieldName: "content" },
      });
      return mapBlokkliBlocks(result.blocks);
    }
    const client = getAuthenticatedClient();
    return mapBlokkliBlocks(
      await client.request(
        readItems("blocks", {
          filter: {
            entity_type: { _eq: "success_project_tour_stops" },
            entity_uuid: { _eq: props.stop.id },
            field_name: { _eq: "content" },
            status: props.canEdit ? { _neq: "archived" } : { _eq: "published" },
          },
          sort: ["sort_order"],
          limit: -1,
        }),
      ),
    );
  },
  { watch: [() => props.canEdit] },
);
function recoverLegacyDraft() {
  if (!import.meta.client || !props.canEdit) return;
  const target = `slk:blokkli-draft:success_project_tour_stops:${props.stop.id}`;
  try {
    if (localStorage.getItem(target)) return;
    const candidates = [
      props.stop.legacy_report_id ? `slk:blokkli-draft:event_reports:${props.stop.legacy_report_id}` : null,
      props.stop.source_news_item ? `slk:blokkli-draft:news_items:${props.stop.source_news_item}` : null,
    ].filter(Boolean) as string[];
    const drafts = candidates.map((key) => ({ key, value: localStorage.getItem(key) })).filter((item) => item.value);
    const [draft] = drafts;
    if (drafts.length !== 1 || !draft) return; // Conflicting recovery copies are retained for inspection.
    localStorage.setItem(target, draft.value!);
    localStorage.removeItem(draft.key);
  } catch {
    /* Storage restrictions must not prevent viewing the report. */
  }
}
watch([() => props.canEdit, () => props.stop.legacy_report_id, () => props.stop.source_news_item], recoverLegacyDraft, {
  immediate: true,
});
const blocks = computed(() => data.value || []);
</script>
