<template>
  <div class="bg-white p-4 sm:p-8 rounded-xl shadow-list border border-solid-gray-10 mt-8">
    <div class="text-center max-w-2xl mx-auto mb-6">
      <h3 class="text-xl sm:text-2xl font-bold text-stats-dark mb-2">
        {{ $t('elections.wahlcheck.results.share.title') }}
      </h3>
      <p class="text-sm sm:text-base text-mid-gray">
        {{ $t('elections.wahlcheck.results.share.description') }}
      </p>
    </div>

    <!-- Tab switcher if official sharepic is configured in Directus -->
    <div v-if="hasOfficialSharepic" class="flex justify-center mb-6">
      <div class="inline-flex rounded-full bg-solid-gray-10 p-1 border border-solid-gray-20">
        <button
          type="button"
          class="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          :class="activeTab === 'personal' ? 'bg-primary text-white shadow-sm' : 'text-mid-gray hover:text-black'"
          @click="activeTab = 'personal'"
        >
          {{ $t('elections.wahlcheck.results.share.tab_personal') }}
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          :class="activeTab === 'official' ? 'bg-primary text-white shadow-sm' : 'text-mid-gray hover:text-black'"
          @click="activeTab = 'official'"
        >
          {{ $t('elections.wahlcheck.results.share.tab_official') }}
        </button>
      </div>
    </div>

    <!-- Main Container: Preview + Share Actions -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center max-w-4xl mx-auto">
      <!-- Story Frame Preview -->
      <div class="md:col-span-5 flex flex-col items-center">
        <div
          class="w-full max-w-[270px] sm:max-w-[290px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-4 border-stats-dark/10 relative group transition-transform hover:scale-[1.01]"
          :class="isDark ? 'bg-stats-dark' : 'bg-[#e8f4ec]'"
        >
          <!-- Dynamic generated sharepic preview (HTML/CSS Based -> No Canvas permission needed on load!) -->
          <div
            v-if="activeTab === 'personal'"
            class="w-full h-full p-4 flex flex-col justify-between select-none relative overflow-hidden"
            :class="isDark ? 'bg-gradient-to-b from-[#0a2731] via-[#0e3a47] to-[#164c5d] text-white' : 'bg-gradient-to-b from-[#ffffff] via-[#f1f8f4] to-[#dfeee4] text-stats-dark'"
          >
            <!-- Background Glow Effects -->
            <div
              class="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-2xl pointer-events-none"
              :class="isDark ? 'bg-ff-green/20' : 'bg-ff-green/15'"
            ></div>
            <div
              class="absolute top-1/2 -left-12 w-44 h-44 rounded-full blur-3xl pointer-events-none"
              :class="isDark ? 'bg-stats-light/20' : 'bg-stats-light/35'"
            ></div>
            <div
              class="absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-2xl pointer-events-none"
              :class="isDark ? 'bg-orange/15' : 'bg-orange/10'"
            ></div>

            <!-- Top Header & Logo -->
            <div class="relative z-10">
              <div class="flex items-center justify-between gap-2 mb-3">
                <div
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                  :class="isDark ? 'bg-white/10 backdrop-blur-md border border-white/15 text-white/90' : 'bg-stats-dark/5 backdrop-blur-md border border-stats-dark/15 text-stats-dark'"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-ff-green animate-pulse"></span>
                  <span>Klimawahlcheck</span>
                </div>
                <!-- SLK Header Logo -->
                <div class="h-8 flex items-center">
                  <img
                    v-if="isDark"
                    src="~/assets/images/Stadt-Land-Klima-Logo-dark.svg"
                    alt="Stadt.Land.Klima!"
                    class="h-[26px] w-auto object-contain brightness-0 invert opacity-90"
                  />
                  <img
                    v-else
                    src="~/assets/images/Stadt-Land-Klima-Logo.svg"
                    alt="Stadt.Land.Klima!"
                    class="h-[26px] w-auto object-contain"
                  />
                </div>
              </div>

              <!-- Election Title -->
              <h4
                class="text-sm sm:text-base font-extrabold leading-tight line-clamp-2"
                :class="isDark ? 'text-white' : 'text-stats-dark'"
              >
                {{ election?.descriptor || 'Klimawahlcheck' }}
              </h4>
              <p
                class="text-[10px] mt-0.5 font-medium"
                :class="isDark ? 'text-white/70' : 'text-mid-gray'"
              >
                {{ $t('elections.wahlcheck.results.share.my_matches') }}
              </p>
            </div>

            <!-- Top 5 Candidates Cards (Mirrored from Candidates Overview) -->
            <div class="relative z-10 space-y-2 my-auto">
              <div
                v-for="(result, idx) in topCandidates"
                :key="result.candidateId"
                class="rounded-xl p-2.5 shadow-md text-stats-dark"
                :class="isDark ? 'bg-white/95 backdrop-blur-md border border-white/20' : 'bg-white border border-solid-gray-20'"
              >
                <!-- Row 1: Rank Badge + Candidate Name + Party Tag -->
                <div class="flex items-center justify-between gap-1.5 mb-1.5">
                  <div class="flex items-center gap-1.5 min-w-0 flex-1">
                    <span class="w-5 h-5 rounded-full bg-stats-dark text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                      {{ idx + 1 }}
                    </span>
                    <span class="font-bold text-xs text-black truncate leading-tight">
                      {{ getCandidateName(result.candidateId) }}
                    </span>
                    <CandidatePartyLabel
                      v-if="getCandidateParty(result.candidateId)"
                      :party="getCandidateParty(result.candidateId)"
                      :state="null"
                      class="text-[9px] px-1.5 py-0 flex-shrink-0"
                    />
                  </div>
                  <!-- Percentage -->
                  <span class="font-extrabold text-xs text-ff-green flex-shrink-0">
                    {{ result.percentage.toFixed(1) }}%
                  </span>
                </div>

                <!-- Row 2: Full width progress bar (Mirrored exactly from Candidate Overview) -->
                <div class="w-full bg-solid-gray-20 rounded-full h-2 overflow-hidden border border-solid-gray-30">
                  <div
                    class="h-full rounded-full transition-all duration-700"
                    :style="{
                      width: `${result.percentage}%`,
                      backgroundColor: getProgressColorHex(result.percentage)
                    }"
                  ></div>
                </div>
              </div>

              <!-- Fallback if no results -->
              <div
                v-if="topCandidates.length === 0"
                class="text-xs text-center py-4"
                :class="isDark ? 'text-white/70' : 'text-mid-gray'"
              >
                Keine Ergebnisse vorhanden
              </div>

              <div
                v-else-if="hasMoreCandidates"
                class="text-center text-xl font-extrabold leading-none tracking-[0.35em]"
                :class="isDark ? 'text-white/80' : 'text-stats-dark/70'"
                aria-hidden="true"
              >
                ...
              </div>
            </div>

            <!-- Bottom CTA -->
            <div class="relative z-10 text-center pt-2">
              <div
                v-if="isDark"
                class="bg-gradient-to-r from-ff-green to-stats-light rounded-xl p-2 text-stats-dark shadow-md font-bold text-[11px] leading-tight flex items-center justify-center gap-1"
              >
                <span>👉 {{ $t('elections.wahlcheck.results.share.cta_button') }}</span>
                <span class="underline">{{ sharepicCtaUrl }}</span>
              </div>
              <div
                v-else
                class="bg-stats-dark rounded-xl p-2 text-white shadow-md font-bold text-[11px] leading-tight flex items-center justify-center gap-1"
              >
                <span>👉 {{ $t('elections.wahlcheck.results.share.cta_button') }}</span>
                <span class="underline text-stats-light">{{ sharepicCtaUrl }}</span>
              </div>
            </div>
          </div>

          <!-- Official Directus sharepic preview -->
          <img
            v-else-if="activeTab === 'official' && officialSharepicUrl"
            :src="officialSharepicUrl"
            :alt="$t('elections.wahlcheck.results.share.preview_alt')"
            class="w-full h-full object-cover"
          />

          <!-- Loading Placeholder -->
          <div v-else class="w-full h-full flex flex-col items-center justify-center text-white/80 p-4 text-center">
            <span class="loading loading-spinner loading-lg text-primary mb-3"></span>
            <span class="text-xs">Lade Sharepic...</span>
          </div>

          <!-- Story badge indicator -->
          <div class="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 pointer-events-none z-20">
            <span class="w-1.5 h-1.5 rounded-full bg-ff-green animate-pulse"></span>
            <span>9:16 Story</span>
          </div>
        </div>

        <p class="text-xs text-solid-gray-50 mt-3 text-center">
          Format optimal für Instagram, TikTok & WhatsApp Status
        </p>
      </div>

      <!-- Action Buttons & Sharing Options -->
      <div class="md:col-span-7 flex flex-col justify-center space-y-4">
        <!-- Toast / Hint notification -->
        <Transition name="fade">
          <div
            v-if="toastMessage"
            class="p-3.5 rounded-xl bg-solid-ff-green-10 border border-solid-ff-green-30 text-stats-dark text-xs sm:text-sm font-medium flex items-center gap-2.5"
          >
            <svg class="w-5 h-5 text-ff-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ toastMessage }}</span>
          </div>
        </Transition>

        <!-- Compact social share buttons -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            @click="shareToStory"
            :disabled="isGenerating"
            class="btn btn-outline flex h-10 min-h-0 items-center justify-center gap-2 rounded-lg border-solid-gray-30 bg-white px-2 text-xs font-semibold text-stats-dark transition-all hover:border-ff-green hover:bg-solid-ff-green-05"
            :aria-label="$t('elections.wahlcheck.results.share.button_insta')"
            :title="$t('elections.wahlcheck.results.share.button_insta')"
          >
            <span v-if="isGenerating" class="loading loading-spinner loading-xs"></span>
            <img v-else src="~/assets/icons/icon_instagram.svg" alt="" class="h-5 w-5" />
            <span>{{ $t('elections.wahlcheck.results.share.button_insta') }}</span>
          </button>

          <button
            type="button"
            @click="shareToWhatsApp"
            class="btn btn-outline flex h-10 min-h-0 items-center justify-center gap-2 rounded-lg border-solid-gray-30 bg-white px-2 text-xs font-semibold text-stats-dark transition-all hover:border-ff-green hover:bg-solid-ff-green-05"
            :aria-label="$t('elections.wahlcheck.results.share.button_whatsapp')"
            :title="$t('elections.wahlcheck.results.share.button_whatsapp')"
          >
            <img src="~/assets/icons/icon_whatsapp.svg" alt="" class="h-5 w-5" />
            <span>{{ $t('elections.wahlcheck.results.share.button_whatsapp') }}</span>
          </button>

          <button
            type="button"
            @click="shareToLinkedIn"
            class="btn btn-outline flex h-10 min-h-0 items-center justify-center gap-2 rounded-lg border-solid-gray-30 bg-white px-2 text-xs font-semibold text-stats-dark transition-all hover:border-ff-green hover:bg-solid-ff-green-05"
            :aria-label="$t('elections.wahlcheck.results.share.button_linkedin')"
            :title="$t('elections.wahlcheck.results.share.button_linkedin')"
          >
            <img src="~/assets/icons/icon_linkedin.svg" alt="" class="h-5 w-5" />
            <span>{{ $t('elections.wahlcheck.results.share.button_linkedin') }}</span>
          </button>

          <button
            type="button"
            @click="shareToTikTok"
            :disabled="isGenerating"
            class="btn btn-outline flex h-10 min-h-0 items-center justify-center gap-2 rounded-lg border-solid-gray-30 bg-white px-2 text-xs font-semibold text-stats-dark transition-all hover:border-ff-green hover:bg-solid-ff-green-05"
            :aria-label="$t('elections.wahlcheck.results.share.button_tiktok')"
            :title="$t('elections.wahlcheck.results.share.button_tiktok')"
          >
            <img v-if="!isGenerating" src="~/assets/icons/icon_tiktok.svg" alt="" class="h-5 w-5" />
            <span v-else class="loading loading-spinner loading-xs"></span>
            <span>{{ $t('elections.wahlcheck.results.share.button_tiktok') }}</span>
          </button>
        </div>

        <!-- Secondary Actions Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <!-- Download Image Button -->
          <button
            type="button"
            @click="downloadActiveSharepic"
            :disabled="isGenerating"
            class="btn btn-outline btn-secondary rounded-xl py-2.5 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{{ $t('elections.wahlcheck.results.share.button_download') }}</span>
          </button>

          <!-- Copy Link Button -->
          <button
            type="button"
            @click="copyLink"
            class="btn btn-outline rounded-xl py-2.5 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            :class="linkCopied ? 'border-ff-green text-ff-green bg-solid-ff-green-10' : 'btn-secondary'"
          >
            <svg v-if="linkCopied" class="w-4 h-4 text-ff-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{{ linkCopied ? $t('elections.wahlcheck.results.share.link_copied') : $t('elections.wahlcheck.results.share.button_copy_link') }}</span>
          </button>
        </div>

        <!-- Native Web Share (if browser supports it) -->
        <button
          v-if="canUseWebShare"
          type="button"
          @click="shareViaWebShare"
          :disabled="isGenerating"
          class="btn btn-ghost btn-sm text-mid-gray hover:text-black font-semibold flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>{{ $t('elections.wahlcheck.results.share.button_native') }}</span>
        </button>
      </div>
    </div>

    <!-- Hidden Canvas for high-res 1080x1920 Story export (Only generated when clicking Share/Download!) -->
    <canvas ref="canvasRef" width="1080" height="1920" class="hidden"></canvas>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  candidateNameMatchesParty,
  candidateParties,
  getCandidateDisplayName,
  getCandidatePartyLabel,
} from '~/shared/candidateParties.js'
import { useTheme } from '~/composables/useTheme'
import logoDarkSvg from '~/assets/images/Stadt-Land-Klima-Logo-dark.svg'
import logoLightSvg from '~/assets/images/Stadt-Land-Klima-Logo.svg'

