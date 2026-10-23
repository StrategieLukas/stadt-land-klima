<template>
  <!-- Preview drafts require the browser's authenticated session and storage. -->
  <ClientOnly v-if="isPreview">
    <BlokkliProvider v-bind="{ ...$attrs, ...providerContext }" :permissions="permissions">
      <template #default="state"><slot v-bind="state" /></template>
    </BlokkliProvider>
  </ClientOnly>
  <BlokkliProvider v-else v-bind="{ ...$attrs, ...providerContext }" :permissions="permissions">
    <template #default="state"><slot v-bind="state" /></template>
  </BlokkliProvider>
</template>

<script setup lang="ts">
import type { EditPermission } from '#blokkli/types/provider'

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  entityType: string
  entityBundle: string
  entityUuid: string
  entity?: unknown
  canEdit?: boolean | undefined
}>()
const providerContext = computed(() => ({
  entityType: props.entityType,
  entityBundle: props.entityBundle,
  entityUuid: props.entityUuid,
  entity: props.entity,
}))
const permissions = computed<EditPermission[]>(() => props.canEdit ? ['view', 'edit'] : [])

const route = useRoute()
const isPreview = computed(() => Boolean(route.query.blokkliPreview))
</script>
