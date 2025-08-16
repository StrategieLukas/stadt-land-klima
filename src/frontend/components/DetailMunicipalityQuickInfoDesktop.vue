<template>
    <div class="rounded-sm shadow-list">
        <!-- Header with collapse toggle -->
        <div class="collapse collapse-plus rounded-sm">
        <input
            v-if="municipality?.description"
            type="checkbox"
            name="municipality-description"
            autocomplete="off"
        />
        <div class="collapse-title flex items-center justify-between px-6 py-4">
            <div class="flex items-center gap-2">
            <img src="~/assets/icons/icon_location.svg" class="h-6 w-6 opacity-60" />
            <h3 class="font-heading text-h3 text-green">Infos zur Kommune</h3>
            </div>
        </div>

        <!-- Collapsible description only -->
        <div
            v-if="municipality?.description"
            class="collapse-content px-6 pb-4"
        >
            <div
            class="has-long-links prose prose-sm max-w-none"
            v-html="sanitizeHtml(linkifyStr(municipality.description))"
            ></div>
        </div>
        </div>

        <!-- Info grid (always visible, outside collapse) -->
        <div class="px-6 pb-6 space-y-3">
        <div
            v-if="municipality?.state && municipality.state !== 'Berlin' && municipality.state !== 'Hamburg'"
            class="flex items-center justify-between"
        >
            <div class="flex items-center gap-2">
            <img src="~/assets/icons/icon_location.svg" class="h-5 w-5 opacity-60" />
            <span class="text-sm text-gray-700">{{ $t("state") }}</span>
            </div>
            <span class="text-sm font-bold text-gray-900">{{ municipality.state }}</span>
        </div>

        <div v-if="municipality?.population" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
            <img src="~/assets/icons/icon_team.svg" class="h-5 w-5 opacity-60" />
            <span class="text-sm text-gray-700">{{ $t("municipality.population") }}</span>
            </div>
            <span class="text-sm font-bold text-gray-900">{{ municipality.population.toLocaleString() }}</span>
        </div>

        <div v-if="municipality?.party_mayor" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
            <img src="~/assets/icons/icon_politics.svg" class="h-5 w-5 opacity-60" />
            <span class="text-sm text-gray-700">{{ $t("municipality.mayor") }}</span>
            </div>
            <span v-if="municipality.party_mayor" class="text-sm font-bold text-gray-900 text-right">
            {{ municipality.mayor }} ({{ municipality.party_mayor }})
            </span>
            <span v-else class="text-sm font-bold text-gray-900 text-right">{{ municipality.party_mayor }}</span>
        </div>

        <div v-if="municipality?.municipality_type" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
            <div v-if="municipality.municipality_type === 'big_city'" v-html="majorCityIcon" class="h-5 w-5 opacity-60"></div>
            <div v-else v-html="minorCityIcon" class="h-5 w-5 opacity-60"></div>
            <span class="text-sm text-gray-700">{{ $t("municipality.municipality_type") }}</span>
            </div>
            <span class="text-sm font-bold text-gray-900">
            {{ municipality.municipality_type === 'big_city'
                ? $t("municipality.municipality_type.major_city")
                : $t("municipality.municipality_type.minor_city") }}
            </span>
        </div>

        <div v-if="municipality?.score_total">
            <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_evaluation_criteria.svg" class="h-5 w-5 opacity-60" />
                <span class="text-sm font-medium text-gray-700">{{ $t("municipality.overall_score") }}</span>
            </div>
            <span class="text-sm font-bold" :class="`text-${getScoreColor(municipality.score_total)}`">
                {{ Math.round(Number(municipality.score_total) * 10) / 10 }}%
            </span>
            </div>
        </div>
        </div>
    </div>
</template>

<script setup>
import sanitizeHtml from "sanitize-html";
import linkifyStr from "linkify-string";
import { getScoreColor } from "../shared/utils.js"

// Dynamic SVG imports for city type icons
const majorCityIcon = ref('');
const minorCityIcon = ref('');

const props = defineProps({
  municipality: {
    type: Object,
    required: true,
  },
});

onMounted(async () => {
  // Load SVG icons
  try {
    majorCityIcon.value = (await import('~/assets/images/major-city-dark.svg?raw')).default;
    minorCityIcon.value = (await import('~/assets/images/minor-city-dark.svg?raw')).default;
  } catch (error) {
    console.warn('Failed to load SVG icons:', error);
  }
});

</script>