const props = defineProps({
  election: {
    type: Object,
    required: true
  },
  sortedResults: {
    type: Array,
    required: true
  },
  candidates: {
    type: Array,
    required: true
  },
  userAnswers: {
    type: Object,
    default: () => ({})
  },
  doubleWeightedQuestions: {
    type: [Set, Array],
    default: () => new Set()
  }
})

const { $t } = useNuxtApp()
const config = useRuntimeConfig()
const { isDark } = useTheme()

// State
const activeTab = ref('personal')
const canvasRef = ref(null)
const isGenerating = ref(false)
const toastMessage = ref('')
const linkCopied = ref(false)
const canUseWebShare = ref(false)
let toastTimeout = null

// Directus asset URL
const directusUrl = computed(() => {
  return config.public.clientDirectusUrl || 'http://127.0.0.1:8081'
})

// Top 5 Candidates
const topCandidates = computed(() => {
  return props.sortedResults.slice(0, 5)
})

const hasMoreCandidates = computed(() => props.sortedResults.length > topCandidates.value.length)
const sharepicCtaUrl = 'stadt-land-klima.de/wahl'

// Official Sharepic Fallback:
// If dark mode -> check sharepic_dark, fallback to sharepic
// If light mode -> check sharepic, fallback to sharepic_dark
const officialLightSharepic = computed(() => {
  const sp = props.election?.sharepic
  if (!sp) return null
  return typeof sp === 'string' ? sp : sp.id
})

