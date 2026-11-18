<template>
  <button
    type="button"
    class="group flex min-w-0 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg p-1 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--slk-text-strong)"
    :class="role ? 'w-28' : 'w-16'"
    :title="fullName"
    @click="$emit('select', member.id)"
  >
    <span
      class="avatar flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition-transform group-hover:scale-105"
      :style="{ borderColor: color, background: `color-mix(in srgb, ${color} 15%, var(--slk-surface))` }"
    >
      <SmartImg
        v-if="member.avatar"
        :asset-id="member.avatar"
        :is-raster="true"
        :width="40"
        :height="40"
        img-class="w-full h-full object-cover"
      />
      <span v-else class="text-sm font-bold text-(--slk-text-strong)">{{ initials }}</span>
    </span>
    <span class="line-clamp-2 w-full text-xs leading-tight font-semibold break-words text-(--slk-text-strong)">{{
      fullName
    }}</span>
    <span v-if="role" class="w-full text-xs leading-tight font-medium text-(--slk-text-muted)">{{ role }}</span>
  </button>
</template>

<script setup lang="ts">
import type { z } from "zod";
import type { OrganisationLeaderSchema } from "~/shared/contracts/content";

const props = defineProps<{ member: z.infer<typeof OrganisationLeaderSchema>; color: string; role?: string }>();
defineEmits<{ select: [id: string] }>();
const fullName = computed(() => [props.member.first_name, props.member.last_name].filter(Boolean).join(" "));
const initials = computed(() =>
  `${props.member.first_name?.[0] ?? ""}${props.member.last_name?.[0] ?? ""}`.toUpperCase(),
);
</script>
