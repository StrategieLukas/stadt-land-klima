import { assert, assertEqual, assertIncludes, assertNotIncludes } from "../lib/assert.js";
import { DirectusClient } from "../lib/directus.js";
import type { TestFixture } from "../lib/fixture.js";
import type { TestRunner } from "../lib/runner.js";
import type { Browser } from "playwright";
import { loginDirectus, newContext } from "../lib/browser.js";
import { waitFor } from "../lib/wait.js";

interface Role {
  id: string;
  name: string;
}

interface DirectusUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  role: { name?: string } | string;
}

interface InviteResponse {
  mailSent: boolean;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    status: string;
  };
}

interface Dashboard {
  id: string;
  name: string;
}

function roleName(user: DirectusUser): string | undefined {
  return typeof user.role === "object" ? user.role.name : undefined;
}

async function createRoleClient(
  fixture: TestFixture,
  roleNameToCreate: string,
  email: string,
  password: string,
): Promise<DirectusClient> {
  const role = fixture.roles.get(roleNameToCreate) as Role | undefined;
  assert(role, `Required role is missing: ${roleNameToCreate}`);

  const user = await fixture.admin.createUser<DirectusUser>({
    email,
    password,
    role: role.id,
    status: "active",
    first_name: "Automated",
    last_name: roleNameToCreate,
  });

  await fixture.acceptCurrentAgreements([user.id]);
  const client = new DirectusClient(fixture.config.backendUrl);
  await client.login(email, password);
  return client;
}

