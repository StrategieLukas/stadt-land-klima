<template>
  <div class="mt-8 border border-(--slk-border) bg-(--slk-surface) p-4 sm:p-6">
    <div class="mb-6 max-w-3xl">
      <h3 class="mb-2 text-xl font-bold text-stats-dark sm:text-2xl">
        {{ $t("elections.wahlcheck.results.share.title") }}
      </h3>
      <p class="text-sm text-mid-gray sm:text-base">
        {{ $t("elections.wahlcheck.results.share.description") }}
      </p>
    </div>

    <!-- Tab switcher if official sharepic is configured in Directus -->
    <div v-if="hasOfficialSharepic" class="mb-6 flex justify-center">
      <div class="inline-flex rounded-full border border-solid-gray-20 bg-solid-gray-10 p-1">
        <button
          type="button"
          class="cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-all sm:text-sm"
          :class="activeTab === 'personal' ? 'bg-primary text-white shadow-xs' : 'text-mid-gray hover:text-black'"
          @click="activeTab = 'personal'"
        >
          {{ $t("elections.wahlcheck.results.share.tab_personal") }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-all sm:text-sm"
          :class="activeTab === 'official' ? 'bg-primary text-white shadow-xs' : 'text-mid-gray hover:text-black'"
          @click="activeTab = 'official'"
        >
          {{ $t("elections.wahlcheck.results.share.tab_official") }}
        </button>
      </div>
    </div>

    <!-- Main Container: Preview + Share Actions -->
    <div class="mx-auto grid max-w-4xl grid-cols-1 items-center gap-6 sm:gap-8 md:grid-cols-12">
      <!-- Story Frame Preview -->
      <div class="flex flex-col items-center md:col-span-5">
        <div
          class="@container relative aspect-9/16 w-full max-w-[270px] overflow-hidden rounded-2xl shadow-2xl ring-4 ring-stats-dark/10 sm:max-w-[290px]"
        >
          <!-- Dynamic generated sharepic preview (HTML/CSS Based -> No Canvas permission needed on load!) -->
          <div
            v-if="activeTab === 'personal'"
            ref="personalSharepicRef"
            data-testid="wahlcheck-personal-sharepic"
            class="sharepic-content relative flex h-full w-full flex-col gap-2 overflow-hidden px-4 pt-4 pb-16 select-none"
            :class="
              isDark
                ? 'bg-linear-to-b from-[#0a2731] via-[#0e3a47] to-[#164c5d] text-white'
                : isLocalzero
                  ? 'bg-linear-to-b from-[#ffffff] via-[#fff8df] to-[#ffefb5] text-stats-dark'
                  : 'bg-linear-to-b from-[#ffffff] via-[#f1f8f4] to-[#dfeee4] text-stats-dark'
            "
          >
            <!-- Background Glow Effects -->
            <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                class="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full blur-2xl"
                :class="isLocalzero ? 'bg-localzero-yellow/20' : isDark ? 'bg-ff-green/20' : 'bg-ff-green/15'"
              ></div>
              <div
                class="pointer-events-none absolute top-1/2 -left-12 h-44 w-44 rounded-full blur-3xl"
                :class="isDark ? 'bg-stats-light/20' : 'bg-stats-light/35'"
              ></div>
              <div
                class="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full blur-2xl"
                :class="isDark ? 'bg-orange/15' : 'bg-orange/10'"
              ></div>
            </div>

            <!-- Top Header & Logo -->
            <div class="relative z-10 shrink-0">
              <div class="mb-1 flex items-center justify-between gap-2">
                <div
                  class="sharepic-brand inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  :class="
                    isDark
                      ? 'border border-white/15 bg-white/10 text-white/90 backdrop-blur-md'
                      : 'border border-stats-dark/15 bg-stats-dark/5 text-stats-dark backdrop-blur-md'
                  "
                >
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-ff-green"></span>
                  <span>{{ $t("elections.wahlcheck.results.share.brand_name") }}</span>
                </div>
                <!-- SLK Header Logo -->
                <div class="flex h-8 items-center">
                  <img
                    v-if="isDark"
                    src="~/assets/images/Stadt-Land-Klima-Logo-dark.svg"
                    :alt="$t('logo.alt')"
                    class="sharepic-logo h-[26px] w-auto object-contain opacity-90 brightness-0 invert"
                  />
                  <img
                    v-else
                    src="~/assets/images/Stadt-Land-Klima-Logo.svg"
                    :alt="$t('logo.alt')"
                    class="sharepic-logo h-[26px] w-auto object-contain"
                  />
                </div>
              </div>

              <!-- Election Title -->
              <h4
                class="sharepic-title line-clamp-2 text-sm leading-tight font-extrabold sm:text-base"
                :class="isDark ? 'text-white' : 'text-stats-dark'"
              >
                {{ election?.descriptor || $t("elections.wahlcheck.results.share.brand_name") }}
              </h4>
              <p class="mt-0.5 text-[10px] font-bold" :class="isDark ? 'text-white/70' : 'text-mid-gray'">
                {{ $t("elections.wahlcheck.results.share.my_matches") }}
              </p>
            </div>

            <!-- Top 5 Candidates Cards (Mirrored from Candidates Overview) -->
            <div data-testid="wahlcheck-sharepic-matches" class="relative z-10 grid min-h-0 flex-1 auto-rows-fr gap-1">
              <div
                v-for="(result, idx) in topCandidates"
                :key="result.candidateId"
                class="sharepic-match flex flex-col justify-center rounded-xl p-1.5 text-stats-dark shadow-md"
                :class="
                  isDark
                    ? 'border border-white/20 bg-[#17212b] text-white backdrop-blur-md'
                    : 'border border-solid-gray-20 bg-white'
                "
              >
                <!-- Row 1: Rank Badge + Candidate Name + Party Tag -->
                <div class="mb-0.5 flex items-center justify-between gap-1.5">
                  <div class="flex min-w-0 flex-1 items-center gap-1.5">
                    <span
                      class="sharepic-rank flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stats-dark text-[10px] font-bold text-white"
                    >
                      {{ idx + 1 }}
                    </span>
                    <span
                      v-if="!isPartyElection"
                      class="sharepic-name truncate text-xs leading-tight font-bold"
                      :class="isDark ? 'text-white' : 'text-black'"
                    >
                      {{ getCandidateName(result.candidateId) }}
                    </span>
                    <CandidatePartyLabel
                      v-if="getCandidateParty(result.candidateId)"
                      :party="getCandidateParty(result.candidateId)"
                      :state="null"
                      class="max-w-32 min-w-0 truncate px-1.5 py-0 text-[9px]"
                    />
                  </div>
                  <!-- Percentage -->
                  <span class="sharepic-percentage shrink-0 text-xs font-extrabold text-ff-green">
                    {{ result.percentage.toFixed(1) }}%
                  </span>
                </div>

                <!-- Row 2: Full width progress bar (Mirrored exactly from Candidate Overview) -->
                <div
                  class="sharepic-progress h-2 w-full overflow-hidden rounded-full border border-solid-gray-30 bg-solid-gray-20"
                >
                  <div
                    class="h-full rounded-full"
                    :style="{
                      width: `${result.percentage}%`,
                      backgroundColor: getProgressColorHex(result.percentage),
                    }"
                  ></div>
                </div>
              </div>

              <!-- Fallback if no results -->
              <div
                v-if="topCandidates.length === 0"
                class="py-4 text-center text-xs"
                :class="isDark ? 'text-white/70' : 'text-mid-gray'"
              >
                {{ $t("elections.wahlcheck.results.share.empty") }}
              </div>
            </div>

            <!-- Bottom CTA -->
            <div data-testid="wahlcheck-sharepic-cta" class="relative z-10 shrink-0 text-center">
              <div
                v-if="isDark"
                class="sharepic-cta-content flex flex-wrap items-center justify-center gap-1 rounded-xl border border-white/20 bg-[#17212b] p-2 text-[11px] leading-tight font-bold text-white shadow-md"
              >
                <span><span aria-hidden="true">👉</span> {{ $t("elections.wahlcheck.results.share.cta_button") }}</span>
                <span class="text-light-green underline">{{ sharepicCtaUrl }}</span>
              </div>
              <div
                v-else
                class="sharepic-cta-content flex flex-wrap items-center justify-center gap-1 rounded-xl bg-stats-dark p-2 text-[11px] leading-tight font-bold text-white shadow-md"
              >
                <span><span aria-hidden="true">👉</span> {{ $t("elections.wahlcheck.results.share.cta_button") }}</span>
                <span class="text-stats-light underline">{{ sharepicCtaUrl }}</span>
              </div>
            </div>
          </div>

          <!-- Official Directus sharepic preview -->
          <img
            v-else-if="activeTab === 'official' && officialSharepicUrl"
            :src="officialSharepicUrl"
            :alt="$t('elections.wahlcheck.results.share.preview_alt')"
            class="h-full w-full object-cover"
          />

          <!-- Loading Placeholder -->
          <div
            v-else
            class="flex h-full w-full flex-col items-center justify-center p-4 text-center text-(--slk-text-muted)"
          >
            <span class="loading mb-3 loading-lg loading-spinner text-primary"></span>
            <span class="text-xs">{{ $t("elections.wahlcheck.results.share.loading") }}</span>
          </div>
        </div>

        <p class="mt-3 text-center text-xs text-(--slk-text-muted)">
          {{ $t("elections.wahlcheck.results.share.story_format") }} ·
          {{ $t("elections.wahlcheck.results.share.format_hint") }}
        </p>
      </div>

      <!-- Action Buttons & Sharing Options -->
      <div class="flex flex-col justify-center space-y-4 md:col-span-7">
        <!-- Toast / Hint notification -->
        <Transition name="fade">
          <div
            v-if="toastMessage"
            class="flex items-center gap-2.5 border border-(--slk-border) bg-(--slk-surface-subdued) p-3.5 text-xs font-medium text-stats-dark sm:text-sm"
          >
            <svg class="h-5 w-5 shrink-0 text-ff-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ toastMessage }}</span>
          </div>
        </Transition>

        <!-- Social share buttons -->
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CanonicalButton
            type="button"
            :disabled="isGenerating"
            :busy="isGenerating"
            :label="$t('elections.wahlcheck.results.share.button_insta')"
            icon-slug="mdi:instagram"
            :color="isLocalzero ? 'yellow' : 'dark'"
            variant="outline"
            :title="$t('elections.wahlcheck.results.share.button_insta')"
            @click="shareToStory"
          />

          <CanonicalButton
            type="button"
            :label="$t('elections.wahlcheck.results.share.button_whatsapp')"
            icon-slug="mdi:whatsapp"
            :color="isLocalzero ? 'yellow' : 'dark'"
            variant="outline"
            :title="$t('elections.wahlcheck.results.share.button_whatsapp')"
            @click="shareToWhatsApp"
          />

          <CanonicalButton
            type="button"
            :label="$t('elections.wahlcheck.results.share.button_linkedin')"
            icon-slug="mdi:linkedin"
            :color="isLocalzero ? 'yellow' : 'dark'"
            variant="outline"
            :title="$t('elections.wahlcheck.results.share.button_linkedin')"
            @click="shareToLinkedIn"
          />

          <CanonicalButton
            type="button"
            :disabled="isGenerating"
            :busy="isGenerating"
            :label="$t('elections.wahlcheck.results.share.button_tiktok')"
            icon-slug="simple-icons:tiktok"
            :color="isLocalzero ? 'yellow' : 'dark'"
            variant="outline"
            :title="$t('elections.wahlcheck.results.share.button_tiktok')"
            @click="shareToTikTok"
          />
        </div>

        <!-- Secondary Actions Grid -->
        <div class="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <!-- Download Image Button -->
          <CanonicalButton
            data-testid="wahlcheck-sharepic-download"
            :disabled="isGenerating"
            :label="$t('elections.wahlcheck.results.share.button_download')"
            icon-slug="mdi:download"
            :color="isLocalzero ? 'yellow' : 'dark'"
            variant="outline"
            @click="downloadActiveSharepic"
          />

          <!-- Copy Link Button -->
          <CanonicalButton
            data-testid="wahlcheck-share-link-copy"
            :label="
              linkCopied
                ? $t('elections.wahlcheck.results.share.link_copied')
                : $t('elections.wahlcheck.results.share.button_copy_link')
            "
            :icon-slug="linkCopied ? 'mdi:check' : 'mdi:content-copy'"
            :color="isLocalzero ? 'yellow' : linkCopied ? 'green' : 'dark'"
            variant="outline"
            @click="copyLink"
          />
        </div>

        <!-- Native Web Share (if browser supports it) -->
        <button
          v-if="canUseWebShare"
          type="button"
          :disabled="isGenerating"
          class="btn flex items-center justify-center gap-2 btn-ghost font-semibold text-mid-gray btn-sm hover:text-black"
          @click="shareViaWebShare"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          <span>{{ $t("elections.wahlcheck.results.share.button_native") }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { clientDiagnostic, clientFailure } from "~/shared/securityLog";

import type { PropType } from "vue";
import type { Election, WahlcheckResult, ElectionCandidate, UserAnswers } from "~/types/components/elections";

import { ref, computed, onMounted } from "vue";
import { toBlob } from "html-to-image";
import {
  getCandidateDisplayName,
  getCandidatePartyConfig as _getCandidatePartyConfig,
} from "~/shared/candidateParties";
import { useTheme } from "~/composables/useTheme";
import { wahlcheckStandaloneUrl } from "~/shared/wahlcheckUrls";

const props = defineProps({
  election: {
    type: Object as PropType<Election>,
    required: true,
  },
  sortedResults: {
    type: Array as PropType<WahlcheckResult[]>,
    required: true,
  },
  candidates: {
    type: Array as PropType<ElectionCandidate[]>,
    required: true,
  },
  userAnswers: {
    type: Object as PropType<UserAnswers | undefined>,
    default: () => ({}),
  },
  doubleWeightedQuestions: {
    type: [Set, Array] as PropType<Set<string> | string[] | undefined>,
    default: () => new Set(),
  },
});

const { $t } = useNuxtApp();
const config = useRuntimeConfig();
const { isDark: siteIsDark } = useTheme();
const { isLocalzero } = useWahlcheckTheme();
const isDark = computed(() => !isLocalzero.value && siteIsDark.value);
const isPartyElection = computed(() => props.election?.is_party_election === true);

// State
const activeTab = ref("personal");
const personalSharepicRef = ref<HTMLElement | null>(null);
const isGenerating = ref(false);
const toastMessage = ref("");
const linkCopied = ref(false);
const canUseWebShare = ref(false);
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

// Directus asset URL
const directusUrl = computed(() => {
  return config.public.clientDirectusUrl || "http://127.0.0.1:8081";
});

// Top 5 Candidates
const topCandidates = computed(() => {
  return props.sortedResults.slice(0, 5);
});

const sharepicCtaUrl = "stadt-land-klima.de/wahl";

// Official Sharepic Fallback:
// If dark mode -> check sharepic_dark, fallback to sharepic
// If light mode -> check sharepic, fallback to sharepic_dark
const officialLightSharepic = computed(() => {
  const sp = props.election?.sharepic;
  if (!sp) return null;
  return typeof sp === "string" ? sp : sp.id;
});

const officialDarkSharepic = computed(() => {
  const sp = props.election?.sharepic_dark;
  if (!sp) return null;
  return typeof sp === "string" ? sp : sp.id;
});

const activeOfficialSharepicId = computed(() => {
  if (isDark.value) {
    return officialDarkSharepic.value || officialLightSharepic.value;
  } else {
    return officialLightSharepic.value || officialDarkSharepic.value;
  }
});

const hasOfficialSharepic = computed(() => {
  return !!activeOfficialSharepicId.value;
});

const officialSharepicUrl = computed(() => {
  if (!activeOfficialSharepicId.value) return "";
  return `${directusUrl.value}/assets/${activeOfficialSharepicId.value}`;
});

// Candidate helpers
function getCandidate(candidateId: string) {
  return props.candidates.find((c) => c.id === candidateId) || { id: candidateId };
}

function getCandidateName(candidateId: string) {
  const candidate = getCandidate(candidateId);
  return getCandidateDisplayName(candidate) || $t("elections.unknown_candidate");
}

function getCandidateParty(candidateId: string) {
  return getCandidate(candidateId).party || "";
}

function getProgressColorHex(percentage: number) {
  if (percentage >= 80) return isLocalzero.value ? "#2e7041" : "#1EA64A";
  if (percentage >= 60) return isLocalzero.value ? "#a3d869" : "#AFCA0B";
  if (percentage >= 40) return isLocalzero.value ? "#ffc80c" : "#FFD400";
  if (percentage >= 20) return isLocalzero.value ? "#c05031" : "#F39200";
  return isLocalzero.value ? "#b13c28" : "#E30613";
}

// Generate share URL
function getShareUrl() {
  if (typeof window === "undefined") return "";
  return wahlcheckStandaloneUrl(window.location.href);
}

// Check native Web Share support on mount
onMounted(() => {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    canUseWebShare.value = true;
  }
});