const officialDarkSharepic = computed(() => {
  const sp = props.election?.sharepic_dark
  if (!sp) return null
  return typeof sp === 'string' ? sp : sp.id
})

const activeOfficialSharepicId = computed(() => {
  if (isDark.value) {
    return officialDarkSharepic.value || officialLightSharepic.value
  } else {
    return officialLightSharepic.value || officialDarkSharepic.value
  }
})

const hasOfficialSharepic = computed(() => {
  return !!activeOfficialSharepicId.value
})

const officialSharepicUrl = computed(() => {
  if (!activeOfficialSharepicId.value) return ''
  return `${directusUrl.value}/assets/${activeOfficialSharepicId.value}`
})

// Candidate helpers
function getCandidate(candidateId) {
  return props.candidates.find((c) => c.id === candidateId) || {}
}

function getCandidateName(candidateId) {
  const candidate = getCandidate(candidateId)
  return getCandidateDisplayName(candidate) || $t('elections.unknown_candidate')
}

function getCandidateParty(candidateId) {
  const candidate = getCandidate(candidateId)
  return candidate.party && !candidateNameMatchesParty(candidate) ? candidate.party : ''
}

function getProgressColorHex(percentage) {
  if (percentage >= 80) return '#1EA64A'
  if (percentage >= 60) return '#AFCA0B'
  if (percentage >= 40) return '#FFD400'
  if (percentage >= 20) return '#F39200'
  return '#E30613'
}

