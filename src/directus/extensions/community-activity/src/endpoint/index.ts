import type { Request, Response, Router } from 'express';
import type { Database } from '@directus/types';

interface Accountability {
  admin?: boolean;
  user?: string;
  role?: string;
}

interface AuthenticatedRequest extends Request {
  accountability?: Accountability;
}

interface ExtensionContext {
  database: Database;
  env: Record<string, string | undefined>;
  logger?: {
    error: (message: string, error?: unknown) => void;
  };
}

interface CatalogRow {
  id: string;
  name: string;
  isCurrentFrontend: boolean | null;
  isCurrentBackend: boolean | null;
  hidden: boolean | null;
  date_created: string | null;
  measures: string | number | null;
}

interface TeamRow {
  id: string;
  name: string | null;
  slug: string | null;
  status: string | null;
  municipality_name: string | null;
  date_created: string | null;
  admin_id: string | null;
  municipality_id: string | null;
  municipality: string | null;
  state: string | null;
  population: number | null;
  admin_email: string | null;
}

interface MemberRow {
  team_id: string;
  user_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role_name: string | null;
  is_admin: boolean | string | number | null;
}

interface ActivityRow {
  team_id: string;
  activity_count: string | number | null;
  active_users: string | number | null;
  touched_measures: string | number | null;
  created_count: string | number | null;
  updated_count: string | number | null;
  last_activity: string | null;
}

interface UserShareRow {
  team_id: string;
  user_id: string | null;
  user_email: string | null;
  user_activity_count: string | number | null;
}

interface TimelineRow {
  bucket: string;
  activity_count: string | number | null;
  active_users: string | number | null;
  active_teams: string | number | null;
}

interface LatestScoreRow {
  team_id: string;
  catalog_version: string;
  percentage_rated: string | number | null;
  score_total: string | number | null;
  score_date: string | null;
}

interface LatestActivityRow {
  team_id: string;
  timestamp: string | null;
  action: string | null;
  user_email: string | null;
  first_name: string | null;
  last_name: string | null;
  measure_name: string | null;
}

type TeamAttentionType = 'stalling' | 'spurious' | 'catalog_adoption';

const ALLOWED_POLICIES = new Set(['Dashboard-Editor', 'Read-Everything']);
const ALLOWED_ROLES = new Set(['Planungsteam', 'Administrator']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clampDays(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(parsed, 7), 365);
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function daysBetween(now: Date, date: string | null): number | null {
  if (!date) return null;
  const parsed = new Date(date).getTime();
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed) / MS_PER_DAY));
}

function displayTeamName(team: TeamRow): string {
  return team.municipality || team.municipality_name || team.name || 'Unbenanntes Lokalteam';
}

function displayUserName(row: { first_name: string | null; last_name: string | null; user_email?: string | null; email?: string | null }): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return name || row.user_email || row.email || 'Unbekannte Person';
}

function isTrue(value: boolean | string | number | null | undefined): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 't';
}

function uniqueEmails(rows: MemberRow[]): string[] {
  return [...new Set(rows.map((row) => row.email?.trim().toLowerCase()).filter((email): email is string => Boolean(email)))];
}

function buildActivitySignal(activityCount: number, daysSinceActivity: number | null): { key: string; label: string; tone: string } {
  if (activityCount === 0) return { key: 'none', label: 'Keine Aktivität im Zeitraum', tone: 'quiet' };
  if (daysSinceActivity === 0) return { key: 'today', label: 'Heute aktiv', tone: 'strong' };
  if (daysSinceActivity !== null && daysSinceActivity <= 7) return { key: 'week', label: 'Diese Woche aktiv', tone: 'active' };
  if (daysSinceActivity !== null && daysSinceActivity <= 30) return { key: 'recent', label: 'Kürzlich aktiv', tone: 'watch' };
  return { key: 'quiet', label: 'Länger ruhig', tone: 'quiet' };
}

