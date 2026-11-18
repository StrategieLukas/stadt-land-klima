<template>
  <div class="participation-page min-h-screen bg-(--slk-page) px-4 py-6 font-sans text-(--slk-text) sm:px-8">
    <div class="mx-auto max-w-5xl">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-4 font-bold no-underline"
          ><span class="text-3xl tracking-tighter text-light-green">{{ $t("participation.brand") }}</span
          ><span class="border-l border-(--slk-border) pl-4 text-sm font-normal">{{
            $t("participation.title")
          }}</span></NuxtLink
        >
        <span class="text-xs text-(--slk-text-muted)">{{ $t("participation.tagline") }}</span>
      </header>
      <ol class="mx-auto mt-9 grid max-w-xl grid-cols-4 gap-2" :aria-label="$t('participation.progress')">
        <li
          v-for="(label, index) in stepLabels"
          :key="label"
          class="participation-progress text-xs"
          :class="{ 'participation-progress-active': index <= progress }"
          :aria-current="index === progress ? 'step' : undefined"
        >
          <span class="mr-1 hidden sm:inline">{{ index + 1 }}</span><span class="hidden sm:inline">{{ $t(label) }}</span
          ><span class="sm:hidden">{{ $t(stepShortLabels[index] ?? label) }}</span>
        </li>
      </ol>
      <main class="mx-auto mt-8 pb-10">
        <button
          v-if="view !== 'entry' && view !== 'success'"
          class="btn mb-2 btn-ghost btn-sm"
          type="button"
          :disabled="locked"
          @click="back"
        >
          <Icon icon="mdi:arrow-left" class="h-4 w-4" />{{ $t("participation.back") }}
        </button>
        <Transition name="participation-step" mode="out-in" @after-enter="focusHeading">
          <section :key="view" :aria-labelledby="`participation-heading-${view}`">
            <div class="mx-auto mb-8 max-w-2xl text-center">
              <p class="mb-3 text-xs tracking-[.15em] text-(--slk-text-muted) uppercase">
                {{ $t("participation.eyebrow") }}
              </p>
              <h1
                :id="`participation-heading-${view}`"
                ref="heading"
                tabindex="-1"
                class="text-3xl leading-tight font-bold tracking-tight text-(--slk-text-strong) sm:text-5xl"
              >
                {{ $t(headline) }}
              </h1>
              <p class="mt-3 text-sm text-(--slk-text-muted)">{{ $t(subtitle) }}</p>
            </div>
            <div v-if="view === 'entry'" class="grid gap-4 sm:grid-cols-2">
              <button
                v-for="choice in paths"
                :key="choice.id"
                type="button"
                class="participation-path text-left"
                :data-participation-path="choice.id"
                @click="choosePath(choice.id)"
              >
                <div class="participation-art hidden sm:flex" aria-hidden="true">
                  <span><Icon :icon="choice.icons[0]" class="h-6 w-6" /></span
                  ><span><Icon :icon="choice.icons[1]" class="h-7 w-7" /></span
                  ><span><Icon :icon="choice.icons[2]" class="h-6 w-6" /></span>
                </div>
                <strong class="text-2xl font-semibold tracking-tight">{{ $t(choice.title) }}</strong>
                <span class="mt-2 block text-sm text-(--slk-text-muted)">{{ $t(choice.description) }}</span>
                <span
                  class="mt-6 flex items-center justify-between border-t border-(--slk-border) pt-4 text-sm font-semibold"
                  >{{ $t(choice.action) }}<Icon icon="mdi:arrow-right" class="h-5 w-5"
                /></span>
              </button>
              <p class="col-span-full mt-2 text-center text-xs text-(--slk-text-muted)">
                {{ $t("participation.both_later") }}
              </p>
            </div>
            <template v-else-if="view === 'interests'">
              <div v-if="path === 'local'" class="grid gap-3 sm:grid-cols-3">
                <button
                  v-for="tool in toolOptions"
                  :key="tool.id"
                  type="button"
                  class="participation-choice relative text-left"
                  :class="{ 'participation-selected': tools.includes(tool.id) }"
                  :aria-pressed="tools.includes(tool.id)"
                  @click="toggleTool(tool.id)"
                >
                  <Icon
                    :icon="tools.includes(tool.id) ? 'mdi:check-circle' : 'mdi:circle-outline'"
                    class="absolute top-5 right-5 h-5 w-5"
                  /><Icon :icon="tool.icon" class="mb-6 h-9 w-9 text-light-green" /><strong class="block text-lg">{{
                    $t(tool.title)
                  }}</strong
                  ><span class="mt-2 block text-sm text-(--slk-text-muted)">{{ $t(tool.description) }}</span>
                </button>
              </div>
              <div v-else class="mx-auto max-w-3xl">
                <p v-if="loading" role="status" class="text-center">{{ $t("generic.loading") }}</p>
                <template v-else-if="options">
                  <h2 class="mb-3 text-sm font-semibold">{{ $t("participation.areas") }}</h2>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="area in options.areas"
                      :key="area.id"
                      type="button"
                      class="btn h-auto min-h-11"
                      :class="areas.includes(area.id) ? 'btn-primary' : 'btn-outline'"
                      :aria-pressed="areas.includes(area.id)"
                      @click="toggleInterest('areas', area.id)"
                    >
                      <Icon :icon="areas.includes(area.id) ? 'mdi:check' : 'mdi:plus'" class="h-4 w-4" />{{
                        area.label
                      }}
                    </button>
                  </div>
                  <h2 class="mt-7 mb-3 text-sm font-semibold">{{ $t("participation.projects") }}</h2>
                  <div v-if="options.projects.length" class="grid gap-3 sm:grid-cols-2">
                    <button
                      v-for="project in options.projects"
                      :key="project.id"
                      type="button"
                      class="participation-choice relative pr-12 text-left"
                      :class="{ 'participation-selected': projects.includes(project.id) }"
                      :aria-pressed="projects.includes(project.id)"
                      @click="toggleInterest('projects', project.id)"
                    >
                      <Icon
                        :icon="projects.includes(project.id) ? 'mdi:check-circle' : 'mdi:circle-outline'"
                        class="absolute top-5 right-5 h-5 w-5"
                      /><strong class="block text-sm">{{ project.title }}</strong
                      ><span v-if="project.description" class="mt-2 block text-xs text-(--slk-text-muted)">{{
                        project.description
                      }}</span>
                    </button>
                  </div>
                  <p v-else class="text-sm text-(--slk-text-muted)">{{ $t("participation.projects.empty") }}</p>
                  <button
                    type="button"
                    class="btn mt-4 h-auto min-h-11 btn-ghost"
                    :aria-pressed="undecided"
                    @click="chooseUndecided"
                  >
                    <Icon :icon="undecided ? 'mdi:check-circle' : 'mdi:compass-outline'" class="h-5 w-5" />{{
                      $t("participation.undecided")
                    }}
                  </button>
                </template>
                <div v-else class="text-center" role="alert">
                  <p>{{ $t("participation.error.unavailable") }}</p>
                  <button type="button" class="btn mt-3 btn-ghost" @click="refresh()">
                    {{ $t("participation.retry") }}
                  </button>
                </div>
              </div>
              <div class="mt-8 flex flex-wrap items-center justify-between gap-4">
                <p class="text-xs text-(--slk-text-muted)" role="status">
                  {{ $t("participation.selected", { ":count": selectionCount }) }}
                </p>
                <CanonicalButton
                  :disabled="!validInterests"
                  color="bright-green"
                  icon-slug="icon_chevron_right"
                  :label="$t('participation.continue')"
                  @click="advanceInterests"
                />
              </div>
            </template>
            <form v-else-if="view === 'municipality'" class="mx-auto max-w-lg" @submit.prevent="view = 'finish'">
              <label class="block text-sm font-medium" for="participation-municipality">{{
                $t("participation.municipality.label")
              }}</label>
              <input
                id="participation-municipality"
                v-model="municipality"
                class="input mt-2 w-full"
                autocomplete="address-level2"
                required
                maxlength="200"
                :placeholder="$t('participation.municipality.placeholder')"
              />
              <p class="mt-3 text-xs text-(--slk-text-muted)">{{ $t("participation.municipality.hint") }}</p>
              <div class="mt-7 flex justify-end">
                <CanonicalButton
                  type="submit"
                  :disabled="!municipality.trim()"
                  color="bright-green"
                  icon-slug="icon_chevron_right"
                  :label="$t('participation.continue')"
                />
              </div>
            </form>
            <template v-else-if="view === 'finish'">
              <div class="mb-6 border-l-4 border-light-green pl-4 text-sm text-(--slk-text-muted)">
                <strong class="block font-medium text-(--slk-text)"
                  >{{ $t(path === "local" ? "participation.path.local" : "participation.path.build")
                  }}<template v-if="path === 'local'"> · {{ municipality }}</template></strong
                >{{ selectionSummary }}
              </div>
              <ParticipationFinalForm
                v-if="options && intent && options.agreements.length === 2"
                v-model:contact="contact"
                :options="options"
                :intent="intent"
                @complete="completed"
                @lock="locked = $event"
                @refresh-agreements="refresh"
              />
              <div v-else role="alert" class="text-center">
                <p>
                  {{
                    $t(
                      options?.agreements.length === 0
                        ? "participation.error.agreements_unavailable"
                        : "participation.error.unavailable",
                    )
                  }}
                </p>
                <button type="button" class="btn mt-3 btn-ghost" @click="refresh()">
                  {{ $t("participation.retry") }}
                </button>
              </div>
            </template>
            <div v-else-if="result" class="mx-auto max-w-lg text-center">
              <Icon icon="mdi:check-circle-outline" class="mx-auto mb-5 h-16 w-16 text-light-green" />
              <div v-if="result.booking" class="participation-choice mb-5">
                <strong>{{ $t("participation.calendar.title") }}</strong>
                <p class="mt-2">{{ formatBooking(result.booking.start) }}</p>
                <p class="mt-1 text-xs text-(--slk-text-muted)">{{ timeZone }}</p>
              </div>
              <p class="text-sm text-(--slk-text-muted)">
                {{ $t(result.booking ? "participation.success.personal_body" : "participation.success.account_body") }}
              </p>
              <p class="mt-4 text-xs text-(--slk-text-muted)">{{ $t("participation.success.spam") }}</p>
              <div class="mt-7">
                <CanonicalButton
                  :href="loginUrl"
                  color="bright-green"
                  icon-slug="icon_login_arrow"
                  :label="$t('participation.login')"
                />
              </div>
            </div>
          </section>
        </Transition>
      </main>
      <footer
        class="flex flex-wrap justify-between gap-3 border-t border-(--slk-border) pt-5 text-xs text-(--slk-text-muted)"
      >
        <span>{{ $t("participation.footer") }}</span><NuxtLink to="/contact">{{ $t("participation.help") }}</NuxtLink>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from "~/components/ParticipationIcon.vue";
