<template>
  <div class="community-activity" :class="{ 'has-header': showHeader }">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">Lokalteam-Betreuung</p>
        <h2>Lokalteams im Blick behalten</h2>
        <p class="header-copy">
          {{ currentCatalogLabel }} · {{ days }} Tage · zuletzt aktualisiert {{ generatedAtLabel }}
        </p>
      </div>

      <div class="toolbar">
        <div class="window-controls" role="group" aria-label="Zeitraum wählen">
          <button
            v-for="option in windowOptions"
            :key="option"
            class="window-button"
            :class="{ active: days === option }"
            type="button"
            @click="setDays(option)"
          >
            {{ option }} Tage
          </button>
        </div>

        <button class="icon-button refresh-button" type="button" :disabled="loading" title="Aktualisieren" @click="fetchSummary">
          <v-icon name="refresh" />
        </button>
      </div>
    </header>

    <v-notice v-if="error" type="danger" class="notice">
      {{ error }}
    </v-notice>

    <div v-else-if="loading && !summary" class="loading">
      <v-progress-circular indeterminate />
    </div>

    <template v-else-if="summary">
      <section class="kpis" aria-label="Kennzahlen">
        <article v-for="kpi in kpiCards" :key="kpi.label" class="kpi">
          <span class="kpi-label">{{ kpi.label }}</span>
          <strong>{{ kpi.value }}</strong>
          <span class="kpi-detail">{{ kpi.detail }}</span>
        </article>
      </section>

      <section class="activity-strip">
        <div class="section-head">
          <div>
            <h3>Gerade aktiv</h3>
            <p>Teams mit frischen Änderungen im ausgewählten Zeitraum.</p>
          </div>
          <button class="text-button" type="button" @click="activeTab = 'recent'">
            Aktivitätsansicht öffnen
          </button>
        </div>

        <div class="signal-grid">
          <button
            v-for="team in recentTeams"
            :key="team.id"
            class="signal-card"
            type="button"
            @click="selectTeam(team.id)"
          >
            <span class="signal-dot" :class="activityToneClass(team)" />
            <strong>{{ team.name }}</strong>
            <small>{{ team.activityCount }} Änderungen · {{ relativeDate(team.lastActivity) }}</small>
          </button>

          <div v-if="recentTeams.length === 0" class="empty-card">
            Keine Aktivität im ausgewählten Zeitraum.
          </div>
        </div>
      </section>

      <div class="main-grid">
        <section class="chart-section panel-card">
          <div class="section-head">
            <div>
              <h3>Aktivität über Zeit</h3>
              <p>{{ summary.meta.bucket === 'week' ? 'Wochenansicht' : 'Tagesansicht' }}</p>
            </div>
            <span class="section-badge">{{ firstTimelineLabel }} bis {{ lastTimelineLabel }}</span>
          </div>

          <svg class="timeline" viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label="Aktivität über Zeit">
            <polyline class="line-fill" :points="activityAreaPoints" />
            <polyline class="line" :points="activityLinePoints" />
            <g v-for="point in timelinePoints" :key="point.x">
              <circle class="dot" :cx="point.x" :cy="point.y" r="4" />
            </g>
          </svg>
        </section>

        <section class="catalog-section panel-card">
          <div class="section-head">
            <div>
              <h3>Katalog-Fortschritt</h3>
              <p>Übernahme je Maßnahmenkatalog.</p>
            </div>
          </div>

          <div class="catalog-list">
            <div v-for="catalog in summary.catalogAdoption" :key="catalog.id" class="catalog-row">
              <div class="catalog-title">
                <span>{{ catalog.name }}</span>
                <v-chip v-if="catalog.isCurrentFrontend" small>Aktuell</v-chip>
              </div>
              <div class="progress-track">
                <span :style="{ width: `${Math.min(catalog.averageProgress, 100)}%` }" />
              </div>
              <div class="catalog-meta">
                <span>{{ catalog.averageProgress }} % Durchschnitt</span>
                <span>{{ catalog.teamsComplete }} abgeschlossen</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="mail-section panel-card">
        <div>
          <h3>Nachricht vorbereiten</h3>
          <p>Betreff und Text werden für Sammelmails oder einzelne Teams verwendet.</p>
        </div>

        <div class="mail-fields">
          <v-input v-model="mailSubject" placeholder="Betreff" />
          <textarea v-model="mailBody" class="mail-body" rows="4" placeholder="Nachricht" />
        </div>

        <div class="mail-actions">
          <button class="action-button" type="button" :disabled="activeEmails.length === 0" @click="copyEmails(activeEmails)">
            <v-icon name="content_copy" />
            E-Mails der Ansicht kopieren
          </button>
          <a class="action-button" :class="{ disabled: activeEmails.length === 0 }" :href="mailtoFor(activeEmails)">
            <v-icon name="mail" />
            Sammelmail öffnen
          </a>
        </div>
      </section>

      <section class="workbench">
        <div class="team-list panel-card">
          <div class="section-head stacked-head">
            <div>
              <h3>Lokalteams</h3>
              <p>Standardmäßig nach niedrigstem Fortschritt sortiert.</p>
            </div>
            <v-input v-model="searchTerm" class="search-input" placeholder="Team suchen" />
          </div>

          <div class="tabs" role="tablist" aria-label="Teamansicht">
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
              <span>Fortschritt</span>
              <span>Aktivität</span>
              <span>Mitglieder</span>
            </div>

            <button
              v-for="team in filteredTeams"
              :key="team.id"
              class="table-row team-row"
              :class="{ selected: selectedTeam?.id === team.id }"
              type="button"
              @click="selectTeam(team.id)"
            >
              <span class="team-name">
                <strong>{{ team.name }}</strong>
                <small>{{ statusLabel(team.status) }} · {{ locationLabel(team) }}</small>
              </span>

              <span class="progress-cell">
                <span class="progress-label">{{ team.currentCatalogProgress }} %</span>
                <span class="progress-track compact">
                  <span :class="progressClass(team.currentCatalogProgress)" :style="{ width: `${Math.min(team.currentCatalogProgress, 100)}%` }" />
                </span>
              </span>

              <span class="activity-cell">
                <span class="signal-dot" :class="activityToneClass(team)" />
                <span>{{ team.activitySignal.label }}</span>
              </span>

              <span class="members-cell">{{ team.memberCount }} Personen</span>
            </button>

            <div v-if="filteredTeams.length === 0" class="empty">
              Keine Teams für diese Auswahl gefunden.
            </div>
          </div>
        </div>

        <aside class="detail-panel panel-card">
          <template v-if="selectedTeam">
            <div class="detail-head">
              <div>
                <p class="eyebrow">Teamprofil</p>
                <h3>{{ selectedTeam.name }}</h3>
                <p>{{ statusLabel(selectedTeam.status) }} · {{ locationLabel(selectedTeam) }}</p>
              </div>

              <div class="detail-actions">
                <a class="icon-button" :href="`/admin/content/localteams/${selectedTeam.id}`" title="Datensatz öffnen">
                  <v-icon name="open_in_new" />
                </a>
                <a class="icon-button" :class="{ disabled: selectedTeam.contactEmails.length === 0 }" :href="mailtoFor(selectedTeam.contactEmails)" title="Team anschreiben">
                  <v-icon name="mail" />
                </a>
              </div>
            </div>

            <div class="detail-stats">
              <div>
                <span>Fortschritt</span>
                <strong>{{ selectedTeam.currentCatalogProgress }} %</strong>
              </div>
              <div>
                <span>Änderungen</span>
                <strong>{{ selectedTeam.activityCount }}</strong>
              </div>
              <div>
                <span>Mitglieder</span>
                <strong>{{ selectedTeam.memberCount }}</strong>
              </div>
              <div>
                <span>Letzte Aktivität</span>
                <strong>{{ relativeDate(selectedTeam.lastActivity) }}</strong>
              </div>
            </div>

            <div class="reason-list">
              <v-chip v-for="reason in selectedTeam.attentionReasons" :key="reason.type" small>
                {{ reason.label }}
              </v-chip>
              <v-chip v-if="selectedTeam.attentionReasons.length === 0" small>
                Kein akuter Handlungsbedarf
              </v-chip>
            </div>

            <section class="detail-block">
              <h4>Empfohlene nächste Schritte</h4>
              <ul class="recommendations">
                <li v-for="recommendation in recommendationsFor(selectedTeam)" :key="recommendation">
                  {{ recommendation }}
                </li>
              </ul>
            </section>

            <section class="detail-block">
              <h4>Mitglieder</h4>
              <div class="member-list">
                <div v-for="member in selectedTeam.members" :key="member.id || member.email" class="member-row">
                  <div>
                    <strong>{{ member.name }}</strong>
                    <small>{{ member.email || 'Keine E-Mail hinterlegt' }}</small>
                  </div>
                <v-chip v-if="member.isAdmin" small>Teamleitung</v-chip>
                </div>
                <div v-if="selectedTeam.members.length === 0" class="empty-inline">
                  Keine Mitglieder hinterlegt.
                </div>
              </div>
            </section>

            <section class="detail-block">
              <h4>Letzte Änderungen</h4>
              <ol class="activity-list">
                <li v-for="activity in selectedTeam.recentActivity" :key="`${activity.timestamp}-${activity.measureName}`">
                  <span>{{ relativeDate(activity.timestamp) }}</span>
                  <strong>{{ actionLabel(activity.action) }}</strong>
                  <small>{{ activity.measureName || 'Maßnahme ohne Namen' }} · {{ activity.userName }}</small>
                </li>
              </ol>
              <div v-if="selectedTeam.recentActivity.length === 0" class="empty-inline">
                Keine Änderungen im ausgewählten Zeitraum.
              </div>
            </section>
          </template>

          <div v-else class="empty-detail">
            Wähle ein Lokalteam aus, um Details zu sehen.
          </div>
        </aside>
      </section>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
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
  teams: Record<TabKey, TeamSummary[]>;
}

