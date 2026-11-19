<template>
  <div class="organisation-page w-full py-8 pb-16">
    <header class="mb-10">
      <h1 class="mb-4 font-heading text-4xl font-black text-gray sm:text-6xl">
        {{ $t("organisation.title") }}
      </h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">
        {{ $t("organisation.teams.description") }}
      </p>
    </header>

    <h2 class="mb-3 font-heading text-3xl font-bold text-gray">
      {{ $t("organisation.teams.title") }}
    </h2>
    <p class="mb-8 text-sm text-gray italic">{{ $t("organisation.teams.bubble_hint") }}</p>

    <div class="flex flex-col items-start gap-8 lg:flex-row">
      <!-- ── Bubble chart ─────────────────────────────────────────────────────── -->
      <!-- Widths use scoped CSS (not Tailwind arbitrary values) so they survive prod builds -->
      <div ref="svgWrapperRef" class="org-svg-wrapper shrink-0">
        <svg
          viewBox="140 5 620 555"
          class="w-full select-none"
          xmlns="http://www.w3.org/2000/svg"
          :aria-label="$t('organisation.diagram.aria_label')"
          role="img"
          @click.self="activeTeamId = null"
        >
          <!-- Base rect so mix-blend-mode renders correctly. CSS class controls fill per theme. -->
          <rect x="140" y="5" width="620" height="555" class="org-bg-rect" />

          <!-- Separator line -->
          <line x1="166.8" y1="365.9" x2="733.2" y2="365.9" class="org-separator" stroke-width="0.9" />

          <!-- Blended circles (isolation group so blend mode is self-contained) -->
          <g style="isolation: isolate">
            <circle
              v-for="team in TEAMS"
              :key="'fill-' + team.id"
              :cx="team.cx"
              :cy="team.cy"
              :r="team.r"
              :fill="team.color"
              class="org-team-circle"
              style="cursor: pointer"
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
            :stroke="activeTeamId === team.id ? 'var(--slk-text-strong)' : 'none'"
            stroke-width="2.5"
            stroke-dasharray="6 4"
            style="pointer-events: none; transition: stroke 0.15s"
          />

          <!-- Labels -->
          <text
            v-for="team in TEAMS"
            :key="'label-' + team.id"
            :x="team.cx"
            :y="team.cy - ((team.lines.length - 1) * team.lineHeight) / 2"
            text-anchor="middle"
            dominant-baseline="middle"
            :font-size="team.fontSize"
            font-weight="700"
            font-family="RobotoCondensed, Inter, sans-serif"
            class="org-label-text"
            style="pointer-events: none"
          >
            <tspan v-for="(line, i) in team.lines" :key="i" :x="team.cx" :dy="i === 0 ? 0 : team.lineHeight">
              {{ line }}
            </tspan>
          </text>

          <!-- Transparent hit area so labels don't block clicks -->
          <circle
            v-for="team in TEAMS"
            :key="'click-' + team.id"
            :cx="team.cx"
            :cy="team.cy"
            :r="team.r"
            fill="none"
            stroke="none"
            style="cursor: pointer; pointer-events: all"
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
          <div id="team-detail-panel" class="mb-6 overflow-hidden rounded-lg border border-(--slk-border) shadow-md">
            <!-- Header -->
            <div
              class="px-5 py-5"
              :style="{ background: teamTint(activeTeam.color, 0.13), borderBottom: '2px solid ' + activeTeam.color }"
            >
              <h2 class="font-heading text-3xl leading-tight font-bold text-(--slk-text-strong)">
                {{ activeTeam.label }}
              </h2>
              <ul v-if="activeContacts.length" class="mt-4 flex flex-col gap-2">
                <li v-for="contact in activeContacts" :key="organisationContactHref(contact)">
                  <a
                    :href="organisationContactHref(contact)"
                    class="inline-flex max-w-full items-center gap-2 rounded-sm text-sm font-semibold text-(--slk-text-strong) underline decoration-(--slk-border) underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4"
                  >
                    <svg
                      class="h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      aria-hidden="true"
                    >
                      <template v-if="contact.type === 'email'">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 6 9 7 9-7" />
                      </template>
                      <path
                        v-else
                        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.35 1.91.69 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.69A2 2 0 0 1 22 16.92z"
                      />
                    </svg>
                    <span class="min-w-0 break-words">{{
                      contact.label ? `${contact.label}: ${contact.value}` : contact.value
                    }}</span>
                  </a>
                </li>
              </ul>
            </div>

            <!-- Task list -->
            <div v-if="activeTeam.tasks.length" class="bg-(--slk-surface) px-5 py-5">
              <ul class="list-outside list-disc space-y-2 pl-5 text-base leading-relaxed text-(--slk-text)">
                <li v-for="task in activeTeam.tasks" :key="task">{{ task }}</li>
              </ul>
            </div>

            <div
              v-if="leadership.length"
              class="org-leadership-row flex flex-wrap items-start gap-3 border-t border-(--slk-border) px-5 py-5"
            >
              <OrganisationMemberAvatar
                v-for="leader in leadership"
                :key="leader.role"
                :member="leader.member"
                :color="activeTeam.color"
                :role="$t(leader.role)"
                @select="scrollToMember($event, activeTeam.color)"
              />
            </div>

            <div class="border-t border-(--slk-border) px-5 py-5">
              <h3 class="mb-3 font-heading text-lg font-bold text-(--slk-text-strong)">
                {{ $t("organisation.members") }}
              </h3>
              <div v-if="regularMembers.length" class="flex flex-wrap items-start gap-2">
                <OrganisationMemberAvatar
                  v-for="member in regularMembers"
                  :key="member.id"
                  :member="member"
                  :color="activeTeam.color"
                  @select="scrollToMember($event, activeTeam.color)"
                />
              </div>
              <p v-else class="text-sm text-(--slk-text-subtle) italic">{{ $t("organisation.no_members") }}</p>
            </div>
          </div>
        </template>

        <!-- No-selection placeholder — min-height matches SVG height to keep page height stable -->
        <div
          v-else
          class="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-(--slk-border) text-center text-(--slk-text-muted)"
          :style="placeholderStyle"
        >
          <svg class="h-10 w-10 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p class="text-sm font-medium">{{ $t("organisation.select_group") }}</p>
        </div>
      </div>
    </div>

    <!-- ── All members list (below chart) ─────────────────────────────────── -->
    <div v-if="allMembers.length" class="mt-12">
      <h2 class="mb-6 font-heading text-3xl font-bold text-gray">
        {{ $t("organisation.all_members") }}
      </h2>

      <!-- Active-team members first (coloured border highlight) -->
      <template v-if="activeTeam && filteredMembers.length">
        <div class="mb-6 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          <div
            v-for="member in filteredMembers"
            :id="'member-' + member.id"
            :key="'all-active-' + member.id"
            class="flex flex-col overflow-hidden rounded-xl border-2 bg-(--slk-surface) shadow-xs"
            :style="{ borderColor: activeTeam.color }"
            style="transition: box-shadow 0.1s"
          >
            <div class="relative aspect-square shrink-0 overflow-hidden bg-(--slk-surface-subdued)">
              <template v-if="member.avatar">
                <!-- Blurred fill layer keeps the container looking full at any aspect ratio -->
                <SmartImg
                  :asset-id="member.avatar"
                  :is-raster="true"
                  :width="320"
                  :height="320"
                  img-class="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-60"
                />
                <!-- Main image: contain so the face is never cropped -->
                <SmartImg
                  :asset-id="member.avatar"
                  :is-raster="true"
                  :width="320"
                  :height="320"
                  img-class="absolute inset-0 w-full h-full object-contain"
                />
              </template>
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center"
                :style="{ background: memberPlaceholderGradient(activeTeam.color) }"
              >
                <span class="text-3xl font-bold" :style="{ color: activeTeam.color }">{{
                  initials(member.first_name, member.last_name)
                }}</span>
              </div>
            </div>
            <div class="flex flex-1 flex-col gap-2 p-4">
              <p class="font-heading text-xl leading-snug font-bold text-(--slk-text-strong) sm:text-2xl">
                {{ member.first_name }} {{ member.last_name }}
              </p>
              <div
                v-if="member.bio"
                class="prose prose-sm max-w-none text-sm text-(--slk-text-muted)"
                v-html="sanitizeHtml(member.bio)"
              />
            </div>
          </div>
        </div>
        <hr class="mb-6 border-(--slk-border)" />
      </template>

      <!-- All other members (alphabetically by last name) -->
      <div class="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="member in otherMembers"
          :id="'member-' + member.id"
          :key="'all-other-' + member.id"
          class="flex flex-col overflow-hidden rounded-xl border border-(--slk-border) bg-(--slk-surface) shadow-xs"
        >
          <div class="relative aspect-square shrink-0 overflow-hidden bg-(--slk-surface-subdued)">
            <template v-if="member.avatar">
              <!-- Blurred fill layer -->
              <SmartImg
                :asset-id="member.avatar"
                :is-raster="true"
                :width="320"
                :height="320"
                img-class="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-60"
              />
              <!-- Main image: contain so the face is never cropped -->
              <SmartImg
                :asset-id="member.avatar"
                :is-raster="true"
                :width="320"
                :height="320"
                img-class="absolute inset-0 w-full h-full object-contain"
              />
            </template>
            <div
              v-else
              class="absolute inset-0 flex items-center justify-center"
              :style="{ background: memberPlaceholderGradient(memberColor(member)) }"
            >
              <span class="text-3xl font-bold" :style="{ color: memberColor(member) }">{{
                initials(member.first_name, member.last_name)
              }}</span>
            </div>
          </div>
          <div class="flex flex-1 flex-col gap-2 p-4">
            <p class="font-heading text-xl leading-snug font-bold text-(--slk-text-strong) sm:text-2xl">
              {{ member.first_name }} {{ member.last_name }}
            </p>
            <div
              v-if="member.bio"
              class="prose prose-sm max-w-none text-sm text-(--slk-text-muted)"
              v-html="sanitizeHtml(member.bio)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ORGANISATION_TEAM_LABELS } from "~/shared/organisationTeams";
