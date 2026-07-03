import { assert } from './assert.js';
import { DirectusClient } from './directus.js';
import { waitFor } from './wait.js';
import type { TestConfig } from './config.js';

interface Role {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  role?: string | { id: string; name: string };
  status?: string;
  verified?: boolean;
}

interface Localteam {
  id: string;
  name: string;
  slug: string;
  municipality_name: string;
}

interface Municipality {
  id: string;
  name: string;
  slug?: string | null;
  preview_token?: string | null;
  creator_verified?: boolean | null;
  localteam_id?: string;
}

interface MunicipalityScore {
  id: string;
  catalog_version: string | { id: string; name?: string; isCurrentFrontend?: boolean; isCurrentBackend?: boolean };
  municipality: string;
  published: boolean | null;
  score_total: string | number | null;
  score_points: string | number | null;
  score_max: string | number | null;
  percentage_rated: string | number | null;
}

interface AgreementVersion {
  id: string;
  type: string;
}

export interface FixtureUser {
  id: string;
  email: string;
  password: string;
  roleName: string;
  client: DirectusClient;
}

export class TestFixture {
  readonly localteamName: string;
  readonly municipalityName: string;
  readonly localteamSlug: string;
  readonly adminPassword: string;
  readonly memberPassword: string;
  readonly wahlcheckAdminPassword: string;
  readonly invitedEmail: string;
  readonly candidateAEmail: string;
  readonly candidateBEmail: string;

  roles = new Map<string, Role>();
  localteam!: Localteam;
  municipality!: Municipality;
  localteamAdmin!: FixtureUser;
  localteamMember!: FixtureUser;
  wahlcheckAdmin!: FixtureUser;

  constructor(
    readonly config: TestConfig,
    readonly admin: DirectusClient,
  ) {
    this.localteamName = `AutomatedTest ${config.runId}`;
    this.municipalityName = `Automated Municipality ${config.runId}`;
    this.localteamSlug = `automated-test-${config.runId}`;
    this.adminPassword = `AutomatedAdmin-${config.runId}-A1!`;
    this.memberPassword = `AutomatedMember-${config.runId}-A1!`;
    this.wahlcheckAdminPassword = `AutomatedWahlcheck-${config.runId}-A1!`;
    this.invitedEmail = `automated-invite-${config.runId}@stadt-land-klima.de`;
    this.candidateAEmail = `automated-candidate-a-${config.runId}@stadt-land-klima.de`;
    this.candidateBEmail = `automated-candidate-b-${config.runId}@stadt-land-klima.de`;
  }

  async setup(): Promise<void> {
    await this.loadRoles();
    await this.createLocalteam();
    await this.createUsers();
    await this.admin.updateItem('localteams', this.localteam.id, { admin_id: this.localteamAdmin.id });
    await this.waitForGeneratedMunicipalityState();
  }

  async loadRoles(): Promise<void> {
    const roles = await this.admin.request<Role[]>('GET', '/roles', {
      query: { fields: 'id,name', limit: -1 },
    });
    this.roles = new Map(roles.map((role) => [role.name, role]));

    for (const roleName of ['LokalteamAdmin', 'LokalteamMitglied', 'WahlcheckAdmin']) {
      assert(this.roles.has(roleName), `Required role is missing: ${roleName}`);
    }
  }

  private roleId(name: string): string {
    const role = this.roles.get(name);
    assert(role, `Required role is missing: ${name}`);
    return role.id;
  }

  async createLocalteam(): Promise<void> {
    this.localteam = await this.admin.createItem<Localteam>('localteams', {
      name: this.localteamName,
      municipality_name: this.municipalityName,
      slug: this.localteamSlug,
      status: 'published',
    });

    this.municipality = await waitFor(
      'municipality created by createMunicipality flow',
      async () => {
        const municipalities = await this.admin.readItems<Municipality>('municipalities', {
          filter: { localteam_id: { _eq: this.localteam.id } },
          fields: ['id', 'name', 'slug', 'preview_token', 'creator_verified', 'localteam_id'],
          limit: 1,
        });
        return municipalities[0];
      },
      { timeoutMs: 45_000 },
    );
  }