// Generate share URL
function getShareUrl() {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

// Check native Web Share support on mount
onMounted(() => {
  if (typeof navigator !== 'undefined' && navigator.share) {
    canUseWebShare.value = true
  }
})

// Helper: Rounded Rectangle
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius)
  } else {
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }
}

// Helper: Wrap Text
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i]
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = words[i]
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines
}

// Helper: Load Image
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Generate the 1080x1920 dynamic sharepic only on demand
async function generateDynamicCanvas() {
  if (typeof window === 'undefined') return null
  const canvas = canvasRef.value
  if (!canvas) return null

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  isGenerating.value = true

  const width = 1080
  const height = 1920
  const dark = isDark.value

  // 1. Background Gradient
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
  if (dark) {
    bgGradient.addColorStop(0, '#0a2731')
    bgGradient.addColorStop(0.5, '#0e3a47')
    bgGradient.addColorStop(1, '#164c5d')
  } else {
    bgGradient.addColorStop(0, '#ffffff')
    bgGradient.addColorStop(0.5, '#f1f8f4')
    bgGradient.addColorStop(1, '#dfeee4')
  }
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // 2. Decorative Glowing Radial Orbs
  const drawGlow = (x, y, r, color) => {
    const radial = ctx.createRadialGradient(x, y, 0, x, y, r)
    radial.addColorStop(0, color)
    radial.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = radial
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  if (dark) {
    drawGlow(960, 200, 420, 'rgba(175, 202, 11, 0.22)')
    drawGlow(100, 950, 500, 'rgba(35, 115, 80, 0.25)')
    drawGlow(900, 1680, 460, 'rgba(243, 146, 0, 0.16)')
  } else {
    drawGlow(960, 200, 420, 'rgba(175, 202, 11, 0.16)')
    drawGlow(100, 950, 500, 'rgba(164, 200, 56, 0.28)')
    drawGlow(900, 1680, 460, 'rgba(243, 146, 0, 0.10)')
  }

  // 3. Header Area
  // Top Pill Badge
  const badgeX = 80
  const badgeY = 100
  const badgeW = 340
  const badgeH = 56
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(10, 39, 49, 0.06)'
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 28)
  ctx.fill()
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(10, 39, 49, 0.15)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Green pulse dot inside badge
  ctx.fillStyle = '#AFCA0B'
  ctx.beginPath()
  ctx.arc(badgeX + 32, badgeY + badgeH / 2, 8, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = dark ? '#ffffff' : '#0a2731'
  ctx.font = '700 24px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('KLIMAWAHLCHECK', badgeX + 54, badgeY + badgeH / 2 + 1)

  // Header Logo (Right side)
  const logoUrl = dark ? logoDarkSvg : logoLightSvg
  const logoImg = await loadImage(logoUrl)
  if (logoImg) {
    const logoW = 338
    const logoH = (logoImg.height / logoImg.width) * logoW
    ctx.drawImage(logoImg, width - 80 - logoW, badgeY + (badgeH - logoH) / 2, logoW, logoH)
  } else {
    // Fallback Logo text
    ctx.fillStyle = dark ? '#ffffff' : '#0a2731'
    ctx.font = '800 28px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('Stadt.Land.Klima!', width - 80, badgeY + badgeH / 2)
  }

  // Election Title
  const electionTitle = props.election?.descriptor || 'Klimawahlcheck'
  ctx.fillStyle = dark ? '#ffffff' : '#0a2731'
  ctx.font = '800 52px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const titleLines = wrapText(ctx, electionTitle, width - 160)
  let currentY = 190
  titleLines.slice(0, 2).forEach((line) => {
    ctx.fillText(line, 80, currentY)
    currentY += 64
  })

  // Subtitle / Results Intro
  currentY += 10
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.75)' : '#4b5563'
  ctx.font = '600 28px system-ui, -apple-system, sans-serif'
  ctx.fillText($t('elections.wahlcheck.results.share.my_matches'), 80, currentY)

  // 4. Candidate Match Cards (Top 5 Candidates)
  let cardY = currentY + 60
  const cardW = width - 160
  const cardH = props.sortedResults.length > 3 ? 190 : 220
  const cardRadius = 28
  const cardGap = props.sortedResults.length > 3 ? 20 : 30

  const top5 = props.sortedResults.slice(0, 5)

  for (let i = 0; i < top5.length; i++) {
    const item = top5[i]
    const candidateName = getCandidateName(item.candidateId)
    const partyKey = getCandidateParty(item.candidateId)
    const partyLabel = partyKey ? getCandidatePartyLabel(partyKey) : ''
    const percentage = item.percentage || 0

    // Card Background
    ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.95)' : '#ffffff'
    drawRoundedRect(ctx, 80, cardY, cardW, cardH, cardRadius)
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.08)'
    ctx.lineWidth = dark ? 3 : 2
    ctx.stroke()

    // Rank Circle
    const rankX = 130
    const rankY = cardY + 60
    ctx.fillStyle = '#0a2731'
    ctx.beginPath()
    ctx.arc(rankX, rankY, 32, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = '800 28px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${i + 1}`, rankX, rankY + 1)

    // Candidate Name
    ctx.fillStyle = '#000000'
    ctx.font = '800 36px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    // Truncate name if too long
    let nameText = candidateName
    while (ctx.measureText(nameText).width > 420 && nameText.length > 3) {
      nameText = nameText.slice(0, -2) + '…'
    }
    ctx.fillText(nameText, rankX + 50, rankY - 10)

    // Party Pill Tag
    if (partyLabel) {
      const partyConf = candidateParties[partyKey] || { color: '#cccccc', textColor: '#ffffff' }
      const partyBg = partyConf.color
      const partyText = partyConf.textColor

      ctx.font = '700 20px system-ui, -apple-system, sans-serif'
      const partyMetrics = ctx.measureText(partyLabel)
      const pillW = partyMetrics.width + 24
      const pillH = 34
      const pillX = rankX + 50
      const pillY = rankY + 18

      ctx.fillStyle = partyBg
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 17)
      ctx.fill()

      ctx.fillStyle = partyText
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(partyLabel, pillX + pillW / 2, pillY + pillH / 2 + 1)
    }

    // Match Percentage
    ctx.fillStyle = '#1EA64A'
    ctx.font = '900 48px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${percentage.toFixed(1)}%`, 80 + cardW - 40, rankY)

    // Full-width Progress Bar
    const barX = 120
    const barY = cardY + (props.sortedResults.length > 3 ? 115 : 135)
    const barW = cardW - 80
    const barH = 26
    const barRadius = 13

    // Progress bar track
    ctx.fillStyle = '#e5e7eb'
    drawRoundedRect(ctx, barX, barY, barW, barH, barRadius)
    ctx.fill()

    // Progress bar fill
    const fillW = Math.max(barRadius * 2, (barW * percentage) / 100)
    ctx.fillStyle = getProgressColorHex(percentage)
    drawRoundedRect(ctx, barX, barY, fillW, barH, barRadius)
    ctx.fill()

    cardY += cardH + cardGap
  }

  if (props.sortedResults.length > top5.length) {
    ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(10, 39, 49, 0.7)'
    ctx.font = '900 42px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('...', width / 2, cardY - cardGap / 2)
  }

  // 5. Call To Action Button (Bottom Area)
  const ctaBoxY = height - 420
  const ctaBoxH = 240
  const ctaBoxW = width - 160

  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 39, 49, 0.04)'
  drawRoundedRect(ctx, 80, ctaBoxY, ctaBoxW, ctaBoxH, 32)
  ctx.fill()
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(10, 39, 49, 0.12)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = dark ? '#ffffff' : '#0a2731'
  ctx.font = '800 38px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText($t('elections.wahlcheck.results.share.cta_title'), width / 2, ctaBoxY + 35)

  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.8)' : '#4b5563'
  ctx.font = '500 26px system-ui, -apple-system, sans-serif'
  ctx.fillText($t('elections.wahlcheck.results.share.cta_text'), width / 2, ctaBoxY + 85)

  // Action Button
  const btnW = 540
  const btnH = 68
  const btnX = width / 2 - btnW / 2
  const btnY = ctaBoxY + 138

  ctx.fillStyle = dark ? '#AFCA0B' : '#0a2731'
  drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 34)
  ctx.fill()

  ctx.fillStyle = dark ? '#0a2731' : '#ffffff'
  ctx.font = '800 28px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`👉 ${$t('elections.wahlcheck.results.share.cta_button')} ${sharepicCtaUrl}`, width / 2, btnY + btnH / 2)

  isGenerating.value = false
  return canvas
}

