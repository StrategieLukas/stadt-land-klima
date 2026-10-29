<template>
  <div ref="root" class="canonical-toggle-group join" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="join-item"
      :aria-checked="modelValue === option.value"
      :tabindex="modelValue === option.value ? 0 : -1"
      :disabled="option.disabled"
      :data-value="option.value"
      @click="select(option.value)"
      @keydown="onKeydown($event, option.value)"
    >
      <Icon v-if="option.icon" :icon="option.icon" class="size-4 shrink-0" ariaHidden="true" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>
<script setup lang="ts" generic="T extends string">
import { Icon } from "@iconify/vue";
import { nextTick, ref } from "vue";
const props = defineProps<{
  modelValue: T;
  label: string;
  options: readonly { value: T; label: string; icon?: string; disabled?: boolean }[];
}>();
const emit = defineEmits<{ "update:modelValue": [value: T] }>();
const root = ref<HTMLElement | null>(null);
function select(value: T) {
  if (value !== props.modelValue && props.options.some((option) => option.value === value && !option.disabled))
    emit("update:modelValue", value);
}
async function onKeydown(event: KeyboardEvent, current: T) {
  const enabled = props.options.filter((option) => !option.disabled);
  const index = enabled.findIndex((option) => option.value === current);
  const rtl = root.value && getComputedStyle(root.value).direction === "rtl";
  let target: number;
  if (event.key === "Home") target = 0;
  else if (event.key === "End") target = enabled.length - 1;
  else if (event.key === "ArrowDown" || event.key === (rtl ? "ArrowLeft" : "ArrowRight"))
    target = (index + 1) % enabled.length;
  else if (event.key === "ArrowUp" || event.key === (rtl ? "ArrowRight" : "ArrowLeft"))
    target = (index + enabled.length - 1) % enabled.length;
  else return;
  event.preventDefault();
  const option = enabled[target];
  if (!option) return;
  select(option.value);
  await nextTick();
  Array.from(root.value?.querySelectorAll<HTMLButtonElement>("button") ?? [])
    .find((button) => button.dataset.value === option.value)
    ?.focus();
}
</script>
<style scoped>
.canonical-toggle-group {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  padding: 0.2rem;
  gap: 0.2rem;
  border: 1px solid var(--slk-border);
  border-radius: 0.5rem;
  background: var(--slk-surface-subdued);
  color: var(--slk-text-strong);
}
.canonical-toggle-group button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-height: 2.5rem;
  padding: 0.4rem 0.75rem;
  border: 0;
  border-radius: 0.3rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}
.canonical-toggle-group button:hover {
  background: var(--slk-surface-muted);
}
.canonical-toggle-group button[aria-checked="true"] {
  background: var(--slk-accent-green);
  color: var(--slk-ranking-card-text);
}
.canonical-toggle-group button:focus-visible {
  outline: 2px solid var(--slk-text-strong);
  outline-offset: 2px;
}
.canonical-toggle-group button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
