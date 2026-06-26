<template>
  <article :class="cardClasses">
    <NuxtLink :to="`/events/${event.slug}`" class="block">
      <div v-if="event.image" class="bg-gray-100 relative h-40 overflow-hidden">
        <SmartImg
          :assetId="event.image?.id || event.image"
          :isRaster="event.image?.type ? isRaster(event.image.type) : true"
          :alt="event.title"
          :width="600"
          :height="160"
          fit="cover"
          :img-class="imageClass"
        />
      </div>
      <div v-else :class="placeholderClasses">
        <svg
          class="h-14 w-14"
          :class="placeholderIconClass"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      <div class="p-5">
        <span :class="badgeClasses">
          {{ eventTypeLabel(event.event_type) }}
        </span>
        <h3 :class="titleClasses">{{ event.title }}</h3>
        <div :class="metaClasses">
          <span class="flex items-center gap-1">
            <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 2 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
              />
            </svg>
            {{ formatEventDateTimeRange(event.start_date, event.end_date, $locale, $t) }}
          </span>
          <span v-if="event.location" class="flex items-center gap-1">
            <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"
              />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 1 1-6 0a3 3 0 0 1 6 0z" />
            </svg>
            {{ event.location }}
          </span>
        </div>
      </div>
    </NuxtLink>

    <div :class="actionWrapClasses">
      <a :href="calendarHref" :download="`${event.slug}.ics`" :class="calendarLinkClasses" @click.stop>
        <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 2 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
          />
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 14v5m-2.5-2.5H12m0 0h2.5" />
        </svg>
        <span>{{ $t("events.add_to_calendar") }}</span>
      </a>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatEventDateTimeRange } from "~/shared/eventDateTime";
import { isRaster } from "~/shared/utils";

type EventImage = {
  id?: string;
  type?: string;
};

type EventListItem = {
  end_date?: string | null;
  event_type?: string | null;
  image?: EventImage | string | null;
  location?: string | null;
  slug: string;
  start_date?: string | null;
  title: string;
};

const props = withDefaults(
  defineProps<{
    event: EventListItem;
    variant?: "current" | "future" | "past";
  }>(),
  {
    variant: "future",
  },
);

const { $locale, $t } = useNuxtApp() as unknown as {
  $locale: string;
  $t: (key: string) => string;
};

const calendarHref = computed(() => `/api/events/${encodeURIComponent(props.event.slug)}.ics`);

const cardClasses = computed(() => {
  const base = "bg-white rounded-lg shadow-sm border overflow-hidden transition-all";

  if (props.variant === "current") {
    return `${base} border-orange-200 hover:shadow-md hover:border-orange-400`;
  }

  if (props.variant === "past") {
    return `${base} border-gray-100 hover:shadow-md hover:border-gray-300 opacity-70`;
  }

  return `${base} border-gray-100 hover:shadow-md hover:border-light-green`;
});

const badgeClasses = computed(() => {
  const base = "text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2 inline-block";

  if (props.variant === "current") {
    return `${base} bg-orange-100 text-orange-700`;
  }

  if (props.variant === "past") {
    return `${base} bg-gray-100 text-gray-500`;
  }

  return `${base} bg-light-green/10 text-olive-green`;
});

const titleClasses = computed(() =>
  props.variant === "past" ? "font-bold text-gray-700 mb-1 leading-snug" : "font-bold text-gray-900 mb-1 leading-snug",
);

const metaClasses = computed(() =>
  props.variant === "past"
    ? "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400"
    : "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500",
);

const imageClass = computed(() =>
  props.variant === "past" ? "h-full w-full object-cover grayscale" : "h-full w-full object-cover",
);

const placeholderClasses = computed(() => {
  const base = "relative flex h-40 items-center justify-center";

  if (props.variant === "current") {
    return `${base} bg-gradient-to-br from-orange-50 to-orange-100`;
  }

  return `${base} bg-gray-50`;
});

const placeholderIconClass = computed(() => (props.variant === "current" ? "text-orange-300" : "text-gray-300"));

const actionWrapClasses = computed(() =>
  props.variant === "current" ? "border-t border-orange-100 px-5 py-3" : "border-t border-gray-100 px-5 py-3",
);

const calendarLinkClasses = computed(() => {
  const base = "inline-flex items-center gap-2 text-sm font-semibold transition-colors";

  if (props.variant === "current") {
    return `${base} text-orange-700 hover:text-orange-800`;
  }

  if (props.variant === "past") {
    return `${base} text-gray-500 hover:text-gray-700`;
  }

  return `${base} text-olive-green hover:text-light-green`;
});

function eventTypeLabel(type?: string | null) {
  if (!type) return "";

  const translated = $t(`events.type.${type}`);
  return translated === `events.type.${type}` ? type : translated;
}

</script>
