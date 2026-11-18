<template>
  <div
    class="tooltip tooltip-bottom tooltip-start z-30 lg:tooltip-end"
    :class="{ 'tooltip-open': open, 'is-dismissed': dismissed }"
    @mouseenter="dismissed = false"
    @focusin="dismissed = false"
    @focusout="open = false"
    @keydown.esc="
      dismissed = true;
      open = false;
    "
  >
    <span class="inline-flex items-center gap-1">
      {{ $t("region.municipalities_count") }}
      <button
        type="button"
        class="inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-sm text-(--slk-text-muted) focus-visible:outline-2 focus-visible:outline-offset-2"
        :aria-label="$t('region.rating_eligibility_help')"
        :aria-describedby="tooltipId"
        @click="
          dismissed = false;
          open = !open;
        "
      >
        <Icon icon="mdi:information-outline" class="size-4" :ariaHidden="true" />
      </button>
    </span>
    <div
      :id="tooltipId"
      role="tooltip"
      class="tooltip-content w-80 max-w-[calc(100vw-5rem)] border border-(--slk-border) bg-(--slk-surface) p-3 text-left text-sm leading-relaxed font-normal text-(--slk-text) shadow-lg"
    >
      <p>{{ $t("region.rating_eligibility_explanation") }}</p>
      <ul class="my-2 list-disc space-y-2 pl-5">
        <li>{{ $t("region.rating_eligibility_city_states") }}</li>
        <li>{{ $t("region.rating_eligibility_city_districts") }}</li>
        <li>{{ $t("region.rating_eligibility_associations") }}</li>
        <li>{{ $t("region.rating_eligibility_municipalities") }}</li>
      </ul>
      <p>{{ $t("region.rating_eligibility_note") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";

const { $t } = useNuxtApp();
// Eligibility source: jakobkrieger/stadt-land-zahl, data_sources/tasks/vg250.py
// (_aggregate_vg250_to_administrative_areas), commit 682ff093ab8943e89f7d89fb0255da08c623f21b.
// Identical polygons are grouped first. The district rule checks lowest level 4
// and exactly three records, rather than explicitly requiring levels [4, 5, 6].
const tooltipId = useId();
const open = ref(false);
const dismissed = ref(false);
</script>

<style scoped>
.tooltip:is(:hover, :has(:focus-visible), .tooltip-open):not(.is-dismissed) > .tooltip-content {
  pointer-events: auto;
}

.is-dismissed > .tooltip-content,
.is-dismissed::after {
  visibility: hidden;
}
</style>
