<template>
  <div class="max-w-7xl mx-auto px-4 py-8 pb-16">
    <h1 class="text-h1 font-bold text-center mb-4">Unsere Organisation</h1>

    <!-- Intro text -->
    <div class="max-w-2xl mx-auto text-center mb-10">
      <h2 class="text-h2 font-bold mb-2">Ressorts/Aufgabenbereiche</h2>
      <p class="text-base text-gray">
        Wir sind selbstorganisiert und arbeiten in Arbeits- und Projektgruppen. Die Ressorts/Aufgabenbereiche fassen die AGs und PGs thematisch zusammen.
      </p>
      <p class="mt-2 text-sm italic text-gray-400">Klicke auf eine Blase, um mehr über das Ressort zu erfahren.</p>
    </div>

    <div class="flex flex-col lg:flex-row gap-8 items-start">
      <!-- ── Bubble chart ─────────────────────────────────────────────────────── -->
      <!-- Widths use scoped CSS (not Tailwind arbitrary values) so they survive prod builds -->
      <div ref="svgWrapperRef" class="org-svg-wrapper flex-shrink-0">
        <svg
          viewBox="140 5 620 555"
          class="w-full select-none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Organisationsdiagramm"
          role="img"
          @click.self="activeTeamId = null"
        >
          <!-- Base rect so mix-blend-mode: multiply renders correctly -->
          <rect x="140" y="5" width="620" height="555" fill="#fbfbfb" />

          <!-- Separator line -->
          <line x1="166.8" y1="365.9" x2="733.2" y2="365.9" stroke="#c8c8c8" stroke-width="0.9" />

          <!-- Blended circles (isolation group so multiply blends only within group) -->
          <g style="isolation: isolate">
            <circle
              v-for="team in TEAMS"
              :key="'fill-' + team.id"
              :cx="team.cx"
              :cy="team.cy"
              :r="team.r"
              :fill="team.color"
              style="mix-blend-mode: multiply; cursor: pointer"
              @click.stop="selectTeam(team.id)"
            />
          </g>

          <!-- Active ring (outside blend group to stay crisp) -->
          <circle
            v-for="team in TEAMS"
            :key="'ring-' + team.id"
            :cx="team.cx"
            :cy="team.cy"
            :r="team.r + 3"
            fill="none"
            :stroke="activeTeamId === team.id ? '#333' : 'transparent'"
            stroke-width="2.5"
            stroke-dasharray="6 4"
            style="pointer-events: none; transition: stroke 0.15s"
          />

          <!-- Labels -->
          <text
            v-for="team in TEAMS"
            :key="'label-' + team.id"
            :x="team.cx"
            :y="team.cy - (team.lines.length - 1) * team.lineHeight / 2"
            text-anchor="middle"
            dominant-baseline="middle"
            :font-size="team.fontSize"
            font-weight="700"
            font-family="'Roboto Condensed', 'Inter', sans-serif"
            fill="#1a1a1a"
            style="pointer-events: none"
          >
            <tspan
              v-for="(line, i) in team.lines"
              :key="i"
              :x="team.cx"
              :dy="i === 0 ? 0 : team.lineHeight"
            >{{ line }}</tspan>
          </text>

          <!-- Transparent hit area so labels don't block clicks -->
          <circle
            v-for="team in TEAMS"
            :key="'click-' + team.id"
            :cx="team.cx"
            :cy="team.cy"
            :r="team.r"
            fill="transparent"
            stroke="none"
            style="cursor: pointer"
            @click.stop="selectTeam(team.id)"
          />
        </svg>
      </div>

      <!-- ── Detail panel ─────────────────────────────────────────────────────── -->
      <!-- panelStyle pins max-height to the SVG height (tracked by ResizeObserver)  -->
      <!-- so the flex-row height never changes → no scrollbar jitter on the page.   -->
      <div class="org-detail-panel" :class="svgHeight > 0 ? 'lg:overflow-y-auto' : ''" :style="panelStyle">
        <template v-if="activeTeam">
          <!-- Popover card -->
          <div id="team-detail-panel" class="rounded-lg overflow-hidden border border-[#e0e0e0] shadow-md mb-6">
            <!-- Header -->
            <div
              class="px-4 py-3"
              :style="{ background: activeTeam.color + '22', borderBottom: '2px solid ' + activeTeam.color }"
            >
              <h2 class="font-bold text-[15px] text-[#1a1a1a]">{{ activeTeam.label }}</h2>
              <a
                v-if="activeTeam.email"
                :href="'mailto:' + activeTeam.email"
                class="mt-0.5 text-xs text-[#006e94] hover:underline block"
              >{{ activeTeam.email }}</a>
            </div>

            <!-- Task list -->
            <div class="bg-white px-4 py-3">
              <ul class="text-sm leading-relaxed space-y-1 text-[#333] list-disc list-inside">
                <li v-for="task in activeTeam.tasks" :key="task">{{ task }}</li>
              </ul>
            </div>

            <!-- Members footer: small clickable avatars (replaces name strip) -->
            <div class="px-4 py-3 border-t border-[#e0e0e0]">
              <div v-if="filteredMembers.length" class="flex flex-wrap gap-3">
                <button
                  v-for="member in filteredMembers"
                  :key="'strip-' + member.id"
                  type="button"
                  class="flex flex-col items-center gap-1 cursor-pointer group focus:outline-none"
                  @click="scrollToMember(member.id, activeTeam.color)"
                  :title="member.first_name + ' ' + member.last_name"
                >
                  <div
                    class="w-10 h-10 rounded-full overflow-hidden border-2 group-hover:scale-110 transition-transform"
                    :style="{ borderColor: activeTeam.color }"
                  >
                    <SmartImg
                      v-if="member.avatar"
                      :assetId="member.avatar"
                      :isRaster="true"
                      :width="40"
                      :height="40"
                      imgClass="w-full h-full object-cover"
                    />
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center"
                      :style="{ background: `linear-gradient(135deg, ${activeTeam.color}55 0%, ${activeTeam.color}22 50%, ${activeTeam.color}44 100%)` }"
                    >
                      <span class="font-bold text-xs" :style="{ color: activeTeam.color }">{{ initials(member.first_name, member.last_name) }}</span>
                    </div>
                  </div>
                  <span class="text-[10px] leading-tight text-center text-gray-600 max-w-[48px] truncate">{{ member.first_name }}</span>
                </button>
              </div>
              <p v-else class="text-sm italic text-gray-400">Noch keine Mitglieder eingetragen.</p>
            </div>
          </div>
        </template>

        <!-- No-selection placeholder — min-height matches SVG height to keep page height stable -->
        <div
          v-else
          class="flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-[#e5e7eb] text-gray gap-3"
          :style="placeholderStyle"
        >
          <svg class="w-10 h-10 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p class="text-sm font-medium">Wähle eine Gruppe aus dem Diagramm</p>
        </div>
      </div>
    </div>

    <!-- ── All members list (below chart) ─────────────────────────────────── -->
    <div v-if="members && members.length" class="mt-12">
      <h2 class="text-h2 font-bold mb-6">Alle Teammitglieder</h2>

      <!-- Active-team members first (coloured border highlight) -->
      <template v-if="activeTeam && filteredMembers.length">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
          <div
            v-for="member in filteredMembers"
            :key="'all-active-' + member.id"
            :id="'member-' + member.id"
            class="flex flex-col bg-white rounded-xl overflow-hidden shadow-sm border-2"
            :style="{ borderColor: activeTeam.color }"
            style="transition: box-shadow 0.1s;"
          >
            <div class="relative aspect-square bg-gray-100 overflow-hidden flex-shrink-0">
              <template v-if="member.avatar">
                <!-- Blurred fill layer keeps the container looking full at any aspect ratio -->
                <SmartImg
                  :assetId="member.avatar"
                  :isRaster="true"
                  :width="320"
                  :height="320"
                  imgClass="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-60"
                />
                <!-- Main image: contain so the face is never cropped -->
                <SmartImg
                  :assetId="member.avatar"
                  :isRaster="true"
                  :width="320"
                  :height="320"
                  imgClass="absolute inset-0 w-full h-full object-contain"
                />
              </template>
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center"
                :style="{ background: `linear-gradient(135deg, ${activeTeam.color}55 0%, ${activeTeam.color}22 50%, ${activeTeam.color}44 100%)` }"
              >
                <span class="font-bold text-3xl" :style="{ color: activeTeam.color }">{{ initials(member.first_name, member.last_name) }}</span>
              </div>
            </div>
            <div class="p-4 flex flex-col gap-2 flex-1">
              <p class="font-bold text-gray-900 leading-snug">{{ member.first_name }} {{ member.last_name }}</p>
              <div v-if="member.bio" class="text-sm text-gray-500 prose prose-sm max-w-none" v-html="member.bio" />
            </div>
          </div>
        </div>
        <hr class="border-[#e5e7eb] mb-6" />
      </template>

      <!-- All other members (alphabetically by last name) -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div
          v-for="member in otherMembers"
          :key="'all-other-' + member.id"            :id="'member-' + member.id"          class="flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div class="relative aspect-square bg-gray-100 overflow-hidden flex-shrink-0">
            <template v-if="member.avatar">
              <!-- Blurred fill layer -->
              <SmartImg
                :assetId="member.avatar"
                :isRaster="true"
                :width="320"
                :height="320"
                imgClass="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-60"
              />
              <!-- Main image: contain so the face is never cropped -->
              <SmartImg
                :assetId="member.avatar"
                :isRaster="true"
                :width="320"
                :height="320"
                imgClass="absolute inset-0 w-full h-full object-contain"
              />
            </template>
            <div
              v-else
              class="absolute inset-0 flex items-center justify-center"
              :style="{ background: `linear-gradient(135deg, ${memberColor(member)}55 0%, ${memberColor(member)}22 50%, ${memberColor(member)}44 100%)` }"
            >
              <span class="font-bold text-3xl" :style="{ color: memberColor(member) }">{{ initials(member.first_name, member.last_name) }}</span>
            </div>
          </div>
          <div class="p-4 flex flex-col gap-2 flex-1">
            <p class="font-bold text-gray-900 leading-snug">{{ member.first_name }} {{ member.last_name }}</p>
            <div v-if="member.bio" class="text-sm text-gray-500 prose prose-sm max-w-none" v-html="member.bio" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({ title: 'Organisation' })