import type { TeamMember } from "~/shared/contracts/content";
import { organisationContacts, organisationContactHref } from "~/utils/organisationContacts";
import { sanitizeHtml } from "~/utils/sanitizeHtml";
const fetchContent = useContentFetch();

const { $t } = useNuxtApp();
const { isDark } = useTheme();

usePageSeo({ title: $t("organisation") });
// ── SVG layout — coordinates from the original Illustrator SVG ──────────────
// These are purely geometric/layout values that never need to change via CMS.
// Label, email, color and tasks come from the organisation_teams Directus collection.
const TEAM_LAYOUT = [
  {
    id: "lokalteams",
    cx: 527.2,
    cy: 81.7,
    r: 72,
    fontSize: 20,
    lineHeight: 24,
  },
  {
    id: "technik",
    cx: 351,
    cy: 143.5,
    r: 72,
    fontSize: 20,
    lineHeight: 24,
  },
  {
    id: "steuerkreis",
    cx: 458.8,
    cy: 198.4,
    r: 89.7,
    fontSize: 20,
    lineHeight: 24,
  },
  {
    id: "massnahmen",
    cx: 365,
    cy: 270.4,
    r: 72,
    fontSize: 20,
    lineHeight: 24,
  },
  {
    id: "kommunikation",
    cx: 531.6,
    cy: 276.2,
    r: 72,
    fontSize: 16,
    lineHeight: 19,
  },
  {
    id: "vorstand",
    cx: 458.8,
    cy: 447.3,
    r: 72,
    fontSize: 20,
    lineHeight: 24,
  },
  {
    id: "kassenwart",
    cx: 548,
    cy: 468,
    r: 52,
    fontSize: 17,
    lineHeight: 22,
  },
] as const;