async function waitForSharepicAssets(element: HTMLElement) {
  if (document.fonts) {
    await document.fonts.ready;
  }

  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }

      if (typeof image.decode === "function") {
        await image.decode().catch(() => undefined);
      }
    }),
  );
}

// Export the actual preview DOM so the downloaded/shared image cannot drift
// into a separately maintained canvas layout.
async function generateDynamicSharepicBlob() {
  if (typeof window === "undefined") return null;
  const element = personalSharepicRef.value;
  if (!element) return null;

  isGenerating.value = true;

  try {
    await waitForSharepicAssets(element);

    const { width, height } = element.getBoundingClientRect();
    if (!width || !height) return null;

    return await toBlob(element, {
      width,
      height,
      canvasWidth: 1080,
      canvasHeight: 1920,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: isDark.value ? "#0a2731" : "#ffffff",
    });
  } catch (err) {
    clientFailure("app.components.Elections.WahlCheckShare.generateDynamicSharepicBlob.failed", err);
    return null;
  } finally {
    isGenerating.value = false;
  }
}

// Build the file for the currently selected personal or official sharepic.
async function getActiveSharepicFile() {
  if (activeTab.value === "official") {
    if (!officialSharepicUrl.value) return null;
    try {
      const response = await fetch(officialSharepicUrl.value);
      const blob = await response.blob();
      const filename = `klimawahlcheck-${props.election?.descriptor?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "ergebnis"}.png`;
      return new File([blob], filename, { type: blob.type || "image/png" });
    } catch (err) {
      clientFailure("app.components.Elections.WahlCheckShare.getActiveSharepicFile.failed", err);
      return null;
    }
  }

  const blob = await generateDynamicSharepicBlob();
  if (!blob) return null;

  const filename = `klimawahlcheck-${props.election?.descriptor?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "ergebnis"}.png`;
  return new File([blob], filename, { type: "image/png" });
}

