<template>
  <div class="community-activity" :class="{ 'has-header': showHeader }">
    <div class="toolbar">
      <div class="window-controls" role="group" aria-label="Time window">
        <button
          v-for="option in windowOptions"
          :key="option"
          class="window-button"
          :class="{ active: days === option }"
          type="button"
          @click="setDays(option)"
        >
          {{ option }}d
        </button>
      </div>

      <button class="icon-button" type="button" :disabled="loading" title="Refresh" @click="fetchSummary">
        <v-icon name="refresh" small />
      </button>
    </div>

    <v-notice v-if="error" type="danger" class="notice">
      {{ error }}
    </v-notice>

    <div v-else-if="loading && !summary" class="loading">
      <v-progress-circular indeterminate />
    </div>

    <template v-else-if="summary">
      <div class="kpis">
        <div v-for="kpi in kpiCards" :key="kpi.label" class="kpi">
          <span class="kpi-label">{{ kpi.label }}</span>
          <strong>{{ kpi.value }}</strong>
          <span class="kpi-detail">{{ kpi.detail }}</span>
        </div>
      </div>

      <div class="main-grid">
        <section class="chart-section">
          <div class="section-head">
            <h3>Aktivität über Zeit</h3>
            <span>{{ summary.meta.bucket === 'week' ? 'Wochen' : 'Tage' }}</span>
          </div>

          <svg class="timeline" viewBox="0 0 640 180" preserveAspectRatio="none" role="img">
            <polyline class="line-fill" :points="activityAreaPoints" />
            <polyline class="line" :points="activityLinePoints" />
            <g v-for="point in timelinePoints" :key="point.x">
              <circle class="dot" :cx="point.x" :cy="point.y" r="3" />
            </g>
          </svg>

          <div class="axis-labels">
            <span>{{ firstTimelineLabel }}</span>
            <span>{{ lastTimelineLabel }}</span>
          </div>
        </section>

        <section class="catalog-section">
          <div class="section-head">
            <h3>Katalog-Adoption</h3>
            <span>{{ currentCatalogLabel }}</span>
          </div>

          <div class="catalog-list">
            <div v-for="catalog in summary.catalogAdoption" :key="catalog.id" class="catalog-row">
              <div class="catalog-title">
                <span>{{ catalog.name }}</span>
                <v-chip v-if="catalog.isCurrentFrontend" x-small>Aktuell</v-chip>
              </div>
              <div class="bar">
                <span :style="{ width: `${Math.min(catalog.averageProgress, 100)}%` }" />
              </div>
              <div class="catalog-meta">
                <span>{{ catalog.averageProgress }}% Ø</span>
                <span>{{ catalog.teamsComplete }} abgeschlossen</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="mail-section">
        <div class="mail-fields">
          <v-input v-model="mailSubject" placeholder="Betreff" />
          <textarea v-model="mailBody" class="mail-body" rows="3" placeholder="Nachricht" />
        </div>

        <div class="mail-actions">
          <button class="action-button" type="button" :disabled="activeEmails.length === 0" @click="copyEmails(activeEmails)">
            <v-icon name="content_copy" small />
            E-Mails kopieren
          </button>
          <a class="action-button" :class="{ disabled: activeEmails.length === 0 }" :href="mailtoFor(activeEmails)">
            <v-icon name="mail" small />
            Follow-up öffnen
          </a>
        </div>
      </section>

      <section class="teams-section">
        <div class="tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tab"
            :class="{ active: activeTab === tab.key }"
            type="button"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span>{{ tab.count }}</span>
          </button>
        </div>

        <div class="team-table">
          <div class="table-row table-head">
            <span>Lokalteam</span>
            <span>Aktivität</span>
            <span>Katalog</span>
            <span>Signal</span>
            <span />
          </div>

          <div v-for="team in activeTeams" :key="team.id" class="table-row">
            <div class="team-name">
              <strong>{{ team.name }}</strong>
              <small>{{ contactLabel(team) }}</small>
            </div>
            <span>{{ team.activityCount }} Änderungen · {{ team.activeUsers }} Personen</span>
            <span>{{ team.currentCatalogProgress }}%</span>
            <span>{{ reasonLabel(team) }}</span>
            <a class="icon-button" :class="{ disabled: team.contactEmails.length === 0 }" :href="mailtoFor(team.contactEmails)" title="Email team">
              <v-icon name="mail" small />
            </a>
          </div>

          <div v-if="activeTeams.length === 0" class="empty">
            Keine Teams in dieser Ansicht.
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';

interface Summary {
  meta: {
    generatedAt: string;
    days: number;
    bucket: 'day' | 'week';
    currentCatalog: { name: string } | null;
  };
  kpis: Record<string, number>;
  timeline: Array<{ bucket: string; activityCount: number; activeUsers: number; activeTeams: number }>;
  catalogAdoption: Array<{
    id: string;
    name: string;
    isCurrentFrontend: boolean;
    averageProgress: number;
    teamsComplete: number;
  }>;
  teams: Record<string, TeamSummary[]>;
}