import {
  ParticipationOptionsSchema,
  type ParticipationInput,
  type ParticipationResult,
  type ParticipationContactDraft,
  type PARTICIPATION_TOOLS,
} from "~/shared/participation";
import type { TranslationKey } from "~/shared/translationKeys";
definePageMeta({ layout: false });
const { $t, $locale } = useNuxtApp();
usePageSeo({ title: $t("participation.title") });
useHead({ htmlAttrs: { lang: $locale } });
const requestFetch = useRequestFetch();
type View = "entry" | "interests" | "municipality" | "finish" | "success";
type Tool = (typeof PARTICIPATION_TOOLS)[number];
const view = ref<View>("entry");
const path = ref<"local" | "build">("local");
const tools = ref<Tool[]>([]);
const areas = ref<string[]>([]);
const projects = ref<string[]>([]);
const municipality = ref("");
const undecided = ref(false);
const locked = ref(false);
const contact = ref<ParticipationContactDraft>({
  firstName: "",
  lastName: "",
  email: "",
  mode: "personal",
  timeZone: "Europe/Berlin",
  accepted: {},
});
const result = ref<ParticipationResult | null>(null);
const heading = ref<HTMLElement | null>(null);
const timeZone = ref("Europe/Berlin");
const {
  data: options,
  status,
  refresh,
} = await useAsyncData("participation-options", async () =>
  ParticipationOptionsSchema.parse(await requestFetch("/api/participation/options")),
);
const loading = computed(() => status.value === "pending");
const paths = [
  {
    id: "build",
    title: "participation.path.build",
    description: "participation.path.build_hint",
    action: "participation.path.build_action",
    icons: ["mdi:code-braces", "mdi:graph-outline", "mdi:draw-pen"],
  },
  {
    id: "local",
    title: "participation.path.local",
    description: "participation.path.local_hint",
    action: "participation.path.local_action",
    icons: ["mdi:tree-outline", "mdi:map-marker-outline", "mdi:town-hall"],
  },
] as const;
const toolOptions = [
  {
    id: "ranking",
    title: "participation.tool.ranking",
    description: "participation.tool.ranking_hint",
    icon: "mdi:chart-bar",
  },
  {
    id: "wahlcheck",
    title: "participation.tool.wahlcheck",
    description: "participation.tool.wahlcheck_hint",
    icon: "mdi:checkbox-marked-outline",
  },
  {
    id: "project",
    title: "participation.tool.project",
    description: "participation.tool.project_hint",
    icon: "mdi:sprout-outline",
  },
] as const;
const stepLabels = [
  "participation.step.path",
  "participation.step.interests",
  "participation.step.finish",
  "participation.step.confirmation",
] as const;
const stepShortLabels = [
  "participation.step.path_short",
  "participation.step.interests",
  "participation.step.finish_short",
  "participation.step.confirmation_short",
] as const;
const progress = computed(() =>
  view.value === "entry" ? 0 : ["interests", "municipality"].includes(view.value) ? 1 : view.value === "finish" ? 2 : 3,
);
const selectionCount = computed(() =>
  path.value === "local" ? tools.value.length : areas.value.length + projects.value.length,
);
const validInterests = computed(() => selectionCount.value > 0 || (path.value === "build" && undecided.value));
const headline = computed<TranslationKey>(() =>
  view.value === "entry"
    ? "participation.entry.title"
    : view.value === "interests"
      ? path.value === "local"
        ? "participation.local.title"
        : "participation.build.title"
      : view.value === "municipality"
        ? "participation.municipality.title"
        : view.value === "finish"
          ? "participation.finish.title"
          : result.value?.booking
            ? "participation.success.personal_title"
            : "participation.success.account_title",
);
const subtitle = computed<TranslationKey>(() =>
  view.value === "entry"
    ? "participation.entry.subtitle"
    : view.value === "interests"
      ? "participation.interests.subtitle"
      : view.value === "municipality"
        ? "participation.municipality.subtitle"
        : view.value === "finish"
          ? "participation.finish.subtitle"
          : "participation.success.subtitle",
);
const intent = computed<ParticipationInput["intent"]>(() =>
  path.value === "local"
    ? { path: "local", tools: tools.value, municipality: municipality.value }
    : { path: "build", areas: areas.value, projects: projects.value, undecided: undecided.value },
);
const selectionSummary = computed(() =>
  path.value === "local"
    ? toolOptions
        .filter((tool) => tools.value.includes(tool.id))
        .map((tool) => $t(tool.title))
        .join(", ")
    : undecided.value
      ? $t("participation.undecided")
      : [
          ...(options.value?.areas.filter((area) => areas.value.includes(area.id)).map((area) => area.label) ?? []),
          ...(options.value?.projects
            .filter((project) => projects.value.includes(project.id))
            .map((project) => project.title) ?? []),
        ].join(", "),
);
const loginUrl = `${String(useRuntimeConfig().public.clientDirectusUrl || "/backend").replace(/\/$/, "")}/admin/login`;
function choosePath(value: "local" | "build") {
  path.value = value;
  view.value = "interests";
}
function toggleTool(value: Tool) {
  tools.value = tools.value.includes(value) ? tools.value.filter((tool) => tool !== value) : [...tools.value, value];
}
function toggleInterest(kind: "areas" | "projects", id: string) {
  const selected = kind === "areas" ? areas : projects;
  selected.value = selected.value.includes(id)
    ? selected.value.filter((value) => value !== id)
    : [...selected.value, id];
  undecided.value = false;
}
function chooseUndecided() {
  undecided.value = !undecided.value;
  if (undecided.value) {
    areas.value = [];
    projects.value = [];
  }
}
function advanceInterests() {
  if (validInterests.value) view.value = path.value === "local" ? "municipality" : "finish";
}
function back() {
  if (locked.value) return;
  view.value =
    view.value === "interests"
      ? "entry"
      : view.value === "municipality"
        ? "interests"
        : path.value === "local"
          ? "municipality"
          : "interests";
}
function completed(value: ParticipationResult, zone: string) {
  timeZone.value = zone;
  result.value = value;
  view.value = "success";
}
function formatBooking(value: string) {
  return new Intl.DateTimeFormat($locale, { dateStyle: "full", timeStyle: "short", timeZone: timeZone.value }).format(
    new Date(value),
  );
}
function focusHeading() {
  heading.value?.focus({ preventScroll: true });
}
onMounted(() => {
  timeZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  contact.value.timeZone = timeZone.value;
});
</script>