// Download Active Sharepic
async function downloadActiveSharepic() {
  const file = await getActiveSharepicFile();
  if (!file) return;

  try {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast($t("elections.wahlcheck.results.share.insta_hint"));
  } catch (err) {
    clientFailure("app.components.Elections.WahlCheckShare.downloadActiveSharepic.failed", err);
  }
}

// Share to Instagram / TikTok Story
async function shareToStory() {
  const file = await getActiveSharepicFile();

  // If Web Share API supports file sharing (typically mobile phones), trigger native story share
  if (
    file &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: props.election?.descriptor || $t("elections.wahlcheck.results.share.brand_name"),
        text: `${$t("elections.wahlcheck.results.share.my_matches")}: ${props.election?.descriptor || $t("elections.wahlcheck.results.share.brand_name")}`,
        files: [file],
      });
      return;
    } catch (err) {
      if ((err instanceof Error ? err.name : undefined) !== "AbortError") {
        clientDiagnostic("app.components.Elections.WahlCheckShare.shareToStory.degraded", "warn");
      } else {
        return;
      }
    }
  }

  // Fallback on Desktop or unsupported browsers: Download the image and show helpful Instagram/TikTok instructions
  if (file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast($t("elections.wahlcheck.results.share.insta_hint"));
  }
}