  async createUsers(): Promise<void> {
    this.localteamAdmin = await this.createUser(
      `automated-localteam-admin-${this.config.runId}@stadt-land-klima.de`,
      this.adminPassword,
      'LokalteamAdmin',
      false,
    );
    this.localteamMember = await this.createUser(
      `automated-localteam-member-${this.config.runId}@stadt-land-klima.de`,
      this.memberPassword,
      'LokalteamMitglied',
      false,
    );
    this.wahlcheckAdmin = await this.createUser(
      `automated-wahlcheck-admin-${this.config.runId}@stadt-land-klima.de`,
      this.wahlcheckAdminPassword,
      'WahlcheckAdmin',
      true,
    );

    await this.addUserToLocalteam(this.localteamAdmin.id);
    await this.addUserToLocalteam(this.localteamMember.id);

    this.localteamAdmin.client = await this.authenticatedClient(
      this.localteamAdmin.email,
      this.localteamAdmin.password,
    );
    this.localteamMember.client = await this.authenticatedClient(
      this.localteamMember.email,
      this.localteamMember.password,
    );
    this.wahlcheckAdmin.client = await this.authenticatedClient(
      this.wahlcheckAdmin.email,
      this.wahlcheckAdmin.password,
    );

    await this.acceptCurrentAgreements();
  }

  private async createUser(
    email: string,
    password: string,
    roleName: string,
    verified: boolean,
  ): Promise<FixtureUser> {
    const user = await this.admin.createUser<User>({
      email,
      password,
      role: this.roleId(roleName),
      status: 'active',
      first_name: 'Automated',
      last_name: roleName,
      verified,
    });

    return {
      id: user.id,
      email,
      password,
      roleName,
      client: new DirectusClient(this.config.backendUrl),
    };
  }

  private async authenticatedClient(email: string, password: string): Promise<DirectusClient> {
    const client = new DirectusClient(this.config.backendUrl);
    await client.login(email, password);
    return client;
  }

  private async addUserToLocalteam(userId: string): Promise<void> {
    await this.admin.createItem('junction_directus_users_localteams', {
      directus_users_id: userId,
      localteam_id: this.localteam.id,
    });
  }

  private async acceptCurrentAgreements(): Promise<void> {
    const agreements = await this.admin.readItems<AgreementVersion>('agreement_versions', {
      filter: {
        isCurrentVersion: { _eq: true },
        type: { _in: ['terms_of_service', 'data_protection'] },
      },
      fields: ['id', 'type'],
      limit: -1,
    });
    const agreementByType = new Map(agreements.map((agreement) => [agreement.type, agreement]));

    for (const type of ['terms_of_service', 'data_protection']) {
      assert(agreementByType.has(type), `Current agreement version is missing: ${type}`);
    }

    for (const user of [this.localteamAdmin, this.localteamMember, this.wahlcheckAdmin]) {
      for (const agreement of agreementByType.values()) {
        await this.admin.createItem('user_consent', {
          user_id: user.id,
          consent_target: agreement.id,
        });
      }
    }
  }

