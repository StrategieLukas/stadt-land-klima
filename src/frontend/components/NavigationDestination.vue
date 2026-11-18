<template>
  <component
    :is="destination.type === 'page' ? NuxtLink : destination.type === 'external' ? 'a' : 'span'"
    :to="destination.type === 'page' ? destination.href : undefined"
    :href="destination.type === 'external' ? destination.href : undefined"
    :target="destination.type === 'external' && item.open_new_tab ? '_blank' : undefined"
    :rel="destination.type === 'external' ? 'noopener noreferrer' : undefined"
    :aria-current="current"
    :data-nav-destination="destination.type !== 'none' ? '' : undefined"
    @click="emit('click', $event)"
    @keydown="emit('keydown', $event)"
    @mouseenter="emit('mouseenter', $event)"
    @focusin="emit('focusin', $event)"
  >
    <slot />
  </component>
</template>
<script setup lang="ts">
import { computed, resolveComponent } from "vue";
import type { NavigationItem } from "~/types/components/navigation";
import { navigationDestination } from "~/utils/navigationDropdown";
const props = defineProps<{ item: NavigationItem; current?: "page" | undefined }>();
const emit = defineEmits<{
  click: [event: MouseEvent];
  keydown: [event: KeyboardEvent];
  mouseenter: [event: MouseEvent];
  focusin: [event: FocusEvent];
}>();
const NuxtLink = resolveComponent("NuxtLink");
const destination = computed(() => navigationDestination(props.item));
</script>
