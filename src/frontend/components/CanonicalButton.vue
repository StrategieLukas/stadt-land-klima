<template>
  <component
    :is="href ? 'a' : 'button'"
    v-bind="linkAttrs"
    class="canonical-button inline-flex max-w-full items-stretch overflow-hidden rounded-md text-sm font-bold no-underline"
    :class="[
      textClass,
      {
        'canonical-button--auto-text': !textColor || textColor === 'auto',
        'canonical-button--outline': variant === 'outline',
      },
    ]"
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
    <span
      class="flex min-w-0 flex-1 items-center justify-center whitespace-normal"
      :class="hasIcon ? 'py-2 pr-4 pl-3' : 'px-4 py-2'"
      >{{ label }}</span
    >
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
  variant?: "filled" | "outline" | undefined;
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
  --btn-fill: var(--btn-color);
  --btn-edge: rgb(255 255 255 / 20%);
  --btn-hover: var(--btn-fill);
  --btn-focus: var(--btn-color);
  --btn-shadow: rgb(0 0 0 / 5%);
  background-color: var(--btn-fill);
  box-shadow:
    inset 0 0 0 1px var(--btn-edge),
    0 1px 2px var(--btn-shadow);
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color 150ms ease;
}

.canonical-button__icon {
  border-color: currentColor;
}

html[data-theme="staedteChallengeDark"] .canonical-button {
  --btn-fill: color-mix(in srgb, var(--btn-color) 55%, var(--slk-surface, #17212b));
  --btn-edge: color-mix(in srgb, var(--btn-fill) 80%, var(--btn-color));
  --btn-focus: color-mix(in srgb, var(--btn-fill) 60%, white);
  --btn-shadow: rgb(0 0 0 / 30%);
}

html[data-theme="staedteChallengeDark"] .canonical-button--auto-text:not(.canonical-button--outline) {
  color: white;
}

html[data-theme="staedteChallengeDark"] .canonical-button:not(.canonical-button--outline) .canonical-button__icon {
  border-color: var(--slk-page, #101820);
}

.canonical-button--outline {
  --btn-ink: color-mix(in srgb, var(--btn-color) 82%, black);
  --btn-fill: var(--slk-surface, white);
  --btn-edge: var(--btn-ink);
  --btn-hover: var(--btn-ink);
  --btn-focus: var(--btn-ink);
}

.canonical-button--outline.canonical-button--auto-text {
  color: var(--btn-ink);
}

html[data-theme="staedteChallengeDark"] .canonical-button--outline {
  --btn-ink: color-mix(in srgb, var(--btn-color) 65%, white);
  --btn-fill: var(--slk-surface, #17212b);
  --btn-edge: var(--btn-ink);
  --btn-focus: var(--btn-ink);
}

.canonical-button:not(:disabled):hover {
  outline-color: var(--btn-hover);
}

.canonical-button:not(:disabled):focus-visible {
  outline-color: var(--btn-focus);
}

.canonical-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