// Convert data URL or canvas to File/Blob
async function getActiveSharepicFile() {
  if (activeTab.value === 'official') {
    if (!officialSharepicUrl.value) return null
    try {
      const response = await fetch(officialSharepicUrl.value)
      const blob = await response.blob()
      const filename = `klimawahlcheck-${props.election?.descriptor?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'ergebnis'}.png`
      return new File([blob], filename, { type: blob.type || 'image/png' })
    } catch (err) {
      console.error('Error creating official sharepic file:', err)
      return null
    }
  }

  // Personal Tab: Generate on demand
  const canvas = await generateDynamicCanvas()
  if (!canvas) return null

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null)
      const filename = `klimawahlcheck-${props.election?.descriptor?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'ergebnis'}.png`
      resolve(new File([blob], filename, { type: 'image/png' }))
    }, 'image/png')
  })
}

// Download Active Sharepic
async function downloadActiveSharepic() {
  const file = await getActiveSharepicFile()
  if (!file) return

  try {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showToast($t('elections.wahlcheck.results.share.insta_hint'))
  } catch (err) {
    console.error('Error downloading sharepic:', err)
  }
}

// Share to Instagram / TikTok Story
async function shareToStory() {
  const file = await getActiveSharepicFile()

  // If Web Share API supports file sharing (typically mobile phones), trigger native story share
  if (file && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: props.election?.descriptor || 'Klimawahlcheck',
        text: 'Mein Ergebnis beim Klimawahlcheck auf stadt-land-klima.de',
        files: [file]
      })
      return
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Native file share error, fallback to download:', err)
      } else {
        return
      }
    }
  }

  // Fallback on Desktop or unsupported browsers: Download the image and show helpful Instagram/TikTok instructions
  if (file) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast($t('elections.wahlcheck.results.share.insta_hint'))
  }
}

