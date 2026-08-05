<template>
  <div
    :id="'block-' + uuid"
    class="blokkli-block-donation-widget flex w-full py-4"
    :class="alignmentClass"
  >
    <BetterplaceDonationWidget :height="widgetHeight" :class="widthClass" />
  </div>
</template>

<script setup lang="ts">
const { options, uuid } = defineBlokkli({
  bundle: "donation_widget",
  options: {
    width: {
      type: "radios",
      label: "Breite",
      default: "default",
      options: {
        compact: "Kompakt",
        default: "Standard",
        wide: "Breit",
      },
    },
    alignment: {
      type: "radios",
      label: "Ausrichtung",
      default: "center",
      options: {
        left: "Links",
        center: "Mitte",
        right: "Rechts",
      },
    },
    height: {
      type: "text",
      label: "Höhe in Pixeln",
      default: "320",
      inputType: "number",
    },
  },
  editor: {
    addBehaviour: "no-form",
    editTitle: () => "Spenden-Widget",
    mockProps: () => {
      return {};
    },
  },
});

const widthClass = computed(() => {
  const map: Record<string, string> = {
    compact: "max-w-sm",
    default: "max-w-md",
    wide: "max-w-xl",
  };

  return `w-full ${map[options.value.width] ?? map.default}`;
});

const alignmentClass = computed(() => {
  const map: Record<string, string> = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  return map[options.value.alignment] ?? map.center;
});

const widgetHeight = computed(() => {
  const parsedHeight = Number.parseInt(String(options.value.height ?? "320"), 10);
  return Number.isFinite(parsedHeight) ? parsedHeight : 320;
});
</script>
