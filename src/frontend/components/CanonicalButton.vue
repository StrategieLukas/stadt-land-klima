<template>
  <component
    :is="href ? 'a' : 'button'"
    v-bind="linkAttrs"
    class="canonical-button inline-flex items-stretch overflow-hidden rounded-md text-sm font-bold whitespace-nowrap no-underline shadow-xs ring-1 ring-white/20 ring-inset"
    :class="[textClass, { 'canonical-button--auto-text': !textColor || textColor === 'auto' }]"
    :style="{ '--btn-color': colorHex }"
  >
    <!-- Local SVG icon -->
    <span
      v-if="currentIconSvg"
      class="canonical-button__icon"
      :class="
        iconSize === 'lg'
          ? 'flex w-12 shrink-0 items-center justify-center self-stretch border-r-2 [&>svg]:h-7 [&>svg]:w-7'
          : 'flex w-9 shrink-0 items-center justify-center self-stretch border-r-2 [&>svg]:h-5 [&>svg]:w-5'
      "
    >
      <!-- eslint-disable vue/no-v-html -- SVG is imported from checked-in assets. -->
      <span
        :class="
          iconSize === 'lg'
            ? 'flex h-7 w-7 items-center justify-center [&>svg]:h-full [&>svg]:w-full'
            : 'flex h-5 w-5 items-center justify-center [&>svg]:h-full [&>svg]:w-full'
        "
        v-html="currentIconSvg"
      />
      <!-- eslint-enable vue/no-v-html -->
    </span>
    <!-- Iconify icon (e.g. mdi:arrow-right) -->
    <span
      v-else-if="iconifySlug"
      class="canonical-button__icon"
      :class="
        iconSize === 'lg'
          ? 'flex w-12 shrink-0 items-center justify-center self-stretch border-r-2'
          : 'flex w-9 shrink-0 items-center justify-center self-stretch border-r-2'
      "
    >
      <Icon :icon="iconifySlug" :class="iconSize === 'lg' ? 'h-7 w-7' : 'h-5 w-5'" />
    </span>
    <!-- Label -->
    <span class="flex flex-1 items-center justify-center" :class="hasIcon ? 'py-2 pr-4 pl-3' : 'px-4 py-2'">{{
      label
    }}</span>
  </component>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { prepareButtonIcons } from "~/utils/buttonIcons";
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  onClick?: ((event: MouseEvent) => void) | undefined;
  disabled?: boolean | undefined;
  type?: "button" | "submit" | "reset" | undefined;
  label: string;
  href?: string | undefined;
  title?: string | undefined;
  iconSlug?: string | undefined;
  color?: string | undefined;
  textColor?: "auto" | "white" | "black" | undefined;
  iconSize?: "sm" | "lg" | undefined;
  external?: boolean | undefined;
}>();

const attrs = useAttrs();

const svgFiles = import.meta.glob<string>("@/assets/icons/*.svg", { query: "?raw", import: "default", eager: true });
const iconMap = prepareButtonIcons(svgFiles, "canonical");

const currentIconSvg = computed(() => {
  if (!props.iconSlug) return "";
  return iconMap[props.iconSlug] ?? "";
});

const iconifySlug = computed(() => {
  if (!props.iconSlug || iconMap[props.iconSlug]) return "";
  return props.iconSlug;
});

const hasIcon = computed(() => !!(currentIconSvg.value || iconifySlug.value));

const hexMap: Record<string, string> = {
  green: "#1da64a",
  "dark-green": "#339737",
  "bright-green": "#AFCA0B",
  blue: "#16bae7",
  dark: "#006e94",
  gray: "#505050",
  orange: "#f39200",
  red: "#e30613",
  yellow: "#ffc80c",
};

const colorHex = computed(() => hexMap[props.color ?? "green"] ?? "#1da64a");
const textClass = computed(() => {
  const tc = props.textColor ?? "auto";
  if (tc === "white") return "text-white";
  if (tc === "black") return "text-black";
  return props.color === "yellow" ? "text-gray" : "text-white";
});

const linkAttrs = computed(() => {
  const base: Record<string, unknown> = { ...attrs };
  if (props.onClick) base.onClick = props.onClick;
  if (props.title !== undefined) base.title = props.title;
  if (props.disabled !== undefined) base.disabled = props.disabled;
  if (props.href) {
    base.href = props.href;
    if (props.external) {
      base.target = "_blank";
      base.rel = "noopener noreferrer";
    }
  } else {
    if (!base.type) base.type = props.type ?? "button";
  }
  return base;
});
</script>

<style scoped>
.canonical-button {
  background-color: var(--btn-color);
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color 150ms ease;
}

.canonical-button__icon {
  border-color: currentColor;
}

html[data-theme="staedteChallengeDark"] .canonical-button {
  background-color: color-mix(in srgb, var(--btn-color) 55%, var(--slk-surface, #17212b));
  box-shadow:
    inset 0 0 0 1px var(--slk-border-strong),
    0 1px 2px rgba(0, 0, 0, 0.3);
}

html[data-theme="staedteChallengeDark"] .canonical-button--auto-text {
  color: white;
}

html[data-theme="staedteChallengeDark"] .canonical-button__icon {
  border-color: var(--slk-page, #101820);
}

.canonical-button:hover,
.canonical-button:focus-visible {
  outline-color: var(--btn-color);
}

.canonical-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