export async function runErfolgsprojekteInviteDashboardFlow(
  runner: TestRunner,
  fixture: TestFixture,
  browser: Browser,
): Promise<void> {
  const password = "Test-Password-2026!";
  const planningEmail = `automated-planning-${fixture.config.runId}@stadt-land-klima.de`;
  const measuresEmail = `automated-measures-${fixture.config.runId}@stadt-land-klima.de`;
  const invitedEmail = `automated-editorial-invite-${fixture.config.runId}@stadt-land-klima.de`;
  let planningClient: DirectusClient;
  let measuresClient: DirectusClient;

  await runner.step("Erfolgsprojekte dashboard: create restricted test users", async () => {
    planningClient = await createRoleClient(fixture, "Planungsteam", planningEmail, password);
    measuresClient = await createRoleClient(fixture, "Maßnahmenteam", measuresEmail, password);
  });

  await runner.step(
    "CMS dashboards: native panels work with GraphQL blocked and errors never display zero",
    async () => {
      const adminEmail = `automated-dashboard-admin-${fixture.config.runId}@stadt-land-klima.de`;
      await createRoleClient(fixture, "Administrator", adminEmail, password);
      for (const [email, dashboardName] of [
        [adminEmail, "Allgemein"],
        [planningEmail, "Allgemein"],
        [measuresEmail, "Maßnahmen"],
      ]) {
        const dashboards = await fixture.admin.request<Dashboard[]>("GET", "/dashboards", {
          query: { fields: "id,name", filter: JSON.stringify({ name: { _eq: dashboardName } }) },
        });
        const dashboard = dashboards[0];
        assert(dashboard, "Required dashboard exists");
        const context = await newContext(browser);
        let graphqlCalls = 0;
        let denyAggregates = false;
        try {
          await context.route(/\/graphql(?:\/system)?(?:\?|$)/, (route) => {
            graphqlCalls++;
            return route.fulfill({ status: 403, body: "" });
          });
          await context.route(/\/(?:items\/|users(?:\?|$))/, (route) => {
            if (denyAggregates && new URL(route.request().url()).search.includes("aggregate"))
              return route.fulfill({ status: 403, json: { errors: [{ message: "Denied test aggregate" }] } });
            return route.continue();
          });
          const page = await context.newPage();
          await loginDirectus(page, fixture.config.backendUrl, email!, password);
          await page.goto(`${fixture.config.backendUrl}/admin/insights/${dashboard.id}`, {
            waitUntil: "domcontentloaded",
          });
          const panels = page.locator(".slk-rest-panel");
          await panels.first().waitFor();
          await waitFor("REST dashboard panels to finish loading", async () => {
            return (await panels.count()) > 0 && (await panels.locator(".v-progress-circular").count()) === 0;
          });
          assertEqual(graphqlCalls, 0, "Maintained dashboards must not use blocked GraphQL");
          assertEqual(
            await panels.locator(".v-notice[type=danger], .v-notice.danger").count(),
            0,
            "Dashboard reads succeed",
          );
          if (dashboardName === "Allgemein") {
            assertEqual(
              await panels.locator(".metric-text").count(),
              15,
              "All Allgemein metrics render through the native renderer",
            );
            assert(
              (await panels.locator(".metric-text").allTextContents()).some((value) => Number(value.trim()) > 0),
              "Dashboard must show nonzero fixture counts",
            );
            if (email === adminEmail) {
              const first = panels.first();
              denyAggregates = true;
              await first.getByRole("button", { name: "Aktualisieren" }).click();
              await first.getByText("Daten konnten nicht geladen werden.", { exact: true }).waitFor();
              assertEqual(
                await first.locator(".metric-text").count(),
                0,
                "Permission failures cannot masquerade as zero",
              );
              denyAggregates = false;
              await first.getByRole("button", { name: "Aktualisieren" }).click();
              await first.locator(".metric-text").waitFor();
            }
          }
        } finally {
          await context.close();
        }
      }
    },
  );

  await runner.step("Erfolgsprojekte dashboard: only planning team sees the invitation dashboard", async () => {
    const planningDashboards = await planningClient.request<Dashboard[]>("GET", "/dashboards", {
      query: { fields: "id,name", limit: -1 },
    });
    const measuresDashboards = await measuresClient.request<Dashboard[]>("GET", "/dashboards", {
      query: { fields: "id,name", limit: -1 },
    });
    const planningNames = planningDashboards.map((dashboard) => dashboard.name).join(", ");
    const measuresNames = measuresDashboards.map((dashboard) => dashboard.name).join(", ");

    assertIncludes(planningNames, "Erfolgsprojekte-Redaktion", "Planungsteam must see the invitation dashboard");
    assertNotIncludes(
      measuresNames,
      "Erfolgsprojekte-Redaktion",
      "Maßnahmenteam must not see the invitation dashboard",
    );
    assertIncludes(measuresNames, "Maßnahmen", "Maßnahmenteam must retain its own dashboard");
  });

  await runner.step("CMS dashboards: admin and planning can read Allgemein and every metric", async () => {
    for (const client of [fixture.admin, planningClient]) {
      const dashboards = await client.request<
        Array<Dashboard & { panels: Array<{ type: string; options: Record<string, unknown> }> }>
      >("GET", "/dashboards", {
        query: { fields: "id,name,panels.type,panels.options", filter: JSON.stringify({ name: { _eq: "Allgemein" } }) },
      });
      const dashboard = dashboards[0];
      assert(dashboard, "Allgemein must be accessible");
      assert(dashboard.panels.length > 0, "Allgemein panels must be accessible");
      for (const panel of dashboard.panels) {
        if (panel.type !== "slk-rest-metric") continue;
        const options = panel.options;
        const collection = String(options.collection);
        const path = collection === "directus_users" ? "/users" : `/items/${collection}`;
        await client.request("GET", path, {
          query: {
            [`aggregate[${String(options.function)}]`]: String(options.field),
            filter: JSON.stringify(options.filter).replaceAll("{{ inactivity_cutoff }}", "2025-01-01T00:00:00Z"),
          },
        });
      }
    }
    const dashboards = await measuresClient.request<Dashboard[]>("GET", "/dashboards", {
      query: { fields: "id,name", limit: -1 },
    });
    assert(
      !dashboards.some((dashboard) => dashboard.name === "Allgemein"),
      "Maßnahmenteam cannot access personal-data dashboards",
    );
    const panels = await measuresClient.request<Array<{ dashboard: { name: string } }>>("GET", "/panels", {
      query: { fields: "dashboard.name", limit: -1 },
    });
    assert(panels.length > 0, "Maßnahmen panels must be readable");
    assert(
      panels.every((panel) => panel.dashboard.name === "Maßnahmen"),
      "Only Maßnahmen panels may be exposed",
    );
  });

  await runner.step("Maßnahmenteam: reads drafts and archived catalogues without personal data or writes", async () => {
    const catalog = await fixture.admin.createItem<{ id: string }>("measure_catalog", {
      name: `Automated private catalog ${fixture.config.runId}`,
      hidden: true,
      isCurrentBackend: false,
      isCurrentFrontend: false,
    });
    let measureId: string | undefined;
    let ratingId: string | undefined;
    try {
      const measure = await fixture.admin.createItem<{ id: string }>("measures", {
        name: "Automated draft measure",
        measure_id: "TEST_01",
        sector: "energy",
        status: "draft",
        catalog_version: catalog.id,
        notes: "Private editorial note",
        choices_rating: "4",
        description_about: "Automated test",
        description_evaluation_criteria: "Automated test",
        description_verification: "Automated test",
      });
      measureId = measure.id;
      const rating = await fixture.admin.createItem<{ id: string }>("ratings_measures", {
        measure_id: measure.id,
        localteam_id: fixture.localteam.id,
        status: "draft",
        measure_published: false,
        internal_note: "Private team note",
        applicable: true,
        source: "Automated test",
        approved: false,
        current_progress: 0,
        choices: "4",
      });
      ratingId = rating.id;
      for (const [collection, id, fields] of [
        ["measure_catalog", catalog.id, ["id", "name", "hidden"]],
        ["measures", measure.id, ["id", "name", "status", "catalog_version.name"]],
        ["ratings_measures", rating.id, ["id", "status", "measure_id.name", "localteam_id.name"]],
      ] as const) {
        const item = await measuresClient.readItem<{ id: string }>(collection, id, [...fields]);
        assertEqual(item.id, id, "Draft and archived data must remain readable");
        for (const method of ["PATCH", "DELETE", "POST"]) {
          let denied = false;
          try {
            await measuresClient.request(method, `/items/${collection}${method === "POST" ? "" : `/${id}`}`, {
              body: method === "DELETE" ? undefined : { name: "Forbidden write" },
            });
          } catch (error) {
            denied = error instanceof Error && error.message.includes("403");
          }
          assert(denied, `Maßnahmenteam must not ${method} ${collection}`);
        }
      }
      for (const [collection, field] of [
        ["measures", "user_created"],
        ["measures", "user_updated"],
        ["measures", "notes"],
        ["ratings_measures", "user_created"],
        ["ratings_measures", "internal_note"],
        ["localteams", "admin_id"],
        ["localteams", "internal_comment"],
        ["municipalities", "preview_token"],
        ["municipalities", "public_contact"],
      ]) {
        let denied = false;
        try {
          await measuresClient.readItems(collection!, { fields: [field!], limit: 1 });
        } catch (error) {
          denied = error instanceof Error && error.message.includes("403");
        }
        assert(denied, `Personal/private field ${collection}.${field} must be forbidden`);
      }
      const foreignUsers = await measuresClient.readUsers<{ id: string }>({
        filter: { email: { _eq: planningEmail } },
        fields: ["id", "email"],
      });
      assertEqual(foreignUsers.length, 0, "Other users' personal data must not be readable");
    } finally {
      if (ratingId) await fixture.admin.deleteItem("ratings_measures", ratingId);
      if (measureId) await fixture.admin.deleteItem("measures", measureId);
      await fixture.admin.deleteItem("measure_catalog", catalog.id);
    }
  });
  await runner.step("Erfolgsprojekte dashboard: unauthorized users cannot invite editors", async () => {
    let failure = "";
    try {
      await fixture.localteamAdmin.client.request("POST", "/erfolgsprojekte-users/invite", {
        body: {
          email: invitedEmail,
          first_name: "Erika",
          last_name: "Redaktion",
        },
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    assertIncludes(failure, "403", "Unauthorized invitation must return HTTP 403");
  });

  await runner.step("Erfolgsprojekte dashboard: planning team invites an editorial user", async () => {
    const response = await planningClient.request<InviteResponse>("POST", "/erfolgsprojekte-users/invite", {
      body: {
        email: invitedEmail,
        first_name: "Erika",
        last_name: "Redaktion",
      },
    });

    assertEqual(response.user.email, invitedEmail, "Invitation response must preserve the email");
    assertEqual(response.user.role, "ErfolgsprojekteRedaktion", "Invitation response must expose the assigned role");
    assertEqual(response.user.status, "invited", "Invitation response must expose invited status");

    const users = await fixture.admin.readUsers<DirectusUser>({
      filter: { email: { _eq: invitedEmail } },
      fields: ["id", "email", "first_name", "last_name", "status", "role.name"],
      limit: 1,
    });
    const invitedUser = users[0];
    assert(invitedUser, "Invited editorial user must exist");
    assertEqual(invitedUser.first_name, "Erika", "Invited user must retain the first name");
    assertEqual(invitedUser.last_name, "Redaktion", "Invited user must retain the last name");
    assertEqual(invitedUser.status, "invited", "Invited user must have invited status");
    assertEqual(
      roleName(invitedUser),
      "ErfolgsprojekteRedaktion",
      "Invited user must receive the ErfolgsprojekteRedaktion role",
    );
  });

  runner.addManualCheck(
    "erfolgsprojekte_invite_dashboard",
    `Verify an invitation email to ${invitedEmail} with subject "Einladung zur Erfolgsprojekte-Redaktion" and an accept-invite link for ${fixture.config.backendUrl}.`,
  );
}