// Share to WhatsApp
function shareToWhatsApp() {
  const electionTitle = props.election?.descriptor || $t("elections.wahlcheck.results.share.brand_name");
  const shareUrl = getShareUrl();
  let text = $t(
    isPartyElection.value
      ? "elections.wahlcheck.results.share.whatsapp_text_parties"
      : "elections.wahlcheck.results.share.whatsapp_text",
    { ":election": electionTitle },
  );
  if (!text.includes(electionTitle)) {
    text = `${text} ${electionTitle}`;
  }
  const fullText = `${text}\n\n${shareUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
  window.open(whatsappUrl, "_blank");
}

// Share the result URL through LinkedIn's official share endpoint.
function shareToLinkedIn() {
  const shareUrl = getShareUrl();
  if (!shareUrl) return;

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  window.open(linkedinUrl, "_blank", "noopener,noreferrer");
}

// TikTok does not provide a public web share endpoint for an image story.
// Reuse the native file share on supported phones and the download fallback elsewhere.
async function shareToTikTok() {
  await shareToStory();
}

// Share via Native Web Share API
async function shareViaWebShare() {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return;

  const file = await getActiveSharepicFile();
  const shareUrl = getShareUrl();
  const title = props.election?.descriptor || $t("elections.wahlcheck.results.share.brand_name");
  const text = $t(
    isPartyElection.value
      ? "elections.wahlcheck.results.share.whatsapp_text_parties"
      : "elections.wahlcheck.results.share.whatsapp_text",
    { ":election": title },
  );

  try {
    if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ title, text, url: shareUrl, files: [file] });
    } else {
      await navigator.share({ title, text, url: shareUrl });
    }
  } catch (err) {
    if ((err instanceof Error ? err.name : undefined) !== "AbortError") {
      clientFailure("app.components.Elections.WahlCheckShare.shareViaWebShare.failed", err);
    }
  }
}

// Copy link to clipboard
function copyLink() {
  const url = getShareUrl();
  if (!url) return;

  void navigator.clipboard.writeText(url).then(() => {
    linkCopied.value = true;
    showToast($t("elections.wahlcheck.results.share.link_copied"));
    setTimeout(() => {
      linkCopied.value = false;
    }, 2500);
  });
}

// Toast notification helper
function showToast(message: string) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastMessage.value = message;
  toastTimeout = setTimeout(() => {
    toastMessage.value = "";
  }, 5000);
}
</script>

<style scoped>
/* Fit all five matches above the story safe area even in narrow iframe previews. */
@container (max-width: 250px) {
  .sharepic-content {
    gap: 0.375rem;
    padding-top: 0.5rem;
    padding-inline: 0.5rem;
  }

  .sharepic-brand {
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    font-size: 0.5rem;
  }

  .sharepic-logo {
    height: 1.375rem;
  }

  .sharepic-match {
    padding: 0.25rem;
  }

  .sharepic-name,
  .sharepic-percentage,
  .sharepic-cta-content {
    font-size: 0.625rem;
  }

  .sharepic-title {
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .sharepic-rank {
    width: 1rem;
    height: 1rem;
  }

  .sharepic-progress {
    height: 0.375rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
