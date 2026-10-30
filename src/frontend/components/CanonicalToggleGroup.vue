<template>
  <div
    ref="root"
    class="canonical-toggle-group"
    :class="color === 'inherit' ? undefined : `slk-filter-theme-${color}`"
    :data-roundedness="roundedness"
    :data-padding="padding"
    :data-appearance="appearance"
    role="radiogroup"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      :tabindex="focusValue === option.value ? 0 : -1"
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
import { computed, nextTick, ref } from "vue";
const props = withDefaults(
  defineProps<{
    modelValue: T;
    label: string;
    options: readonly { value: T; label: string; icon?: string; disabled?: boolean }[];
    roundedness?: "full" | "medium" | "none";
    padding?: "compact" | "medium" | "large";
    appearance?: "soft" | "retro";
    color?: "inherit" | "lime" | "blue" | "neutral" | "stats";
  }>(),
  { roundedness: "full", padding: "compact", appearance: "soft", color: "inherit" },
);
const emit = defineEmits<{ "update:modelValue": [value: T] }>();
const root = ref<HTMLElement | null>(null);
const focusValue = computed(
  () =>
    props.options.find((option) => option.value === props.modelValue && !option.disabled)?.value ??
    props.options.find((option) => !option.disabled)?.value,
);
function select(value: T) {
  if (value !== props.modelValue && props.options.some((option) => option.value === value && !option.disabled))
    emit("update:modelValue", value);
}
async function onKeydown(event: KeyboardEvent, current: T) {
  const enabled = props.options.filter((option) => !option.disabled);
  if (!enabled.length) return;
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
  --toggle-radius: 9999px;
  --toggle-padding: 0.25rem 0.625rem;
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  padding: 0.2rem;
  gap: 0.2rem;
  border: 1px solid var(--slk-border);
  border-radius: var(--toggle-radius);
  background: var(--slk-filter-panel-bg, var(--slk-surface-subdued));
  color: var(--slk-filter-inactive-text, var(--slk-text-strong));
}
.canonical-toggle-group[data-roundedness="medium"] {
  --toggle-radius: 0.5rem;
}
.canonical-toggle-group[data-roundedness="none"] {
  --toggle-radius: 0;
}
.canonical-toggle-group[data-padding="medium"] {
  --toggle-padding: 0.5rem 0.875rem;
}
.canonical-toggle-group[data-padding="large"] {
  --toggle-padding: 0.75rem 1.125rem;
}
.canonical-toggle-group[data-appearance="retro"] {
  padding: 0;
  gap: 0;
  border: 2px solid var(--slk-text-strong);
  box-shadow: 3px 3px 0 var(--slk-text-strong);
}
.canonical-toggle-group[data-appearance="retro"] button + button {
  border-inline-start: 2px solid var(--slk-text-strong);
}
.canonical-toggle-group[data-appearance="retro"] button:active {
  box-shadow: inset 2px 2px 0 var(--slk-border-strong);
}
.canonical-toggle-group button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-height: 2.5rem;
  padding: var(--toggle-padding);
  border: 0;
  border-radius: var(--toggle-radius);
  color: inherit;
  background: var(--slk-filter-inactive-bg, var(--slk-surface));
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}
.canonical-toggle-group button:hover {
  background: var(--slk-filter-hover-bg, var(--slk-surface-muted));
}
.canonical-toggle-group button[aria-checked="true"] {
  background: var(--slk-filter-active-bg, var(--slk-accent-green));
  color: var(--slk-filter-active-text, var(--slk-ranking-card-text));
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