// Share to WhatsApp
function shareToWhatsApp() {
  const electionTitle = props.election?.descriptor || 'Klimawahlcheck'
  const shareUrl = getShareUrl()
  let text = $t('elections.wahlcheck.results.share.whatsapp_text', { ':election': electionTitle })
  if (!text.includes(electionTitle)) {
    text = `${text} ${electionTitle}`
  }
  const fullText = `${text}\n\n${shareUrl}`
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`
  window.open(whatsappUrl, '_blank')
}

// Share the result URL through LinkedIn's official share endpoint.
function shareToLinkedIn() {
  const shareUrl = getShareUrl()
  if (!shareUrl) return

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
  window.open(linkedinUrl, '_blank', 'noopener,noreferrer')
}

// TikTok does not provide a public web share endpoint for an image story.
// Reuse the native file share on supported phones and the download fallback elsewhere.
async function shareToTikTok() {
  await shareToStory()
}

// Share via Native Web Share API
async function shareViaWebShare() {
  if (typeof navigator === 'undefined' || !navigator.share) return

  const file = await getActiveSharepicFile()
  const shareUrl = getShareUrl()
  const title = props.election?.descriptor || 'Klimawahlcheck'
  const text = $t('elections.wahlcheck.results.share.whatsapp_text', { ':election': title })

  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title, text, url: shareUrl, files: [file] })
    } else {
      await navigator.share({ title, text, url: shareUrl })
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error sharing:', err)
    }
  }
}

// Copy link to clipboard
function copyLink() {
  const url = getShareUrl()
  if (!url) return

  navigator.clipboard.writeText(url).then(() => {
    linkCopied.value = true
    showToast($t('elections.wahlcheck.results.share.link_copied'))
    setTimeout(() => {
      linkCopied.value = false
    }, 2500)
  })
}

// Toast notification helper
function showToast(message) {
  if (toastTimeout) clearTimeout(toastTimeout)
  toastMessage.value = message
  toastTimeout = setTimeout(() => {
    toastMessage.value = ''
  }, 5000)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