const { $directus, $readItems } = useNuxtApp()
// ── SVG layout — coordinates from the original Illustrator SVG ──────────────
// These are purely geometric/layout values that never need to change via CMS.
// Label, email, color and tasks come from the organisation_teams Directus collection.
const TEAM_LAYOUT = [
  { id: 'lokalteams',   lines: ['Lokalteams/', 'Netzwerk'],                        cx: 527.2, cy: 81.7,  r: 72,   fontSize: 20, lineHeight: 24 },
  { id: 'technik',      lines: ['Technik & IT'],                                   cx: 351,   cy: 143.5, r: 72,   fontSize: 20, lineHeight: 24 },
  { id: 'steuerkreis',  lines: ['Steuerkreis'],                                    cx: 458.8, cy: 198.4, r: 89.7, fontSize: 20, lineHeight: 24 },
  { id: 'massnahmen',   lines: ['Maßnahmen'],                                      cx: 365,   cy: 270.4, r: 72,   fontSize: 20, lineHeight: 24 },
  { id: 'kommunikation',lines: ['Kommunikation', 'Öffentlichkeits-', 'Pressearbeit'], cx: 531.6, cy: 276.2, r: 72, fontSize: 16, lineHeight: 19 },
  { id: 'vorstand',     lines: ['Vorstand/', 'Verwaltung'],                        cx: 458.8, cy: 447.3, r: 72,   fontSize: 20, lineHeight: 24 },
  { id: 'kassenwart',   lines: ['Kassenwart'],                                     cx: 548,   cy: 468,   r: 52,   fontSize: 17, lineHeight: 22 },
]

