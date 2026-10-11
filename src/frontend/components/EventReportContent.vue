<template>
  <BlokkliPageProvider entity-type="event_reports" entity-bundle="event_report" :entity-uuid="report.id" :can-edit="canEdit" :entity="report">
    <BlokkliField name="content" :list="blocks" />
  </BlokkliPageProvider>
</template>
<script setup lang="ts">
import { readItems } from '@directus/sdk';
import { useAuth } from '~/composables/useAuth';
import { getBlokkliDataKey, mapBlokkliBlocks } from '~/shared/blokkliPersistence';
import type { EventReport } from '~/shared/tourMedia';
const props = defineProps<{ report: EventReport; canEdit: boolean }>();
const { $directus } = useNuxtApp();
const { getAuthenticatedClient } = useAuth();
const { data } = await useAsyncData(getBlokkliDataKey('event_reports', props.report.id), async () => {
  const client = import.meta.client && props.canEdit ? getAuthenticatedClient() : $directus;
  return mapBlokkliBlocks(await client.request(readItems('blocks', {
    filter: { entity_type: { _eq: 'event_reports' }, entity_uuid: { _eq: props.report.id }, field_name: { _eq: 'content' }, status: props.canEdit ? { _neq: 'archived' } : { _eq: 'published' } },
    sort: ['sort_order'], limit: -1,
  })));
}, { watch: [() => props.canEdit] });
const blocks = computed(() => data.value || []);
</script>