async function canAccessDashboard(database: Database, accountability?: Accountability): Promise<boolean> {
  if (accountability?.admin) return true;
  if (!accountability?.user || !accountability.role) return false;

  const rows = await database('directus_roles as r')
    .leftJoin('directus_access as a', 'a.role', 'r.id')
    .leftJoin('directus_policies as p', 'p.id', 'a.policy')
    .where('r.id', accountability.role)
    .select('r.name as role_name', 'r.admin_access', 'p.name as policy_name');

  return rows.some((row: { role_name?: string; admin_access?: boolean; policy_name?: string }) =>
    row.admin_access === true ||
    ALLOWED_ROLES.has(String(row.role_name ?? '')) ||
    ALLOWED_POLICIES.has(String(row.policy_name ?? '')),
  );
}

function buildAttentionReasons(
  activityCount: number,
  touchedMeasures: number,
  maxUserShare: number,
  currentProgress: number,
  previousProgress: number,
  daysSinceActivity: number | null,
  days: number,
): Array<{ type: TeamAttentionType; label: string }> {
  const reasons: Array<{ type: TeamAttentionType; label: string }> = [];

  if (currentProgress < 98 && (activityCount === 0 || (daysSinceActivity !== null && daysSinceActivity > Math.max(14, Math.floor(days / 2))))) {
    reasons.push({ type: 'stalling', label: 'Keine aktuelle Bearbeitung' });
  }

  if (activityCount >= 10 && (touchedMeasures <= 3 || maxUserShare >= 0.9)) {
    reasons.push({ type: 'spurious', label: touchedMeasures <= 3 ? 'Viele Änderungen an wenigen Maßnahmen' : 'Fast nur eine aktive Person' });
  }

  if (previousProgress >= 50 && currentProgress < 25) {
    reasons.push({ type: 'catalog_adoption', label: 'Neuer Katalog kaum übernommen' });
  }

  return reasons;
}

function aggregateCatalogAdoption(catalogs: CatalogRow[], latestScores: LatestScoreRow[]) {
  return catalogs.map((catalog) => {
    const scores = latestScores
      .filter((score) => score.catalog_version === catalog.id)
      .map((score) => toNumber(score.percentage_rated));
    const teamsStarted = scores.filter((score) => score > 0).length;
    const teamsHalf = scores.filter((score) => score >= 50).length;
    const teamsComplete = scores.filter((score) => score >= 98).length;
    const averageProgress = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

    return {
      id: catalog.id,
      name: catalog.name,
      isCurrentFrontend: Boolean(catalog.isCurrentFrontend),
      isCurrentBackend: Boolean(catalog.isCurrentBackend),
      hidden: Boolean(catalog.hidden),
      measures: toNumber(catalog.measures),
      teamsStarted,
      teamsHalf,
      teamsComplete,
      averageProgress: round(averageProgress),
    };
  });
}