// ── Data fetching ─────────────────────────────────────────────────────────────
const { data: members } = await useAsyncData('org-members', () =>
  $fetch('/api/org-members')
)

const { data: cmsTeams } = await useAsyncData('org-teams', () =>
  $directus.request($readItems('organisation_teams', { sort: ['sort'], limit: -1 }))
)

// Merge SVG layout with CMS data; fall back to sensible defaults when CMS is unavailable
const TEAMS = computed(() =>
  TEAM_LAYOUT.map(layout => {
    const cms = cmsTeams.value?.find(t => t.team_key === layout.id)
    return {
      ...layout,
      label: cms?.label ?? layout.id,
      email: cms?.email ?? '',
      color: cms?.color ?? '#9d9d9c',
      tasks: Array.isArray(cms?.tasks) ? cms.tasks : [],
    }
  })
)


// ── State ─────────────────────────────────────────────────────────────────────
const activeTeamId = ref(null)

function selectTeam(id) {
  activeTeamId.value = activeTeamId.value === id ? null : id
}

// ── Hash-based navigation (from search results) ────────────────────────────
const route = useRoute()

function handleHash(hash) {
  if (!hash) return
  if (hash.startsWith('#team-')) {
    const teamId = hash.slice('#team-'.length)
    activeTeamId.value = teamId
    nextTick(() => {
      document.getElementById('team-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  } else if (hash.startsWith('#member-')) {
    const memberId = hash.slice('#member-'.length)
    const member = members.value?.find(m => m.id === memberId)
    const color = member ? memberColor(member) : '#16bae7'
    scrollToMember(memberId, color)
  }
}

watch(() => route.hash, handleHash)

const activeTeam = computed(() =>
  activeTeamId.value ? TEAMS.value.find(t => t.id === activeTeamId.value) ?? null : null
)

const byLastName = (a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? '', 'de')

// Members in the active team
const filteredMembers = computed(() => {
  if (!members.value || !activeTeamId.value) return []
  const seen = new Set()
  return members.value
    .filter(m => {
      if (!Array.isArray(m.slk_team) || !m.slk_team.includes(activeTeamId.value)) return false
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
    .sort(byLastName)
})

// All other members (not in active team), sorted by last name
const otherMembers = computed(() => {
  if (!members.value) return []
  const activeIds = new Set(filteredMembers.value.map(m => m.id))
  return members.value.filter(m => !activeIds.has(m.id)).sort(byLastName)
})

// ── Layout stability: lock panel height to SVG height ───────────────────────
// When panel content changes height the flex-row height must not change,
// otherwise a page scrollbar can appear/disappear → viewport narrows/widens
// → SVG resizes → visible jitter. We track the SVG wrapper height with a
// ResizeObserver and use it as the panel's max-height (and placeholder's
// min-height) so the row height is always exactly equal to the SVG height.
const svgWrapperRef = ref(null)
const svgHeight = ref(0)
const isLg = ref(false)

let _resizeObs = null
let _mq = null
const _onMqChange = (e) => { isLg.value = e.matches }

onMounted(() => {
  _mq = window.matchMedia('(min-width: 1024px)')
  isLg.value = _mq.matches
  _mq.addEventListener('change', _onMqChange)

  if (svgWrapperRef.value) {
    _resizeObs = new ResizeObserver(([entry]) => {
      svgHeight.value = entry.contentRect.height
    })
    _resizeObs.observe(svgWrapperRef.value)
  }

  // Handle deep-link from search results
  if (route.hash) handleHash(route.hash)
})

onUnmounted(() => {
  _resizeObs?.disconnect()
  _mq?.removeEventListener('change', _onMqChange)
})

// Only apply height constraints on the lg+ breakpoint (column layout on mobile
// should scroll freely).
const panelStyle = computed(() =>
  isLg.value && svgHeight.value > 0
    ? { maxHeight: svgHeight.value + 'px' }
    : {}
)

const placeholderStyle = computed(() =>
  isLg.value && svgHeight.value > 0
    ? { minHeight: svgHeight.value + 'px' }
    : { minHeight: '220px' }
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

// Picks the colour of the member's first team, falls back to a neutral teal
function memberColor(member) {
  const firstTeamId = Array.isArray(member.slk_team) ? member.slk_team[0] : null
  return TEAMS.value.find(t => t.id === firstTeamId)?.color ?? '#16bae7'
}

function scrollToMember(id, color) {
  const el = document.getElementById('member-' + id)
  if (!el) return
  // Set the ring color as a CSS custom property so the keyframe picks it up
  el.style.setProperty('--highlight-color', color ?? '#16bae7')
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('member-highlight')
  void el.offsetWidth
  el.classList.add('member-highlight')
  el.addEventListener('animationend', () => el.classList.remove('member-highlight'), { once: true })
}
</script>

<style>
/* Responsive widths for the org chart flex layout.
   Written as plain CSS (not Tailwind arbitrary values) so they are always
   included in the production build regardless of Tailwind JIT scanning. */
.org-svg-wrapper {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}
@media (min-width: 640px) {
  .org-svg-wrapper { width: 80%; }
}
@media (min-width: 768px) {
  .org-svg-wrapper { width: 65%; }
}
@media (min-width: 1024px) {
  .org-svg-wrapper { width: 55%; margin-left: 0; margin-right: 0; }
}

.org-detail-panel {
  width: 100%;
}
@media (min-width: 1024px) {
  .org-detail-panel { width: 45%; }
}

@keyframes memberHighlight {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--highlight-color, #16bae7) 70%, transparent); }
  30%  { box-shadow: 0 0 0 8px color-mix(in srgb, var(--highlight-color, #16bae7) 35%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--highlight-color, #16bae7) 0%, transparent); }
}
.member-highlight {
  animation: memberHighlight 1.2s ease-out;
}
</style>
