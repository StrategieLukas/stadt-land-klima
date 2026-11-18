<template>
  <section class="participation-calendar" :aria-label="$t('participation.calendar.title')" :aria-busy="loading">
    <div class="flex items-center justify-between gap-3">
      <h3 class="font-semibold">{{ monthLabel }}</h3>
      <div class="flex gap-1">
        <button
          type="button"
          class="btn btn-square btn-ghost btn-sm"
          :disabled="offset === 0 || loading"
          :aria-label="$t('participation.calendar.previous')"
          @click="offset--"
        >
          <Icon icon="mdi:chevron-left" class="h-5 w-5" />
        </button>
        <button
          type="button"
          class="btn btn-square btn-ghost btn-sm"
          :disabled="offset === 3 || loading"
          :aria-label="$t('participation.calendar.next')"
          @click="offset++"
        >
          <Icon icon="mdi:chevron-right" class="h-5 w-5" />
        </button>
      </div>
    </div>
    <div v-if="loading" class="my-6 flex justify-center" role="status">
      <span class="loading loading-sm loading-spinner" /><span class="sr-only">{{ $t("generic.loading") }}</span>
    </div>
    <template v-else>
      <div class="mt-4 grid grid-cols-7 gap-1 text-center">
        <span v-for="weekday in weekdays" :key="weekday" class="pb-2 text-xs text-(--slk-text-muted)">{{
          weekday
        }}</span>
        <span v-for="index in firstDayOffset" :key="`blank-${index}`" aria-hidden="true" />
        <button
          v-for="day in days"
          :key="day.key"
          type="button"
          class="btn btn-square w-full min-w-0"
          :class="selectedDay === day.key ? 'btn-primary' : 'btn-ghost'"
          :disabled="!slotsByDay[day.key]?.length"
          :aria-pressed="selectedDay === day.key"
          :aria-label="day.label"
          @click="selectDay(day.key)"
        >
          {{ day.number }}
        </button>
      </div>
      <p v-if="failure" class="mt-4 text-sm text-error" role="alert">
        {{ $t("participation.error.calendar_unavailable") }}
      </p>
      <p v-else-if="!slots.length" class="mt-4 text-sm text-(--slk-text-muted)" role="status">
        {{ $t("participation.calendar.empty") }}
      </p>
      <div v-if="selectedDay" class="mt-5 grid grid-cols-3 gap-2" :aria-label="$t('participation.calendar.times')">
        <button
          v-for="slot in slotsByDay[selectedDay] || []"
          :key="slot"
          type="button"
          class="btn h-auto min-h-11 btn-sm"
          :class="modelValue === slot ? 'btn-primary' : 'btn-outline'"
          :aria-pressed="modelValue === slot"
          @click="$emit('update:modelValue', slot)"
        >
          {{
            new Intl.DateTimeFormat($locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(slot))
          }}
        </button>
      </div>
      <p class="sr-only" role="status">
        {{ modelValue ? formatSlot(modelValue) : $t("participation.calendar.choose") }}
      </p>
      <button v-if="failure || !slots.length" type="button" class="btn mt-3 btn-ghost btn-sm" @click="loadSlots">
        {{ $t("participation.retry") }}
      </button>
    </template>
    <label class="mt-5 block text-xs font-medium" for="participation-timezone">{{
      $t("participation.calendar.timezone")
    }}</label>
    <select id="participation-timezone" :value="timeZone" class="select mt-2 w-full" @change="changeTimeZone">
      <option v-for="zone in zones" :key="zone" :value="zone">{{ zone }}</option>
    </select>
  </section>
</template>

<script setup lang="ts">
import Icon from "~/components/ParticipationIcon.vue";
import { ParticipationSlotsSchema } from "~/shared/participation";
const props = defineProps<{ modelValue: string; timeZone: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string]; "update:timeZone": [value: string] }>();
const { $t, $locale } = useNuxtApp();
const offset = ref(0);
const now = new Date();
const month = computed(() => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset.value, 1)));
const monthLabel = computed(() =>
  new Intl.DateTimeFormat($locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(month.value),
);
const firstDayOffset = computed(() => (month.value.getUTCDay() + 6) % 7);
const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat($locale, { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 0, 5 + index)),
    ),
  ),
);
const keyFor = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: props.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const days = computed(() =>
  Array.from(
    { length: new Date(Date.UTC(month.value.getUTCFullYear(), month.value.getUTCMonth() + 1, 0)).getUTCDate() },
    (_, index) => {
      const date = new Date(Date.UTC(month.value.getUTCFullYear(), month.value.getUTCMonth(), index + 1));
      return {
        number: index + 1,
        key: date.toISOString().slice(0, 10),
        label: new Intl.DateTimeFormat($locale, { dateStyle: "full", timeZone: "UTC" }).format(date),
      };
    },
  ),
);
const loading = ref(true);
const failure = ref(false);
const slots = ref<string[]>([]);
const selectedDay = ref("");
const slotsByDay = computed(() => {
  const groups: Record<string, string[]> = {};
  for (const slot of slots.value) {
    const key = keyFor(new Date(slot));
    (groups[key] ??= []).push(slot);
  }
  return groups;
});
const zones = computed(() => [...new Set([props.timeZone, "UTC", ...Intl.supportedValuesOf("timeZone")])]);
let request = 0;
async function loadSlots() {
  const current = ++request;
  loading.value = true;
  failure.value = false;
  slots.value = [];
  selectedDay.value = "";
  emit("update:modelValue", "");
  const start = new Date(Math.max(month.value.getTime() - 86400000, Date.now()));
  const end = new Date(Date.UTC(month.value.getUTCFullYear(), month.value.getUTCMonth() + 1, 2));
  try {
    const result = ParticipationSlotsSchema.parse(
      await $fetch("/api/participation/slots", {
        query: { start: start.toISOString(), end: end.toISOString(), timeZone: props.timeZone },
      }),
    );
    if (current === request) slots.value = result.slots;
  } catch {
    if (current === request) failure.value = true;
  } finally {
    if (current === request) loading.value = false;
  }
}
function selectDay(key: string) {
  selectedDay.value = key;
  emit("update:modelValue", "");
}
function changeTimeZone(event: Event) {
  if (event.target instanceof HTMLSelectElement) emit("update:timeZone", event.target.value);
}
function formatSlot(slot: string) {
  return new Intl.DateTimeFormat($locale, { dateStyle: "full", timeStyle: "short", timeZone: props.timeZone }).format(
    new Date(slot),
  );
}
watch([offset, () => props.timeZone], loadSlots);
onMounted(loadSlots);
onUnmounted(() => {
  request++;
});
</script>