  async waitForGeneratedMunicipalityState(): Promise<void> {
    await waitFor(
      'municipality score rows',
      async () => {
        const scores = await this.getScores();
        return scores.length >= 1 ? scores : false;
      },
      { timeoutMs: 45_000 },
    );

    await waitFor(
      'generated rating rows',
      async () => {
        const ratings = await this.admin.readItems<{ id: string }>('ratings_measures', {
          filter: { localteam_id: { _eq: this.localteam.id } },
          fields: ['id'],
          limit: -1,
        });
        return ratings.length >= 1 ? ratings : false;
      },
      { timeoutMs: 45_000 },
    );

    const beforePreview = await this.admin.readItem<Municipality>('municipalities', this.municipality.id, [
      'id',
      'name',
      'slug',
      'preview_token',
      'creator_verified',
      'localteam_id',
    ]);
    if (!beforePreview.preview_token) {
      await this.admin.updateItem('municipalities', this.municipality.id, {
        name: beforePreview.name,
      });
    }

    const withFlowToken = await waitFor(
      'municipality preview token',
      async () => {
        const municipality = await this.admin.readItem<Municipality>('municipalities', this.municipality.id, [
          'id',
          'name',
          'slug',
          'preview_token',
          'creator_verified',
          'localteam_id',
        ]);
        if (!municipality.preview_token) return false;
        return municipality;
      },
      { timeoutMs: 6_000, intervalMs: 750 },
    ).catch(() => null);

    if (withFlowToken) {
      this.municipality = withFlowToken;
      return;
    }

    const token = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    this.municipality = await this.admin.updateItem<Municipality>('municipalities', this.municipality.id, {
      preview_token: token,
    });
  }

  async getScores(): Promise<MunicipalityScore[]> {
    return this.admin.readItems<MunicipalityScore>('municipality_scores', {
      filter: { municipality: { _eq: this.municipality.id } },
      fields: [
        'id',
        'municipality',
        'published',
        'score_total',
        'score_points',
        'score_max',
        'percentage_rated',
        'catalog_version.id',
        'catalog_version.name',
        'catalog_version.isCurrentFrontend',
        'catalog_version.isCurrentBackend',
      ],
      limit: -1,
    });
  }

  async refreshUserClients(): Promise<void> {
    this.localteamAdmin.client = await this.authenticatedClient(
      this.localteamAdmin.email,
      this.localteamAdmin.password,
    );
    this.localteamMember.client = await this.authenticatedClient(
      this.localteamMember.email,
      this.localteamMember.password,
    );
    this.wahlcheckAdmin.client = await this.authenticatedClient(
      this.wahlcheckAdmin.email,
      this.wahlcheckAdmin.password,
    );
  }