interface TeamMember {
  id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  isAdmin: boolean;
}

interface TeamActivity {
  timestamp: string | null;
  action: string | null;
  userName: string;
  userEmail: string | null;
  measureName: string | null;
}

interface TeamSummary {
  id: string;
  name: string;
  localteamName: string | null;
  slug: string | null;
  status: string | null;
  state: string | null;
  population: number | null;
  contactEmails: string[];
  memberCount: number;
  members: TeamMember[];
  activityCount: number;
  activeUsers: number;
  touchedMeasures: number;
  createdCount: number;
  updatedCount: number;
  lastActivity: string | null;
  daysSinceActivity: number | null;
  currentCatalogProgress: number;
  previousCatalogProgress: number;
  scoreTotal: number;
  topUserEmail: string | null;
  topUserShare: number;
  activitySignal: { key: string; label: string; tone: string };
  recentActivity: TeamActivity[];
  attentionReasons: Array<{ type: string; label: string }>;
}

type TabKey = 'all' | 'attention' | 'stalling' | 'catalogLag' | 'spurious' | 'mostActive' | 'recent';

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
    const activeTab = ref<TabKey>('all');
    const selectedTeamId = ref<string | null>(null);
    const searchTerm = ref('');
    const mailSubject = ref('Nachfrage zur Lokalteam-Aktivität');
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

    const allTeams = computed(() => summary.value?.teams.all ?? []);
    const recentTeams = computed(() => summary.value?.teams.recent ?? []);

    const kpiCards = computed(() => {
      const kpis = summary.value?.kpis;
      if (!kpis) return [];

      return [
        { label: 'Lokalteams', value: kpis.totalTeams, detail: `${kpis.activeTeams} aktiv im Zeitraum` },
        { label: 'Aktive Personen', value: kpis.activeUsers, detail: `${days.value} Tage` },
        { label: 'Bewertungsänderungen', value: kpis.ratingActivity, detail: `${kpis.averageCurrentProgress} % Fortschritt Ø` },
        { label: 'Handlungsbedarf', value: kpis.attentionTeams, detail: `${kpis.stallingTeams} ohne Schwung` },
        { label: 'Katalog fertig', value: kpis.completedCurrentCatalog, detail: `${kpis.catalogLagTeams} hängen beim Wechsel` },
      ];
    });

    const timelinePoints = computed(() => {
      const rows = summary.value?.timeline ?? [];
      const max = Math.max(...rows.map((row) => row.activityCount), 1);
      const width = 640;
      const height = 146;
      const top = 18;
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
    const generatedAtLabel = computed(() => formatDateTime(summary.value?.meta.generatedAt ?? null));

    const tabs = computed(() => {
      const teams = summary.value?.teams;
      return [
        { key: 'all' as TabKey, label: 'Alle nach Fortschritt', count: teams?.all?.length ?? 0 },
        { key: 'attention' as TabKey, label: 'Handlungsbedarf', count: teams?.attention?.length ?? 0 },
        { key: 'recent' as TabKey, label: 'Gerade aktiv', count: teams?.recent?.length ?? 0 },
        { key: 'stalling' as TabKey, label: 'Stillstand', count: teams?.stalling?.length ?? 0 },
        { key: 'catalogLag' as TabKey, label: 'Katalogwechsel', count: teams?.catalogLag?.length ?? 0 },
        { key: 'spurious' as TabKey, label: 'Prüfen', count: teams?.spurious?.length ?? 0 },
      ];
    });

    const activeTeams = computed(() => summary.value?.teams[activeTab.value] ?? []);
    const filteredTeams = computed(() => {
      const query = searchTerm.value.trim().toLowerCase();
      if (!query) return activeTeams.value;
      return activeTeams.value.filter((team) => {
        const memberMatch = team.members.some((member) => `${member.name} ${member.email ?? ''}`.toLowerCase().includes(query));
        return `${team.name} ${team.localteamName ?? ''} ${team.state ?? ''}`.toLowerCase().includes(query) || memberMatch;
      });
    });
    const selectedTeam = computed(() => allTeams.value.find((team) => team.id === selectedTeamId.value) ?? filteredTeams.value[0] ?? allTeams.value[0] ?? null);
    const activeEmails = computed(() => [...new Set(filteredTeams.value.flatMap((team) => team.contactEmails))]);

    function selectTeam(id: string) {
      selectedTeamId.value = id;
    }

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

    function formatDateTime(value: string | null) {
      if (!value) return 'noch nicht geladen';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'unbekannt';
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }

    function relativeDate(value: string | null) {
      if (!value) return 'keine Aktivität';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'unbekannt';
      const daysAgo = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
      if (daysAgo === 0) return 'heute';
      if (daysAgo === 1) return 'gestern';
      return `vor ${daysAgo} Tagen`;
    }

    function statusLabel(status: string | null) {
      const labels: Record<string, string> = {
        published: 'Veröffentlicht',
        draft: 'Entwurf',
        archived: 'Archiviert',
      };
      return labels[status ?? ''] ?? 'Status unbekannt';
    }

    function locationLabel(team: TeamSummary) {
      const parts = [team.state, team.population ? `${new Intl.NumberFormat('de-DE').format(team.population)} Ew.` : null].filter(Boolean);
      return parts.join(' · ') || 'Ort ohne Zusatzdaten';
    }

    function actionLabel(action: string | null) {
      if (action === 'create') return 'neu angelegt';
      if (action === 'update') return 'aktualisiert';
      return 'geändert';
    }

    function activityToneClass(team: TeamSummary) {
      return `tone-${team.activitySignal.tone}`;
    }

    function progressClass(value: number) {
      if (value >= 98) return 'progress-done';
      if (value >= 60) return 'progress-good';
      if (value >= 25) return 'progress-mid';
      return 'progress-low';
    }

    function recommendationsFor(team: TeamSummary) {
      const recommendations: string[] = [];

      if (team.memberCount === 0) recommendations.push('Mitgliederzuordnung prüfen, damit das Lokalteam erreichbar ist.');
      if (team.contactEmails.length === 0) recommendations.push('Kontaktadresse ergänzen, sonst sind Nachfragen nicht möglich.');
      if (team.currentCatalogProgress < 25) recommendations.push('Einstiegshilfe anbieten und die nächsten drei Maßnahmen gemeinsam priorisieren.');
      if (team.attentionReasons.some((reason) => reason.type === 'stalling')) recommendations.push('Kurz nachfragen, ob Recherche, Quellen oder Rollenverteilung blockieren.');
      if (team.attentionReasons.some((reason) => reason.type === 'catalog_adoption')) recommendations.push('Beim Katalogwechsel unterstützen und offene Maßnahmen aus dem alten Katalog übertragen.');
      if (team.topUserShare >= 80 && team.activityCount >= 5) recommendations.push('Arbeit auf mehrere Personen verteilen, damit das Team stabiler wird.');
      if (team.activitySignal.key === 'today' || team.activitySignal.key === 'week') recommendations.push('Aktivität zeitnah wertschätzen und bei offenen Fragen direkt reagieren.');
      if (recommendations.length === 0) recommendations.push('Kein akuter Handlungsbedarf. Beim nächsten Check-in kurz bestätigen.');

      return recommendations;
    }

    watch(filteredTeams, (teams) => {
      if (teams.length === 0) {
        selectedTeamId.value = null;
        return;
      }

      if (!teams.some((team) => team.id === selectedTeamId.value)) {
        selectedTeamId.value = teams[0].id;
      }
    });

    onMounted(fetchSummary);

    return {
      activeEmails,
      activeTab,
      activityAreaPoints,
      activityLinePoints,
      activityToneClass,
      actionLabel,
      copyEmails,
      currentCatalogLabel,
      days,
      error,
      fetchSummary,
      filteredTeams,
      firstTimelineLabel,
      generatedAtLabel,
      kpiCards,
      lastTimelineLabel,
      loading,
      locationLabel,
      mailBody,
      mailSubject,
      mailtoFor,
      progressClass,
      recentTeams,
      recommendationsFor,
      relativeDate,
      searchTerm,
      selectTeam,
      selectedTeam,
      setDays,
      statusLabel,
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
  gap: 22px;
  min-height: 100%;
  padding: 22px;
  color: var(--theme--foreground, var(--foreground-normal));
  background: var(--theme--background, var(--background-page));
}

.community-activity.has-header {
  padding-top: 0;
}

.dashboard-header,
.toolbar,
.section-head,
.mail-actions,
.tabs,
.catalog-title,
.catalog-meta,
.detail-head,
.detail-actions,
.activity-cell,
.reason-list {
  display: flex;
  align-items: center;
}

.dashboard-header {
  justify-content: space-between;
  gap: 24px;
  padding: 22px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 8px);
  background: var(--theme--background-subdued, var(--background-input));
}

.dashboard-header h2,
h3,
h4,
p {
  margin: 0;
}

.dashboard-header h2 {
  margin-top: 3px;
  font-size: 28px;
  line-height: 1.15;
  font-weight: 700;
}

h3 {
  font-size: 18px;
  line-height: 1.25;
  font-weight: 700;
}

h4 {
  font-size: 15px;
  font-weight: 700;
}

.eyebrow {
  color: var(--theme--primary, var(--primary));
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.header-copy,
.section-head p,
.kpi-detail,
.catalog-meta,
.team-name small,
.detail-head p,
.detail-stats span,
.member-row small,
.activity-list small,
.activity-list span,
.empty-inline,
.empty-detail {
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
}

.header-copy,
.section-head p {
  margin-top: 6px;
  font-size: 14px;
}

.toolbar {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.window-controls,
.tabs,
.mail-actions,
.reason-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

button,
a,
textarea {
  font: inherit;
}

.window-button,
.tab,
.action-button,
.icon-button,
.text-button {
  border: 1px solid var(--theme--border-color, var(--border-normal));
  color: var(--theme--foreground, var(--foreground-normal));
  background: var(--theme--background, var(--background-page));
  border-radius: var(--theme--border-radius, 6px);
}

.window-button,
.tab,
.action-button,
.text-button {
  min-height: 42px;
  padding: 0 14px;
}

.window-button,
.tab,
.text-button {
  cursor: pointer;
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
  width: 42px;
  height: 42px;
  text-decoration: none;
}

.refresh-button {
  background: var(--theme--primary, var(--primary));
  color: var(--white, #fff);
}

.icon-button:disabled,
.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.text-button {
  white-space: nowrap;
}

.notice {
  margin: 0;
}

.loading {
  display: grid;
  min-height: 320px;
  place-items: center;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(160px, 1fr));
  gap: 14px;
}

.kpi,
.panel-card,
.activity-strip {
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 8px);
  background: var(--theme--background, var(--background-page));
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 124px;
  padding: 18px;
}

.kpi-label {
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

.kpi strong {
  font-size: 34px;
  line-height: 1;
}

.activity-strip,
.panel-card {
  padding: 18px;
}

.section-head {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.stacked-head {
  align-items: flex-start;
}

.search-input {
  width: min(320px, 100%);
}

.section-badge {
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  font-size: 13px;
  white-space: nowrap;
}

.signal-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 12px;
}

.signal-card,
.empty-card {
  min-height: 88px;
  padding: 14px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
  background: var(--theme--background-subdued, var(--background-input));
  text-align: left;
}

.signal-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  cursor: pointer;
}

.signal-card strong,
.signal-card small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signal-card small {
  grid-column: 2;
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
}

.signal-dot {
  width: 11px;
  height: 11px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--theme--foreground-subdued, var(--foreground-subdued));
}

.tone-strong {
  background: var(--theme--primary, var(--primary));
  box-shadow: 0 0 0 5px var(--theme--primary-background, var(--primary-alt));
}

.tone-active {
  background: #2f80ed;
}

.tone-watch {
  background: var(--warning, #f5a524);
}

.tone-quiet {
  background: var(--theme--foreground-subdued, var(--foreground-subdued));
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.85fr);
  gap: 18px;
}

.timeline {
  width: 100%;
  height: 220px;
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
  stroke-width: 4;
}

.dot {
  fill: var(--theme--primary, var(--primary));
}

.catalog-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.catalog-title,
.catalog-meta {
  justify-content: space-between;
  gap: 10px;
}

.catalog-title {
  font-weight: 700;
}

.progress-track {
  display: block;
  height: 11px;
  margin: 9px 0;
  overflow: hidden;
  border-radius: 999px;
  background: var(--theme--border-color, var(--border-normal));
}

.progress-track span {
  display: block;
  height: 100%;
  background: var(--theme--primary, var(--primary));
}

.progress-track.compact {
  height: 9px;
  margin: 0;
}

.progress-low {
  background: var(--danger, #d32f2f) !important;
}

.progress-mid {
  background: var(--warning, #f5a524) !important;
}

.progress-good {
  background: #2f80ed !important;
}

.progress-done {
  background: var(--theme--primary, var(--primary)) !important;
}

.mail-section {
  display: grid;
  grid-template-columns: minmax(220px, 0.6fr) minmax(0, 1fr) auto;
  gap: 18px;
  align-items: end;
}

.mail-fields {
  display: grid;
  gap: 10px;
}

.mail-body {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
  padding: 12px 14px;
  color: var(--theme--foreground, var(--foreground-normal));
  background: var(--theme--background-subdued, var(--background-input));
  font-family: var(--theme--fonts--sans--font-family, var(--family-sans-serif));
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.workbench {
  display: grid;
  grid-template-columns: minmax(520px, 1.15fr) minmax(380px, 0.85fr);
  gap: 18px;
  align-items: start;
}

.tabs {
  margin-bottom: 16px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
  grid-template-columns: minmax(230px, 1.4fr) minmax(150px, 0.8fr) minmax(160px, 0.9fr) 110px;
  gap: 16px;
  align-items: center;
  width: 100%;
  min-height: 64px;
  padding: 12px 14px;
  border: 0;
  border-top: 1px solid var(--theme--border-color, var(--border-normal));
  color: inherit;
  background: transparent;
  text-align: left;
}

.table-row:first-child {
  border-top: 0;
}

.table-head {
  min-height: 46px;
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  background: var(--theme--background-subdued, var(--background-input));
  font-size: 13px;
  font-weight: 700;
}

.team-row {
  cursor: pointer;
}

.team-row:hover,
.team-row.selected {
  background: var(--theme--primary-background, var(--primary-alt));
}

.team-name,
.progress-cell,
.activity-cell {
  min-width: 0;
}

.team-name,
.progress-cell {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.team-name strong,
.team-name small,
.activity-cell span:last-child,
.members-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-label {
  font-weight: 700;
}

.activity-cell {
  gap: 9px;
}

.members-cell {
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
}

.empty {
  padding: 20px;
  color: var(--theme--foreground-subdued, var(--foreground-subdued));
  text-align: center;
}

.detail-panel {
  position: sticky;
  top: 12px;
}

.detail-head {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.detail-head h3 {
  margin-top: 4px;
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.detail-stats div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 82px;
  padding: 14px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
  background: var(--theme--background-subdued, var(--background-input));
}

.detail-stats strong {
  font-size: 22px;
}

.detail-block {
  margin-top: 20px;
}

.recommendations {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;
  padding-left: 18px;
}

.member-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
  background: var(--theme--background-subdued, var(--background-input));
}

.member-row div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.member-row strong,
.member-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-list {
  display: grid;
  gap: 10px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.activity-list li {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid var(--theme--border-color, var(--border-normal));
  border-radius: var(--theme--border-radius, 6px);
}

.empty-inline {
  margin-top: 10px;
}

.empty-detail {
  display: grid;
  min-height: 360px;
  place-items: center;
  text-align: center;
}

@media (max-width: 1400px) {
  .kpis,
  .signal-grid {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }

  .mail-section,
  .main-grid,
  .workbench {
    grid-template-columns: 1fr;
  }

  .detail-panel {
    position: static;
  }
}

@media (max-width: 900px) {
  .community-activity {
    padding: 14px;
  }

  .dashboard-header,
  .section-head,
  .mail-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar {
    justify-content: flex-start;
  }

  .kpis,
  .signal-grid {
    grid-template-columns: 1fr;
  }

  .table-row {
    grid-template-columns: minmax(180px, 1fr) 120px;
  }

  .table-row > :nth-child(3),
  .table-row > :nth-child(4) {
    display: none;
  }
}
</style>