interface TeamSummary {
  id: string;
  name: string;
  contactEmails: string[];
  activityCount: number;
  activeUsers: number;
  currentCatalogProgress: number;
  attentionReasons: Array<{ type: string; label: string }>;
}

type TabKey = 'attention' | 'stalling' | 'catalogLag' | 'spurious' | 'mostActive';

const DEFAULT_BODY = 'Hallo,\n\nwir schauen gerade auf die aktuelle Aktivität im Lokalteam und wollten kurz nachfragen, ob ihr Unterstützung braucht.\n\nViele Grüße';

export default defineComponent({
  props: {
    showHeader: {
      type: Boolean,
      default: false,
    },
    defaultDays: {
      type: Number,
      default: 30,
    },
  },
  setup(props) {
    const api = useApi();
    const summary = ref<Summary | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const days = ref(Number(props.defaultDays) || 30);
    const activeTab = ref<TabKey>('attention');
    const mailSubject = ref('Follow-up Lokalteam Aktivität');
    const mailBody = ref(DEFAULT_BODY);
    const windowOptions = [30, 90, 180, 365];

    async function fetchSummary() {
      loading.value = true;
      error.value = null;

      try {
        const response = await api.get('/community-activity/summary', {
          params: { days: days.value },
        });
        summary.value = response.data;
      } catch (err: any) {
        error.value = err?.response?.data?.error ?? err?.message ?? 'Dashboard konnte nicht geladen werden.';
      } finally {
        loading.value = false;
      }
    }

    function setDays(value: number) {
      days.value = value;
      fetchSummary();
    }

    const kpiCards = computed(() => {
      const kpis = summary.value?.kpis;
      if (!kpis) return [];

      return [
        { label: 'Aktive Teams', value: kpis.activeTeams, detail: `von ${kpis.totalTeams}` },
        { label: 'Aktive Personen', value: kpis.activeUsers, detail: `${days.value} Tage` },
        { label: 'Bewertungsaktivität', value: kpis.ratingActivity, detail: 'Änderungen' },
        { label: 'Aufmerksamkeit', value: kpis.attentionTeams, detail: `${kpis.stallingTeams} stallen` },
        { label: 'Katalog fertig', value: kpis.completedCurrentCatalog, detail: `${kpis.averageCurrentProgress}% Ø` },
      ];
    });

    const timelinePoints = computed(() => {
      const rows = summary.value?.timeline ?? [];
      const max = Math.max(...rows.map((row) => row.activityCount), 1);
      const width = 640;
      const height = 150;
      const top = 15;
      const step = rows.length > 1 ? width / (rows.length - 1) : width;

      return rows.map((row, index) => ({
        x: Math.round(index * step),
        y: Math.round(top + height - (row.activityCount / max) * height),
      }));
    });

    const activityLinePoints = computed(() => timelinePoints.value.map((point) => `${point.x},${point.y}`).join(' '));
    const activityAreaPoints = computed(() => {
      const points = timelinePoints.value;
      if (points.length === 0) return '';
      return `0,180 ${points.map((point) => `${point.x},${point.y}`).join(' ')} 640,180`;
    });
    const firstTimelineLabel = computed(() => summary.value?.timeline[0]?.bucket ?? '');
    const lastTimelineLabel = computed(() => summary.value?.timeline.at(-1)?.bucket ?? '');
    const currentCatalogLabel = computed(() => summary.value?.meta.currentCatalog?.name ?? 'Kein aktueller Katalog');

    const tabs = computed(() => {
      const teams = summary.value?.teams ?? {};
      return [
        { key: 'attention' as TabKey, label: 'Aufmerksamkeit', count: teams.attention?.length ?? 0 },
        { key: 'stalling' as TabKey, label: 'Stalling', count: teams.stalling?.length ?? 0 },
        { key: 'catalogLag' as TabKey, label: 'Katalog', count: teams.catalogLag?.length ?? 0 },
        { key: 'spurious' as TabKey, label: 'Spurious', count: teams.spurious?.length ?? 0 },
        { key: 'mostActive' as TabKey, label: 'Aktiv', count: teams.mostActive?.length ?? 0 },
      ];
    });

    const activeTeams = computed(() => summary.value?.teams[activeTab.value] ?? []);
    const activeEmails = computed(() => [...new Set(activeTeams.value.flatMap((team) => team.contactEmails))]);

    function mailtoFor(emails: string[]) {
      if (emails.length === 0) return undefined;
      const params = new URLSearchParams({
        subject: mailSubject.value,
        body: mailBody.value,
      });
      return `mailto:?bcc=${encodeURIComponent(emails.join(','))}&${params.toString()}`;
    }

    async function copyEmails(emails: string[]) {
      if (emails.length === 0) return;
      await navigator.clipboard?.writeText(emails.join(', '));
    }

    function contactLabel(team: TeamSummary) {
      return team.contactEmails.length > 0 ? `${team.contactEmails.length} Kontakt(e)` : 'Keine E-Mail hinterlegt';
    }

    function reasonLabel(team: TeamSummary) {
      return team.attentionReasons.map((reason) => reason.label).join(', ') || 'Aktivität';
    }

    onMounted(fetchSummary);

    return {
      activeEmails,
      activeTab,
      activeTeams,
      activityAreaPoints,
      activityLinePoints,
      contactLabel,
      copyEmails,
      currentCatalogLabel,
      days,
      error,
      fetchSummary,
      firstTimelineLabel,
      kpiCards,
      lastTimelineLabel,
      loading,
      mailBody,
      mailSubject,
      mailtoFor,
      reasonLabel,
      setDays,
      summary,
      tabs,
      timelinePoints,
      windowOptions,
    };
  },
});
</script>