  async cleanup(): Promise<void> {
    const runId = this.config.runId;
    const ignore = async (label: string, callback: () => Promise<void>) => {
      try {
        await callback();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stdout.write(`[cleanup] Ignored ${label}: ${message}\n`);
      }
    };

    const localteams = await this.admin.readItems<{ id: string }>('localteams', {
      filter: { name: { _contains: runId } },
      fields: ['id'],
      limit: -1,
    }).catch(() => []);
    const localteamIds = localteams.map((item) => item.id);

    const municipalities = localteamIds.length > 0
      ? await this.admin.readItems<{ id: string }>('municipalities', {
        filter: { localteam_id: { _in: localteamIds } },
        fields: ['id'],
        limit: -1,
      }).catch(() => [])
      : [];
    const municipalityIds = municipalities.map((item) => item.id);

    const elections = localteamIds.length > 0
      ? await this.admin.readItems<{ id: string }>('elections', {
        filter: { localteam: { _in: localteamIds } },
        fields: ['id'],
        limit: -1,
      }).catch(() => [])
      : [];
    const electionIds = elections.map((item) => item.id);

    const candidates = await this.admin.readItems<{ id: string }>('candidate', {
      filter: { email: { _contains: runId } },
      fields: ['id'],
      limit: -1,
    }).catch(() => []);
    const candidateIds = candidates.map((item) => item.id);

    const questions = electionIds.length > 0
      ? await this.admin.readItems<{ id: string }>('questions', {
        filter: { election: { _in: electionIds } },
        fields: ['id'],
        limit: -1,
      }).catch(() => [])
      : [];
    const questionIds = questions.map((item) => item.id);

    const answersByCandidate = candidateIds.length > 0
      ? await this.admin.readItems<{ id: string }>('answers', {
        filter: { candidate: { _in: candidateIds } },
        fields: ['id'],
        limit: -1,
      }).catch(() => [])
      : [];
    const answersByQuestion = questionIds.length > 0
      ? await this.admin.readItems<{ id: string }>('answers', {
        filter: { question: { _in: questionIds } },
        fields: ['id'],
        limit: -1,
      }).catch(() => [])
      : [];
    const answerIds = [...new Set([...answersByCandidate, ...answersByQuestion].map((item) => item.id))];

    for (const id of answerIds) await ignore(`answer ${id}`, () => this.admin.deleteItem('answers', id));
    for (const id of candidateIds) await ignore(`candidate ${id}`, () => this.admin.deleteItem('candidate', id));
    for (const id of questionIds) await ignore(`question ${id}`, () => this.admin.deleteItem('questions', id));
    for (const id of electionIds) await ignore(`election ${id}`, () => this.admin.deleteItem('elections', id));

    const editors = await this.admin.readItems<{ id: string }>('editors', {
      filter: { email: { _contains: runId } },
      fields: ['id'],
      limit: -1,
    }).catch(() => []);
    for (const editor of editors) await ignore(`editor ${editor.id}`, () => this.admin.deleteItem('editors', editor.id));

    if (localteamIds.length > 0) {
      const ratings = await this.admin.readItems<{ id: string }>('ratings_measures', {
        filter: { localteam_id: { _in: localteamIds } },
        fields: ['id'],
        limit: -1,
      }).catch(() => []);
      for (const rating of ratings) await ignore(`rating ${rating.id}`, () => this.admin.deleteItem('ratings_measures', rating.id));
    }

    if (municipalityIds.length > 0) {
      const scores = await this.admin.readItems<{ id: string }>('municipality_scores', {
        filter: { municipality: { _in: municipalityIds } },
        fields: ['id'],
        limit: -1,
      }).catch(() => []);
      for (const score of scores) await ignore(`score ${score.id}`, () => this.admin.deleteItem('municipality_scores', score.id));
      for (const municipality of municipalities) await ignore(
        `municipality ${municipality.id}`,
        () => this.admin.deleteItem('municipalities', municipality.id),
      );
    }

    const users = await this.admin.readUsers<{ id: string; email: string }>({
      filter: { email: { _contains: runId } },
      fields: ['id', 'email'],
      limit: -1,
    }).catch(() => []);
    const userIds = users.map((item) => item.id);

    if (userIds.length > 0 || localteamIds.length > 0) {
      const junctionFilter =
        userIds.length > 0 && localteamIds.length > 0
          ? { _or: [{ directus_users_id: { _in: userIds } }, { localteam_id: { _in: localteamIds } }] }
          : userIds.length > 0
            ? { directus_users_id: { _in: userIds } }
            : { localteam_id: { _in: localteamIds } };
      const junctions = await this.admin.readItems<{ id: string }>('junction_directus_users_localteams', {
        filter: junctionFilter,
        fields: ['id'],
        limit: -1,
      }).catch(() => []);
      for (const junction of junctions) await ignore(
        `user/localteam junction ${junction.id}`,
        () => this.admin.deleteItem('junction_directus_users_localteams', junction.id),
      );
    }

    if (userIds.length > 0) {
      const consentRows = await this.admin.readItems<{ id: number }>('user_consent', {
        filter: { user_id: { _in: userIds } },
        fields: ['id'],
        limit: -1,
      }).catch(() => []);
      for (const consent of consentRows) await ignore(
        `user consent ${consent.id}`,
        () => this.admin.deleteItem('user_consent', consent.id),
      );
    }

    for (const localteam of localteams) {
      await ignore(`localteam admin reset ${localteam.id}`, () => this.admin.updateItem('localteams', localteam.id, { admin_id: null }));
      await ignore(`localteam ${localteam.id}`, () => this.admin.deleteItem('localteams', localteam.id));
    }

    for (const user of users) await ignore(`user ${user.email}`, () => this.admin.deleteUser(user.id));
  }
}
