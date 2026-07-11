<template>
    <div class="rounded-sm shadow-list">
        <!-- Header with collapse toggle -->
        <div :class="municipality?.description ? 'collapse collapse-plus rounded-sm' : 'rounded-sm'">
            <input
                v-if="municipality?.description"
                type="checkbox"
                name="municipality-description"
                autocomplete="off"
                checked="checked"
            />
            <div class="collapse-title flex items-center justify-between px-6 py-4">
                <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_info.svg" alt="" class="slk-sector-detail-icon slk-theme-icon--light h-6 w-6 opacity-60" />
                <img src="~/assets/icons/icon_info-dark.svg" alt="" class="slk-sector-detail-icon slk-theme-icon--dark h-6 w-6 opacity-60" />
                <h3 class="font-heading text-h3 text-green leading-none">{{ $t("municipality.municipality_info") }}</h3>
                </div>
                <GermanyMapIndicator
                  v-if="municipality.geolocation"
                  :lat="municipality.geolocation.coordinates[1]"
                  :lon="municipality.geolocation.coordinates[0]"
                  :size="90"
                  fill-color="#dcfce7"
                  stroke-color="#86efac"
                  marker-color="#339737"
                />
            </div>

            <!-- Collapsible description only -->
            <div
                v-if="municipality?.description"
                class="collapse-content px-6 pb-4"
            >
                <div
                class="has-long-links prose prose-sm max-w-none"
                v-html="renderMarkdown(municipality.description)"
                ></div>
            </div>
            </div>

            <!-- Info grid (always visible, outside collapse) -->
            <!-- Berlin and Hamburg are the only states which have one municipality (Bremen has Bremen and Bremerhaven) -->
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
                <span class="text-sm font-bold text-right text-gray-900">{{ municipality.population.toLocaleString() }}</span>
            </div>

            <div v-if="municipality?.mayor" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                <img src="~/assets/icons/icon_politics.svg" alt="" class="slk-sector-detail-icon slk-theme-icon--light h-5 w-5 opacity-60" />
                <img src="~/assets/icons/icon_politics-dark.svg" alt="" class="slk-sector-detail-icon slk-theme-icon--dark h-5 w-5 opacity-60" />
                <span class="text-sm text-gray-700">{{ $t("municipality.mayor") }}</span>
                </div>
                <span v-if="municipality.party_mayor" class="text-sm font-bold text-gray-900 text-right">
                {{ municipality.mayor }} ({{ municipality.party_mayor }})
                </span>
                <span v-else class="text-sm font-bold text-right text-gray-900 text-right">{{ municipality.party_mayor }}</span>
            </div>

            <div v-if="municipality?.municipality_type" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                <div v-html="MunicipalitySvg" class="h-5 w-5 opacity-60"/>
                <span class="text-sm text-gray-700">{{ $t("municipality.municipality_type") }}</span>
                </div>
                <span class="text-sm font-bold text-right text-gray-900">
                {{ municipality.municipality_type === 'big_city'
                    ? $t("municipality.municipality_type.major_city")
                    : $t("municipality.municipality_type.minor_city") }}
                </span>
            </div>

            <div v-if="municipalityScore?.score_total">
                <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <img src="~/assets/icons/icon_evaluation_criteria.svg" alt="" class="slk-sector-detail-icon slk-theme-icon--light h-5 w-5 opacity-60" />
                    <img src="~/assets/icons/icon_evaluation_criteria-dark.svg" alt="" class="slk-sector-detail-icon slk-theme-icon--dark h-5 w-5 opacity-60" />
                    <span class="text-sm font-medium text-right text-gray-700">{{ $t("municipality.overall_score") }}</span>
                </div>
                <span class="text-sm font-bold" :class="`text-${getScorePercentageColor(municipalityScore.score_total)}`">
                    {{ Math.round(Number(municipalityScore.score_total) * 10) / 10 }}%
                </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import majorCity from '~/assets/images/major-city-dark.svg?raw';
import minorCity from '~/assets/images/minor-city-dark.svg?raw';
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { getScorePercentageColor } from "~/shared/utils.js"
import { overwriteSvgStyles } from "~/shared/svg-logic.js"
const { $t } = useNuxtApp();

const MunicipalitySvg = ref('')

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});
md.linkify.set({ fuzzyLink: false });

const defaultLinkOpenRenderer = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return defaultLinkOpenRenderer(tokens, idx, options, env, self);
};

const markdownAllowedAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: [...(sanitizeHtml.defaults.allowedAttributes.a || []), "target", "rel"],
};

function renderMarkdown(value) {
  return sanitizeHtml(md.render(value || ""), {
    allowedAttributes: markdownAllowedAttributes,
  });
}


const props = defineProps({
  municipalityScore: {
    type: Object,
    required: true,
  },
});

const municipality = props.municipalityScore.municipality;

onMounted(async () => {
    MunicipalitySvg.value = await overwriteSvgStyles(props.municipalityScore.municipality.municipality_type === 'big_city' ? majorCity : minorCity, {
        "st0" : "fill-white",
        "st1" : "fill-black",
    })
});

</script>