// ── Data fetching ─────────────────────────────────────────────────────────────
const { data: members } = await useAsyncData("org-members", () => fetchContent("/api/org-members"));

const { data: cmsTeams } = await useAsyncData("org-teams", () => fetchContent("/api/public/organisation-teams"));

// Merge SVG layout with CMS data; fall back to sensible defaults when CMS is unavailable
const TEAMS = computed(() =>
  TEAM_LAYOUT.map((layout) => {
    const cms = cmsTeams.value?.find((t) => t.team_key === layout.id);
    const lines = ORGANISATION_TEAM_LABELS[layout.id].map((key) => $t(key));
    return {
      ...layout,
      lines,
      label: cms?.label?.trim() || lines.join(" "),
      email: cms?.email ?? "",
      color: cms?.color ?? "#9d9d9c",
      tasks: Array.isArray(cms?.tasks) ? cms.tasks : [],
      head: cms?.head ?? null,
      deputy: cms?.deputy ?? null,
      contacts: cms?.contacts ?? [],
    };
  }),
);

// ── State ─────────────────────────────────────────────────────────────────────
const activeTeamId = ref<string | null>(null);

function selectTeam(id: string) {
  activeTeamId.value = activeTeamId.value === id ? null : id;
}

// ── Hash-based navigation (from search results) ────────────────────────────
const route = useRoute();