<style scoped>
.community-activity {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  padding: 16px;
  color: var(--theme--foreground, var(--foreground-normal));
  background: var(--theme--background, var(--background-page));
}

.community-activity.has-header {
  padding-top: 0;
}

.toolbar,
.section-head,
.mail-actions,
.tabs,
.catalog-title,
.catalog-meta,
.axis-labels {
  display: flex;
  align-items: center;
}

.toolbar {
  justify-content: space-between;
  gap: 12px;
}

.window-controls,
.tabs,
.mail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

button,
a {
  font: inherit;
}

.window-button,
.tab,
.action-button,
.icon-button {
  border: 1px solid var(--theme--border-color, var(--border-normal));
  color: var(--theme--foreground, var(--foreground-normal));
  background: var(--theme--background-subdued, var(--background-input));
  border-radius: var(--theme--border-radius, 6px);
}

.window-button,
.tab,
.action-button {
  min-height: 34px;
  padding: 0 10px;
}

.window-button.active,
.tab.active {
  border-color: var(--theme--primary, var(--primary));
  color: var(--theme--primary, var(--primary));
  background: var(--theme--primary-background, var(--primary-alt));
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  text-decoration: none;
}

.icon-button:disabled,
.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.notice {
  margin: 0;
}

.loading {
  display: grid;
  min-height: 220px;
  place-items: center;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(130px, 1fr));
  gap: 10px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
  background: var(--theme--background-subdued, var(--background-input));
}

.kpi-label,
.kpi-detail,
.section-head span,
.catalog-meta,
.team-name small,
.axis-labels {
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  font-size: 12px;
}

.kpi strong {
  font-size: 26px;
  line-height: 1.05;
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
  gap: 16px;
}

.chart-section,
.catalog-section,
.mail-section,
.teams-section {
  min-width: 0;
}

.section-head {
  justify-content: space-between;
  margin-bottom: 8px;
}

h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.timeline {
  width: 100%;
  height: 180px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
  background: var(--theme--background-subdued, var(--background-input));
}

.line-fill {
  fill: var(--theme--primary-background, var(--primary-alt));
  stroke: none;
}

.line {
  fill: none;
  stroke: var(--theme--primary, var(--primary));
  stroke-width: 3;
}

.dot {
  fill: var(--theme--primary, var(--primary));
}

.axis-labels {
  justify-content: space-between;
  margin-top: 6px;
}

.catalog-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.catalog-title,
.catalog-meta {
  justify-content: space-between;
  gap: 8px;
}

.bar {
  height: 8px;
  margin: 7px 0;
  overflow: hidden;
  border-radius: 999px;
  background: var(--theme--border-color, var(--border-normal));
}

.bar span {
  display: block;
  height: 100%;
  background: var(--theme--primary, var(--primary));
}

.mail-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.mail-fields {
  display: grid;
  gap: 8px;
}

.mail-body {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
  padding: 8px 10px;
  color: var(--theme--foreground, var(--foreground-normal));
  background: var(--theme--background-subdued, var(--background-input));
  font-family: var(--theme--fonts--sans--font-family, var(--family-sans-serif));
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab span {
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
}

.team-table {
  overflow: hidden;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
}

.table-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.25fr) minmax(150px, 0.8fr) 90px minmax(180px, 1fr) 42px;
  gap: 12px;
  align-items: center;
  min-height: 50px;
  padding: 8px 12px;
  border-top: 1px solid var(--theme--border-color, var(--border-normal));
}

.table-row:first-child {
  border-top: 0;
}

.table-head {
  min-height: 38px;
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  background: var(--theme--background-subdued, var(--background-input));
  font-size: 12px;
  font-weight: 600;
}

.team-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.team-name strong,
.team-name small,
.table-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  padding: 16px;
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  text-align: center;
}

@media (max-width: 1100px) {
  .kpis,
  .main-grid,
  .mail-section {
    grid-template-columns: 1fr;
  }

  .table-row {
    grid-template-columns: minmax(180px, 1fr) 110px 70px 34px;
  }

  .table-row > :nth-child(4) {
    display: none;
  }
}
</style>