export default {
  id: 'community-activity',
  handler: (router: Router, { database, env, logger }: ExtensionContext) => {
    router.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!(await canAccessDashboard(database, req.accountability))) {
          return res.status(req.accountability?.user ? 403 : 401).json({ error: 'Kein Zugriff auf dieses Dashboard.' });
        }

        const days = clampDays(req.query.days);
        const now = new Date();
        const since = new Date(now.getTime() - days * MS_PER_DAY);
        const bucket = days > 120 ? 'week' : 'day';

        const catalogs = await database('measure_catalog as mc')
          .leftJoin('measures as m', 'm.catalog_version', 'mc.id')
          .select(
            'mc.id',
            'mc.name',
            'mc.isCurrentFrontend',
            'mc.isCurrentBackend',
            'mc.hidden',
            'mc.date_created',
          )
          .count('m.id as measures')
          .groupBy('mc.id')
          .orderBy('mc.date_created', 'desc') as CatalogRow[];

        const currentCatalog = catalogs.find((catalog) => catalog.isCurrentFrontend) ?? catalogs.find((catalog) => catalog.isCurrentBackend) ?? catalogs[0] ?? null;
        const previousCatalog = catalogs.find((catalog) => catalog.id !== currentCatalog?.id && !catalog.hidden) ?? null;

        const [
          teams,
          members,
          activityRows,
          globalActiveUserRows,
          userShareRows,
          timelineRows,
          latestScores,
          latestActivityRows,
        ] = await Promise.all([
          database('localteams as l')
            .leftJoin('municipalities as m', 'm.localteam_id', 'l.id')
            .leftJoin('directus_users as admin', 'admin.id', 'l.admin_id')
            .select(
              'l.id',
              'l.name',
              'l.slug',
              'l.status',
              'l.municipality_name',
              'l.date_created',
              'l.admin_id',
              'm.id as municipality_id',
              'm.name as municipality',
              'm.state',
              'm.population',
              'admin.email as admin_email',
            )
            .orderBy('l.municipality_name', 'asc') as Promise<TeamRow[]>,

          database
            .raw(`
              select distinct on (team_id, user_id)
                team_id,
                user_id,
                email,
                first_name,
                last_name,
                role_name,
                is_admin
              from (
                select
                  l.id as team_id,
                  admin.id as user_id,
                  admin.email,
                  admin.first_name,
                  admin.last_name,
                  r.name as role_name,
                  true as is_admin,
                  0 as priority
                from localteams l
                left join directus_users admin on admin.id = l.admin_id
                left join directus_roles r on r.id = admin.role
                where admin.id is not null and coalesce(admin.status, '') != 'archived'
                union all
                select
                  j.localteam_id as team_id,
                  u.id as user_id,
                  u.email,
                  u.first_name,
                  u.last_name,
                  r.name as role_name,
                  l.admin_id = u.id as is_admin,
                  1 as priority
                from junction_directus_users_localteams j
                join directus_users u on u.id = j.directus_users_id
                join localteams l on l.id = j.localteam_id
                left join directus_roles r on r.id = u.role
                where u.id is not null and coalesce(u.status, '') != 'archived'
              ) members
              order by team_id, user_id, is_admin desc, priority asc, email
            `).then((result) => result.rows as MemberRow[]),

          database
            .raw(`
              select
                r.localteam_id as team_id,
                count(a.id) as activity_count,
                count(distinct a."user") filter (where a."user" is not null) as active_users,
                count(distinct r.measure_id) as touched_measures,
                count(a.id) filter (where a.action = 'create') as created_count,
                count(a.id) filter (where a.action = 'update') as updated_count,
                max(a."timestamp") as last_activity
              from directus_activity a
              join ratings_measures r on r.id::text = a.item
              where a.collection = 'ratings_measures'
                and a.action in ('create', 'update')
                and a."timestamp" >= ?
              group by r.localteam_id
            `, [since.toISOString()]).then((result) => result.rows as ActivityRow[]),

          database
            .raw(`
              select count(distinct a."user") as active_users
              from directus_activity a
              join ratings_measures r on r.id::text = a.item
              where a.collection = 'ratings_measures'
                and a.action in ('create', 'update')
                and a."user" is not null
                and a."timestamp" >= ?
            `, [since.toISOString()]).then((result) => result.rows as Array<{ active_users: string | number | null }>),

          database
            .raw(`
              select distinct on (team_id)
                team_id,
                user_id,
                user_email,
                user_activity_count
              from (
                select
                  r.localteam_id as team_id,
                  a."user" as user_id,
                  u.email as user_email,
                  count(a.id) as user_activity_count
                from directus_activity a
                join ratings_measures r on r.id::text = a.item
                left join directus_users u on u.id = a."user"
                where a.collection = 'ratings_measures'
                  and a.action in ('create', 'update')
                  and a."user" is not null
                  and a."timestamp" >= ?
                group by r.localteam_id, a."user", u.email
              ) by_user
              order by team_id, user_activity_count desc
            `, [since.toISOString()]).then((result) => result.rows as UserShareRow[]),

          database
            .raw(`
              select
                to_char(date_trunc('${bucket}', a."timestamp"), 'YYYY-MM-DD') as bucket,
                count(a.id) as activity_count,
                count(distinct a."user") filter (where a."user" is not null) as active_users,
                count(distinct r.localteam_id) as active_teams
              from directus_activity a
              join ratings_measures r on r.id::text = a.item
              where a.collection = 'ratings_measures'
                and a.action in ('create', 'update')
                and a."timestamp" >= ?
              group by date_trunc('${bucket}', a."timestamp")
              order by date_trunc('${bucket}', a."timestamp")
            `, [since.toISOString()]).then((result) => result.rows as TimelineRow[]),

          database
            .raw(`
              select distinct on (m.localteam_id, s.catalog_version)
                m.localteam_id as team_id,
                s.catalog_version,
                s.percentage_rated,
                s.score_total,
                coalesce(s.date_updated, s.date_created) as score_date
              from municipality_scores s
              join municipalities m on m.id = s.municipality
              where m.localteam_id is not null
                and s.catalog_version is not null
              order by m.localteam_id, s.catalog_version, coalesce(s.date_updated, s.date_created) desc nulls last
            `).then((result) => result.rows as LatestScoreRow[]),

          database
            .raw(`
              select
                team_id,
                "timestamp",
                action,
                user_email,
                first_name,
                last_name,
                measure_name
              from (
                select
                  r.localteam_id as team_id,
                  a."timestamp",
                  a.action,
                  u.email as user_email,
                  u.first_name,
                  u.last_name,
                  m.name as measure_name,
                  row_number() over (partition by r.localteam_id order by a."timestamp" desc) as rn
                from directus_activity a
                join ratings_measures r on r.id::text = a.item
                left join directus_users u on u.id = a."user"
                left join measures m on m.id = r.measure_id
                where a.collection = 'ratings_measures'
                  and a.action in ('create', 'update')
                  and a."timestamp" >= ?
              ) ranked_activity
              where rn <= 5
              order by team_id, "timestamp" desc
            `, [since.toISOString()]).then((result) => result.rows as LatestActivityRow[]),
        ]);

        const membersByTeam = new Map<string, MemberRow[]>();
        for (const member of members) {
          const list = membersByTeam.get(member.team_id) ?? [];
          list.push(member);
          membersByTeam.set(member.team_id, list);
        }

        const latestActivityByTeam = new Map<string, LatestActivityRow[]>();
        for (const activity of latestActivityRows) {
          const list = latestActivityByTeam.get(activity.team_id) ?? [];
          list.push(activity);
          latestActivityByTeam.set(activity.team_id, list);
        }

        const activityByTeam = new Map(activityRows.map((row) => [row.team_id, row]));
        const topUserByTeam = new Map(userShareRows.map((row) => [row.team_id, row]));
        const scoresByTeamAndCatalog = new Map(
          latestScores.map((score) => [`${score.team_id}:${score.catalog_version}`, score]),
        );

        const teamSummaries = teams.map((team) => {
          const activity = activityByTeam.get(team.id);
          const topUser = topUserByTeam.get(team.id);
          const activityCount = toNumber(activity?.activity_count);
          const topUserActivity = toNumber(topUser?.user_activity_count);
          const maxUserShare = activityCount > 0 ? topUserActivity / activityCount : 0;
          const currentScore = currentCatalog ? scoresByTeamAndCatalog.get(`${team.id}:${currentCatalog.id}`) : undefined;
          const previousScore = previousCatalog ? scoresByTeamAndCatalog.get(`${team.id}:${previousCatalog.id}`) : undefined;
          const currentProgress = toNumber(currentScore?.percentage_rated);
          const previousProgress = toNumber(previousScore?.percentage_rated);
          const daysSinceActivity = daysBetween(now, activity?.last_activity ?? null);
          const teamMembers = membersByTeam.get(team.id) ?? [];
          const contactEmails = uniqueEmails(teamMembers);
          const attentionReasons = buildAttentionReasons(
            activityCount,
            toNumber(activity?.touched_measures),
            maxUserShare,
            currentProgress,
            previousProgress,
            daysSinceActivity,
            days,
          );

          return {
            id: team.id,
            name: displayTeamName(team),
            localteamName: team.name,
            slug: team.slug,
            status: team.status,
            state: team.state,
            population: team.population,
            contactEmails,
            memberCount: teamMembers.length,
            members: teamMembers
              .map((member) => ({
                id: member.user_id,
                name: displayUserName(member),
                email: member.email?.trim().toLowerCase() ?? null,
                role: member.role_name,
                isAdmin: isTrue(member.is_admin) || member.user_id === team.admin_id,
              }))
              .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name)),
            activityCount,
            activeUsers: toNumber(activity?.active_users),
            touchedMeasures: toNumber(activity?.touched_measures),
            createdCount: toNumber(activity?.created_count),
            updatedCount: toNumber(activity?.updated_count),
            lastActivity: activity?.last_activity ?? null,
            daysSinceActivity,
            currentCatalogProgress: round(currentProgress),
            previousCatalogProgress: round(previousProgress),
            scoreTotal: round(toNumber(currentScore?.score_total)),
            topUserEmail: topUser?.user_email ?? null,
            topUserShare: round(maxUserShare * 100),
            activitySignal: buildActivitySignal(activityCount, daysSinceActivity),
            recentActivity: (latestActivityByTeam.get(team.id) ?? []).map((latestActivity) => ({
              timestamp: latestActivity.timestamp,
              action: latestActivity.action,
              userName: displayUserName(latestActivity),
              userEmail: latestActivity.user_email?.trim().toLowerCase() ?? null,
              measureName: latestActivity.measure_name,
            })),
            attentionReasons,
          };
        });

        const activeTeams = teamSummaries.filter((team) => team.activityCount > 0);
        const globalActiveUsers = toNumber(globalActiveUserRows[0]?.active_users);
        const attentionTeams = teamSummaries.filter((team) => team.attentionReasons.length > 0);
        const stallingTeams = teamSummaries.filter((team) => team.attentionReasons.some((reason) => reason.type === 'stalling'));
        const spuriousTeams = teamSummaries.filter((team) => team.attentionReasons.some((reason) => reason.type === 'spurious'));
        const catalogLagTeams = teamSummaries.filter((team) => team.attentionReasons.some((reason) => reason.type === 'catalog_adoption'));
        const ratingActivity = activityRows.reduce((sum, row) => sum + toNumber(row.activity_count), 0);
        const currentProgressValues = teamSummaries.map((team) => team.currentCatalogProgress).filter((value) => value > 0);
        const averageCurrentProgress = currentProgressValues.length > 0
          ? currentProgressValues.reduce((sum, value) => sum + value, 0) / currentProgressValues.length
          : 0;
        const teamsByProgress = [...teamSummaries].sort((a, b) =>
          a.currentCatalogProgress - b.currentCatalogProgress ||
          (b.daysSinceActivity ?? 9999) - (a.daysSinceActivity ?? 9999) ||
          a.name.localeCompare(b.name),
        );
        const recentTeams = activeTeams
          .sort((a, b) => new Date(b.lastActivity ?? 0).getTime() - new Date(a.lastActivity ?? 0).getTime())
          .slice(0, 8);

        return res.json({
          meta: {
            generatedAt: now.toISOString(),
            days,
            since: since.toISOString(),
            bucket,
            currentCatalog,
            previousCatalog,
            frontendBaseUrl: env.FRONTEND_BASE_URL ?? null,
          },
          kpis: {
            totalTeams: teams.length,
            activeTeams: activeTeams.length,
            activeUsers: globalActiveUsers,
            ratingActivity,
            attentionTeams: attentionTeams.length,
            stallingTeams: stallingTeams.length,
            spuriousTeams: spuriousTeams.length,
            catalogLagTeams: catalogLagTeams.length,
            completedCurrentCatalog: teamSummaries.filter((team) => team.currentCatalogProgress >= 98).length,
            averageCurrentProgress: round(averageCurrentProgress),
          },
          timeline: timelineRows.map((row) => ({
            bucket: row.bucket,
            activityCount: toNumber(row.activity_count),
            activeUsers: toNumber(row.active_users),
            activeTeams: toNumber(row.active_teams),
          })),
          catalogAdoption: aggregateCatalogAdoption(catalogs, latestScores),
          teams: {
            all: teamsByProgress,
            recent: recentTeams,
            attention: attentionTeams
              .sort((a, b) => b.attentionReasons.length - a.attentionReasons.length || b.activityCount - a.activityCount || a.name.localeCompare(b.name))
              .slice(0, 25),
            stalling: stallingTeams
              .sort((a, b) => (b.daysSinceActivity ?? 9999) - (a.daysSinceActivity ?? 9999))
              .slice(0, 25),
            mostActive: [...teamSummaries]
              .sort((a, b) => b.activityCount - a.activityCount)
              .slice(0, 15),
            spurious: spuriousTeams
              .sort((a, b) => b.activityCount - a.activityCount)
              .slice(0, 15),
            catalogLag: catalogLagTeams
              .sort((a, b) => b.previousCatalogProgress - a.previousCatalogProgress)
              .slice(0, 25),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger?.error(`[community-activity] Failed to build summary: ${message}`);
        console.error('[community-activity] Failed to build summary:', error);
        return res.status(500).json({ error: 'Dashboard konnte nicht geladen werden.' });
      }
    });
  },
};