function handleHash(hash: string) {
  if (!hash) return;
  if (hash.startsWith("#team-")) {
    const teamId = hash.slice("#team-".length);
    activeTeamId.value = teamId;
    void nextTick(() => {
      document.getElementById("team-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } else if (hash.startsWith("#member-")) {
    const memberId = hash.slice("#member-".length);
    const member = members.value?.find((m) => m.id === memberId);
    const color = member ? memberColor(member) : "#16bae7";
    scrollToMember(memberId, color);
  }
}

watch(() => route.hash, handleHash);

const activeTeam = computed(() =>
  activeTeamId.value ? (TEAMS.value.find((t) => t.id === activeTeamId.value) ?? null) : null,
);

const leadership = computed(() => {
  const team = activeTeam.value;
  if (!team) return [];
  return [
    ...(team.head ? [{ member: team.head, role: "organisation.head" as const }] : []),
    ...(team.deputy ? [{ member: team.deputy, role: "organisation.deputy" as const }] : []),
  ];
});
const activeContacts = computed(() =>
  activeTeam.value ? organisationContacts(activeTeam.value.email, activeTeam.value.contacts) : [],
);
const byLastName = (a: TeamMember, b: TeamMember) => (a.last_name ?? "").localeCompare(b.last_name ?? "", "de");

// Leaders remain reachable from their avatars even when they are not assigned as ordinary members.
const allMembers = computed(() => {
  const result = new Map((members.value ?? []).map((member) => [member.id, member]));
  for (const team of TEAMS.value) {
    for (const leader of [team.head, team.deputy]) {
      if (leader && !result.has(leader.id)) result.set(leader.id, { ...leader, bio: null, slk_team: [] });
    }
  }
  return [...result.values()];
});
const filteredMembers = computed(() => {
  const leaderIds = new Set(leadership.value.map(({ member }) => member.id));
  return allMembers.value
    .filter((member) => leaderIds.has(member.id) || member.slk_team.some((team) => team === activeTeamId.value))
    .sort(byLastName);
});
const regularMembers = computed(() => {
  const leaderIds = new Set(leadership.value.map(({ member }) => member.id));
  return filteredMembers.value.filter((member) => !leaderIds.has(member.id));
});
const otherMembers = computed(() => {
  const activeIds = new Set(filteredMembers.value.map((member) => member.id));
  return allMembers.value.filter((member) => !activeIds.has(member.id)).sort(byLastName);
});

// ── Layout stability: lock panel height to SVG height ───────────────────────
// When panel content changes height the flex-row height must not change,
// otherwise a page scrollbar can appear/disappear → viewport narrows/widens
// → SVG resizes → visible jitter. We track the SVG wrapper height with a
// ResizeObserver and use it as the panel's max-height (and placeholder's
// min-height) so the row height is always exactly equal to the SVG height.
const svgWrapperRef = ref<HTMLElement | null>(null);
const svgHeight = ref(0);
const isLg = ref(false);

let _resizeObs: ResizeObserver | null = null;
let _mq: MediaQueryList | null = null;
const _onMqChange = (e: MediaQueryListEvent) => {
  isLg.value = e.matches;
};

onMounted(() => {
  _mq = window.matchMedia("(min-width: 1024px)");
  isLg.value = _mq.matches;
  _mq.addEventListener("change", _onMqChange);

  if (svgWrapperRef.value) {
    _resizeObs = new ResizeObserver(([entry]) => {
      svgHeight.value = entry?.contentRect.height ?? 0;
    });
    _resizeObs.observe(svgWrapperRef.value);
  }

  // Handle deep-link from search results
  if (route.hash) handleHash(route.hash);
});

onUnmounted(() => {
  _resizeObs?.disconnect();
  _mq?.removeEventListener("change", _onMqChange);
});

// Only apply height constraints on the lg+ breakpoint (column layout on mobile
// should scroll freely).
const panelStyle = computed(() => (isLg.value && svgHeight.value > 0 ? { maxHeight: `${svgHeight.value}px` } : {}));

const placeholderStyle = computed(() =>
  isLg.value && svgHeight.value > 0 ? { minHeight: `${svgHeight.value}px` } : { minHeight: "220px" },
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

// Picks the colour of the member's first team, falls back to a neutral teal
function memberColor(member: TeamMember) {
  const firstTeamId = Array.isArray(member.slk_team) ? member.slk_team[0] : null;
  return TEAMS.value.find((t) => t.id === firstTeamId)?.color ?? "#16bae7";
}

function normalizeHex(hex: string | null | undefined) {
  return /^#[0-9a-f]{6}$/i.test(hex ?? "") ? (hex ?? "#16bae7") : "#16bae7";
}

function blendHex(hex: string, alpha: number, background?: string) {
  const bg = background ?? (isDark.value ? "#17212b" : "#ffffff");
  const fg = normalizeHex(hex)
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16));
  const bgArr = normalizeHex(bg)
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16));
  return `#${fg
    .map((value, index) =>
      Math.round(value * alpha + (bgArr[index] ?? 0) * (1 - alpha))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function teamTint(color: string, alpha: number) {
  return blendHex(color, alpha);
}

function memberPlaceholderGradient(color: string) {
  return `linear-gradient(135deg, ${blendHex(color, 0.33)} 0%, ${blendHex(color, 0.13)} 50%, ${blendHex(color, 0.27)} 100%)`;
}

function scrollToMember(id: string, color: string) {
  const el = document.getElementById("member-" + id);
  if (!el) return;
  // Set the ring color as a CSS custom property so the keyframe picks it up
  el.style.setProperty("--highlight-color-strong", blendHex(color ?? "#16bae7", 0.7));
  el.style.setProperty("--highlight-color-soft", blendHex(color ?? "#16bae7", 0.35));
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("member-highlight");
  el.getBoundingClientRect();
  el.classList.add("member-highlight");
  el.addEventListener(
    "animationend",
    () => {
      el.classList.remove("member-highlight");
    },
    { once: true },
  );
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
  .org-svg-wrapper {
    width: 80%;
  }
}
@media (min-width: 768px) {
  .org-svg-wrapper {
    width: 65%;
  }
}
@media (min-width: 1024px) {
  .org-svg-wrapper {
    width: 55%;
    margin-left: 0;
    margin-right: 0;
  }
}

.org-detail-panel {
  width: 100%;
}
@media (min-width: 1024px) {
  .org-detail-panel {
    width: 45%;
  }
}

@keyframes memberHighlight {
  0% {
    box-shadow: 0 0 0 0 var(--highlight-color-strong, #16bae7);
  }
  30% {
    box-shadow: 0 0 0 8px var(--highlight-color-soft, #16bae7);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}
.member-highlight {
  animation: memberHighlight 1.2s ease-out;
}

/* SVG chart theming */
.org-bg-rect {
  fill: #fbfbfb;
}

.org-separator {
  stroke: #c8c8c8;
}

/* Light mode: multiply makes circles darken at overlaps on the light bg */
.org-team-circle {
  mix-blend-mode: multiply;
}

.org-label-text {
  fill: #1a1a1a;
}

/* Dark mode: dark surface background, screen blend at reduced opacity so
   overlap brightening is subtle rather than glaring */
html[data-theme="staedteChallengeDark"] .org-bg-rect {
  fill: var(--slk-surface);
}

html[data-theme="staedteChallengeDark"] .org-separator {
  stroke: var(--slk-border);
}

html[data-theme="staedteChallengeDark"] .org-team-circle {
  mix-blend-mode: screen;
  opacity: 0.75;
}

html[data-theme="staedteChallengeDark"] .org-label-text {
  fill: var(--slk-text-strong);
}
</style>
