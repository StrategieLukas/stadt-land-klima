<template>
  <component
    :is="href ? 'a' : 'button'"
    v-bind="linkAttrs"
    class="canonical-button inline-flex items-stretch overflow-hidden whitespace-nowrap rounded-md text-sm font-bold no-underline shadow-sm ring-1 ring-inset ring-white transition-all hover:brightness-110"
    :class="[bgClass, textClass]"
  >
    <!-- Local SVG icon -->
    <span
      v-if="currentIconSvg"
      :class="
        iconSize === 'lg'
          ? 'flex w-12 flex-shrink-0 items-center justify-center self-stretch border-r-2 border-current [&>svg]:h-7 [&>svg]:w-7'
          : 'flex w-9 flex-shrink-0 items-center justify-center self-stretch border-r-2 border-current [&>svg]:h-5 [&>svg]:w-5'
      "
    >
      <span
        :class="
          iconSize === 'lg'
            ? 'flex h-7 w-7 items-center justify-center [&>svg]:h-full [&>svg]:w-full'
            : 'flex h-5 w-5 items-center justify-center [&>svg]:h-full [&>svg]:w-full'
        "
        v-html="currentIconSvg"
      />
    </span>
    <!-- Iconify icon (e.g. mdi:arrow-right) -->
    <span
      v-else-if="iconifySlug"
      :class="
        iconSize === 'lg'
          ? 'flex w-12 flex-shrink-0 items-center justify-center self-stretch border-r-2 border-current'
          : 'flex w-9 flex-shrink-0 items-center justify-center self-stretch border-r-2 border-current'
      "
    >
      <Icon :icon="iconifySlug" :class="iconSize === 'lg' ? 'h-7 w-7' : 'h-5 w-5'" />
    </span>
    <!-- Label -->
    <span class="flex flex-1 items-center justify-center" :class="hasIcon ? 'py-2 pl-3 pr-4' : 'px-4 py-2'">{{
      label
    }}</span>
  </component>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  label: string;
  href?: string;
  iconSlug?: string;
  color?: string;
  textColor?: "auto" | "white" | "black";
  iconSize?: "sm" | "lg";
  external?: boolean;
}>();

const attrs = useAttrs();

const svgFiles = import.meta.glob("@/assets/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

function getRawSvg(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "default" in value) {
    const defaultExport = (value as { default?: unknown }).default;
    return typeof defaultExport === "string" ? defaultExport : "";
  }
  return "";
}

/**
 * Like Blokkli Button's prepareIcon, but also strips <circle class="cls-1">
 * background shapes so icons like icon_newsletter_click render correctly on a
 * coloured button (the white envelope shows on the button background, not its own circle).
 */
function prepareIconForButton(raw: string): string {
  let svg = raw;
  svg = svg.replace(/<\?xml[^?]*\?>/g, "");
  svg = svg.replace(/(<svg[^>]*?)\s+width="[^"]*"/g, "$1");
  svg = svg.replace(/(<svg[^>]*?)\s+height="[^"]*"/g, "$1");
  svg = svg.replace(/<rect[^>]*class="cls-[123]"[^/>]*\/>/g, "");
  svg = svg.replace(/<rect[^>]*class="cls-[123]"[^>]*>[^<]*<\/rect>/g, "");
  svg = svg.replace(/<circle[^>]*class="cls-1"[^/>]*\/>/g, "");
  svg = svg.replace(/<circle[^>]*class="cls-1"[^>]*>[^<]*<\/circle>/g, "");
  // Remove st0 background circles (impact, invest, evaluation_criteria, politics icons)
  svg = svg.replace(/<circle[^>]*class="st0"[^/>]*\/>/g, "");
  svg = svg.replace(/<circle[^>]*class="st0"[^>]*>[^<]*<\/circle>/g, "");
  svg = svg.replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, "fill: currentColor");
  svg = svg.replace(/stroke:\s*#[0-9a-fA-F]{3,6}/g, "stroke: currentColor");
  svg = svg.replace(/fill="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'fill="currentColor"');
  svg = svg.replace(/stroke="(?:#[0-9a-fA-F]{3,6}|black|white)"/g, 'stroke="currentColor"');
  return svg;
}

const iconMap: Record<string, string> = Object.fromEntries(
  Object.entries(svgFiles).map(([path, svg]) => {
    const name = path.split("/").pop()?.replace(".svg", "") ?? "";
    return [name, prepareIconForButton(getRawSvg(svg))];
  }),
);

const currentIconSvg = computed(() => {
  if (!props.iconSlug) return "";
  return iconMap[props.iconSlug] ?? "";
});

const iconifySlug = computed(() => {
  if (!props.iconSlug || iconMap[props.iconSlug]) return "";
  return props.iconSlug;
});

const hasIcon = computed(() => !!(currentIconSvg.value || iconifySlug.value));

const colorConfig: Record<string, { bg: string; autoText: string }> = {
  green: { bg: "bg-ff-green", autoText: "text-white" },
  "dark-green": { bg: "bg-green", autoText: "text-white" },
  "bright-green": { bg: "bg-light-green", autoText: "text-black" },
  blue: { bg: "bg-light-blue", autoText: "text-white" },
  dark: { bg: "bg-stats-dark", autoText: "text-white" },
  orange: { bg: "bg-orange", autoText: "text-white" },
  red: { bg: "bg-red", autoText: "text-white" },
  yellow: { bg: "bg-localzero-yellow", autoText: "text-gray" },
};

const cfg = computed(() => colorConfig[props.color ?? "green"] ?? colorConfig["green"]);
const bgClass = computed(() => cfg.value.bg);
const textClass = computed(() => {
  const tc = props.textColor ?? "auto";
  if (tc === "white") return "text-white";
  if (tc === "black") return "text-black";
  return cfg.value.autoText;
});

const linkAttrs = computed(() => {
  const base: Record<string, unknown> = { ...attrs };
  if (props.href) {
    base.href = props.href;
    if (props.external) {
      base.target = "_blank";
      base.rel = "noopener noreferrer";
    }
  } else {
    if (!base.type) base.type = "button";
  }
  return base;
});
</script>
