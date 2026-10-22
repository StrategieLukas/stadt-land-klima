<template>
  <BlokkliPageProvider entity-type="success_project_tours" entity-bundle="success_project_tour" :entity-uuid="tour.id" :can-edit="canEdit" :entity="tour">
    <section v-if="blocks.length || canEdit" class="tour-overview-content mx-auto w-full max-w-5xl px-4 py-8">
      <BlokkliField name="content" :list="blocks" />
    </section>
  </BlokkliPageProvider>
</template>
<script setup lang="ts">
import { customEndpoint, readItems } from '@directus/sdk';
import { useAuth } from '~/composables/useAuth';
import { getBlokkliDataKey, mapBlokkliBlocks } from '~/shared/blokkliPersistence';
import type { SuccessProjectTour } from '~/shared/successProjectTour';

const props = defineProps<{ tour: SuccessProjectTour }>();
const { initialize, isAuthenticated, getAuthenticatedClient } = useAuth();
const canEdit = ref(false);
useBlockHashNavigation();

const { data } = await useAsyncData(getBlokkliDataKey('success_project_tours', props.tour.id), async () => {
  if (!import.meta.client || !canEdit.value) {
    const result = await $fetch('/api/public/blocks', { query: { entityType: 'success_project_tours', entityUuid: props.tour.id, fieldName: 'content' } });
    return mapBlokkliBlocks(result.blocks);
  }
  const client = getAuthenticatedClient();
  return mapBlokkliBlocks(await client.request(readItems('blocks', {
    filter: { entity_type: { _eq: 'success_project_tours' }, entity_uuid: { _eq: props.tour.id }, field_name: { _eq: 'content' }, status: canEdit.value ? { _neq: 'archived' } : { _eq: 'published' } },
    sort: ['sort_order'], limit: -1,
  })));
}, { watch: [canEdit] });
const blocks = computed(() => data.value || []);

onMounted(async () => {
  try {
    await initialize();
    if (!isAuthenticated.value) return;
    const permissions = await getAuthenticatedClient().request(customEndpoint<Record<string, Record<string, { access: string }>>>({ path: '/permissions/me', method: 'GET' }));
    const access = permissions.success_project_tours?.update?.access;
    canEdit.value = Boolean(access && access !== 'none');
  } catch { /* Visitors retain the published tour content. */ }
});
</script>