<style scoped>
.participation-page {
  background: var(--slk-page);
}
.participation-progress {
  border-top: 3px solid var(--slk-border);
  padding-top: 0.6rem;
  color: var(--slk-text-muted);
}
.participation-progress-active {
  border-color: var(--color-light-green, #afca0b);
  color: var(--slk-text-strong);
}
.participation-path,
.participation-choice {
  display: block;
  border: 1px solid var(--slk-border);
  background: var(--slk-surface);
  border-radius: 1.25rem;
  padding: 1.5rem;
}
.participation-path {
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease;
}
.participation-path:hover {
  transform: translateY(-3px);
  border-color: var(--color-light-green, #afca0b);
}
.participation-choice {
  transition:
    border-color 0.16s ease,
    background 0.16s ease;
}
button.participation-choice {
  cursor: pointer;
}
.participation-selected {
  border-color: var(--color-light-green, #afca0b);
  background: color-mix(in srgb, var(--color-light-green, #afca0b) 10%, var(--slk-surface));
}
.participation-art {
  height: 8rem;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.participation-art > span {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1rem;
  background: var(--slk-surface-subdued);
}
.participation-art > span:nth-child(2) {
  transform: translateY(-0.75rem);
  background: var(--color-light-green, #afca0b);
  color: #20291c;
}
.participation-step-enter-active,
.participation-step-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.participation-step-enter-from {
  opacity: 0;
  transform: translateY(0.5rem);
}
.participation-step-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}
@media (prefers-reduced-motion: reduce) {
  .participation-page * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
