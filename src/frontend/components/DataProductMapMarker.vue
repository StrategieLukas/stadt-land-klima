<template>
  <LMarker :lat-lng="item.coordinates">
    <LIcon
      :icon-size="[25, 41]"
      :icon-anchor="[12, 41]"
      :popup-anchor="[1, -34]"
      :shadow-size="[41, 41]"
      icon-url="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
      shadow-url="https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
      :class-name="markerClass"
    />
    <LPopup :content="item.properties?.popup_content ?? ''" />
  </LMarker>
</template>
<script setup lang="ts">
const props = defineProps<{
  item: {coordinates: [number, number]; properties?: {power_kw?: number | undefined; popup_content?: string | null | undefined} | null | undefined};
}>();
const markerClass = computed(() => {
  const power = props.item.properties?.power_kw;
  if (!power) return 'marker-default';
  if (power >= 150) return 'marker-high-power';
  if (power >= 50) return 'marker-medium-power';
  return 'marker-low-power';
});
</script>
