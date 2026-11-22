<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="onboarding-dialog fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-(--slk-border) bg-(--slk-surface) p-4 text-(--slk-text) shadow-xl"
      :aria-labelledby="titleId"
      @close="closed"
      @cancel="emit('update:open', false)"
      @click="closeOnBackdrop"
    >
      <div class="flex h-[80dvh] flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <h2 :id="titleId" class="font-heading text-xl font-bold">{{ $t("onboarding.title") }}</h2>
          <button
            type="button"
            class="btn btn-circle btn-ghost btn-sm"
            :aria-label="$t('generic.close')"
            autofocus
            @click="emit('update:open', false)"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>
        <div v-if="open" class="min-h-0 flex-1 overflow-y-auto"><CalBookingFrame /></div>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
const { $t } = useNuxtApp();
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
let returnFocus: HTMLElement | null = null;

watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open && dialog.value && !dialog.value.open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.value.showModal();
    } else if (!open && dialog.value?.open) dialog.value.close();
  },
  { immediate: true },
);

function closed() {
  emit("update:open", false);
  returnFocus?.focus();
}
function closeOnBackdrop(event: MouseEvent) {
  if (event.target !== dialog.value || !dialog.value) return;
  const bounds = dialog.value.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    emit("update:open", false);
}
onBeforeUnmount(() => {
  dialog.value?.close();
  returnFocus?.focus();
});
</script>

<style scoped>
.onboarding-dialog::backdrop {
  background: color-mix(in srgb, var(--slk-backdrop, #000) 50%, transparent);
}
</style>
