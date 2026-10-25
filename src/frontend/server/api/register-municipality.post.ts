import type { H3Event } from "h3";
import { requestLog, requestFailure } from "../utils/securityLogging";
import { abuseProtection } from "../utils/abuseProtection";
import { directusErrorDetails, requestErrorStatus } from "~/shared/requestError";
import { RegistrationRequestSchema } from "~/shared/contracts/submissions";
import { randomBytes } from "node:crypto";
import { sendDirectusMailFlow } from "../utils/sendDirectusMailFlow";
import { verifyAltcha } from "../utils/verifyAltcha";
import { verifyMathChallenge } from "../utils/verifyMathChallenge";
import { rateLimit } from "../utils/rateLimit";

type RegistrationStepKey = "user" | "team" | "email";
type RegistrationSteps = Record<RegistrationStepKey, boolean> & {
  notify: boolean;
  welcome: boolean;
};
type DirectusRoleValue = string | { id?: string | null } | null | undefined;

function roleId(value: DirectusRoleValue): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

async function ensureUserRole(
  directusUrl: string,
  headers: Record<string, string>,
  userId: string,
  expectedRoleId: string,
): Promise<void> {
  const readRoleId = async (): Promise<string | null> => {
    const result = await $fetch<{ data?: { role?: DirectusRoleValue } }>(`${directusUrl}/users/${userId}`, {
      headers,
      params: { "fields[]": ["id", "role"] },
    });
    return roleId(result.data?.role);
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await readRoleId()) === expectedRoleId) return;

    await $fetch(`${directusUrl}/users/${userId}`, {
      method: "PATCH",
      headers,
      body: { role: expectedRoleId },
    });

    if ((await readRoleId()) === expectedRoleId) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  throw new Error(`Directus did not persist role ${expectedRoleId} for user ${userId}`);
}

async function deleteUserAfterFailedRegistration(
  event: H3Event,
  directusUrl: string,
  headers: Record<string, string>,
  userId: string | null,
): Promise<void> {
  if (!userId) return;

  try {
    await $fetch(`${directusUrl}/users/${userId}`, { method: "DELETE", headers });
    requestLog(event, "info", "nuxt.registration.user_removed", {
      resource: "directus_users",
      resourceId: userId,
      outcome: "success",
    });
  } catch {
    requestLog(event, "error", "nuxt.registration.user_cleanup_failed", {
      resource: "directus_users",
      resourceId: userId,
    });
  }
}

async function deleteLocalteamAfterFailedRegistration(
  event: H3Event,
  directusUrl: string,
  headers: Record<string, string>,
  localteamId: string,
): Promise<void> {
  try {
    const junctions = await $fetch<{ data?: Array<{ id: string }> }>(
      `${directusUrl}/items/junction_directus_users_localteams`,
      {
        headers,
        params: {
          "filter[localteam_id][_eq]": localteamId,
          "fields[]": "id",
          limit: -1,
        },
      },
    );
    for (const junction of junctions.data ?? []) {
      await $fetch(`${directusUrl}/items/junction_directus_users_localteams/${junction.id}`, {
        method: "DELETE",
        headers,
      });
    }
  } catch {
    requestLog(event, "error", "nuxt.registration.links_cleanup_failed", {
      resource: "localteams",
      resourceId: localteamId,
    });
  }

  try {
    await $fetch(`${directusUrl}/items/localteams/${localteamId}`, { method: "DELETE", headers });
    requestLog(event, "info", "nuxt.registration.team_removed", {
      resource: "localteams",
      resourceId: localteamId,
      outcome: "success",
    });
  } catch {
    requestLog(event, "error", "nuxt.registration.team_cleanup_failed", {
      resource: "localteams",
      resourceId: localteamId,
    });
  }
}

async function ensureLocalteamUserJunction(
  directusUrl: string,
  headers: Record<string, string>,
  userId: string,
  localteamId: string,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await $fetch(`${directusUrl}/items/junction_directus_users_localteams`, {
        method: "POST",
        headers,
        body: {
          directus_users_id: userId,
          localteam_id: localteamId,
        },
      });
    } catch (error) {
      lastError = error;
    }

    try {
      const junctions = await $fetch<{ data?: Array<{ id: string }> }>(
        `${directusUrl}/items/junction_directus_users_localteams`,
        {
          headers,
          params: {
            "filter[directus_users_id][_eq]": userId,
            "filter[localteam_id][_eq]": localteamId,
            "fields[]": "id",
            limit: 1,
          },
        },
      );
      if (junctions.data?.length) return;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 2) {
      await new Promise<void>((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Directus did not persist the user/localteam junction");
}

function registrationErrorData(steps: RegistrationSteps, failedStep?: RegistrationStepKey, errorKey?: string) {
  return {
    steps,
    ...(failedStep ? { failedStep } : {}),
    ...(errorKey ? { errorKey } : {}),
  };
}

function registrationStatusMessage(statusCode: number) {
  if (statusCode === 400) return "Bad Request";
  if (statusCode === 422) return "Registration Failed";
  if (statusCode === 503) return "Service Unavailable";
  return "Registration Error";
}

function createRegistrationError(statusCode: number, message: string, data?: ReturnType<typeof registrationErrorData>) {
  return createError({
    statusCode,
    statusMessage: registrationStatusMessage(statusCode),
    message,
    ...(data ? { data } : {}),
  });
}

function isDuplicateEmailError(err: unknown): boolean {
  return directusErrorDetails(err).some((directusError) => {
    const code = directusError.code.toUpperCase();
    const message = directusError.message.toLowerCase();

    return (
      ["RECORD_NOT_UNIQUE", "INVALID_UNIQUE", "UNIQUE_CONSTRAINT"].includes(code) ||
      (message.includes("email") &&
        (message.includes("exist") || message.includes("unique") || message.includes("duplicate")))
    );
  });
}

function duplicateEmailRegistrationError(steps: RegistrationSteps) {
  return createRegistrationError(
    422,
    "Für diese E-Mail-Adresse existiert bereits ein Account. Wenn du mehrere Kommunen bewerten möchtest, melde dich bitte mit einer separaten E-Mail-Adresse an.",
    registrationErrorData(steps, "user", "localteam.register.error.email_registered"),
  );
}

export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, "register"))) {
    throw createError({ statusCode: 429, message: "Zu viele Anfragen. Bitte versuche es später erneut." });
  }
  const config = useRuntimeConfig();
  const { hmacKey, devMode } = abuseProtection();

  const parsedBody = RegistrationRequestSchema.safeParse(await readRequestBody(event));
  if (!parsedBody.success)
    throw createError({ statusCode: 400, message: "Ungültige Eingaben. Bitte prüfe das Formular." });
  const body = parsedBody.data;
  const {
    firstName,
    lastName,
    email,
    organisation,
    ars,
    municipalityName,
    population,
    state,
    geolocation,
    altcha,
    mathChallenge,
  } = body ?? {};
  const steps: RegistrationSteps = { user: false, team: false, email: false, notify: false, welcome: false };

  // Validate required fields
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !ars?.trim() || !municipalityName?.trim()) {
    throw createRegistrationError(400, "Bitte alle Pflichtfelder ausfüllen.");
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw createRegistrationError(400, "Ungültige E-Mail-Adresse.");
  }

  // Verify CAPTCHA
  if (!mathChallenge || !verifyMathChallenge(mathChallenge.token, mathChallenge.answer, hmacKey, "register", devMode)) {
    throw createRegistrationError(400, "Rechenprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.");
  }

  if (!altcha || !(await verifyAltcha(altcha, hmacKey, { devMode, purpose: "register" }))) {
    throw createRegistrationError(
      400,
      "CAPTCHA-Überprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.",
    );
  }

  const directusUrl = config.directusServerUrl || "http://directus:8055";
  const adminToken = config.directusAdminToken as string | undefined;

  if (!adminToken) {
    requestLog(event, "error", "app.server.api.register-municipality.post.failed");
    throw createRegistrationError(
      503,
      "Registrierung ist momentan nicht verfügbar. Bitte versuche es später erneut.",
      registrationErrorData(steps, undefined, "generic.technical_error"),
    );
  }

  const headers = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };

  // Give users a useful error before Directus returns a generic server error.
  try {
    const existingUsers = await $fetch<{ data: Array<{ id: string; email?: string | null }> }>(`${directusUrl}/users`, {
      headers,
      params: {
        "filter[email][_icontains]": email.trim(),
        "fields[]": ["id", "email"],
        limit: 20,
      },
    });

    const normalizedEmail = email.trim().toLocaleLowerCase();
    const emailAlreadyExists = existingUsers.data?.some(
      (user) => (user.email ?? "").trim().toLocaleLowerCase() === normalizedEmail,
    );

    if (emailAlreadyExists) {
      throw duplicateEmailRegistrationError(steps);
    }
  } catch (err: unknown) {
    if (requestErrorStatus(err) === 422) throw err;
    // Non-fatal: the unique constraint below remains the final safeguard.
    requestLog(event, "warn", "nuxt.registration.duplicate_user_check_unavailable");
  }

  // --- Pre-check: reject if ARS already has a localteam ---
  try {
    const arsCheck = await $fetch<{ data: Array<{ id: string }> }>(`${directusUrl}/items/municipalities`, {
      headers,
      params: { "filter[ars][_eq]": ars.trim(), "filter[localteam_id][_nnull]": true, "fields[]": "id", limit: 1 },
    });
    if (arsCheck.data?.length > 0) {
      throw createRegistrationError(
        422,
        "Für diese Gemeinde existiert bereits ein Lokalteam oder eine noch nicht veröffentlichte Registrierung. Bitte wende dich an info@stadt-land-klima.de, wenn du mitarbeiten möchtest.",
        registrationErrorData(steps, undefined, "localteam.register.error.municipality_already_registered"),
      );
    }
  } catch (err: unknown) {
    if (requestErrorStatus(err) === 422) throw err;
    // Non-fatal: proceed with registration if the check itself fails
    requestLog(event, "warn", "nuxt.registration.duplicate_team_check_unavailable");
  }

  // --- Step 1: Create Directus user ---
  let LOKALTEAM_ADMIN_ROLE: string;
  try {
    LOKALTEAM_ADMIN_ROLE = await getLokalteamAdminRoleId();
  } catch (err) {
    requestFailure(event, "app.server.api.register-municipality.post.failed", err);
    throw createRegistrationError(
      503,
      "Registrierung ist momentan nicht verfügbar. Bitte versuche es später erneut.",
      registrationErrorData(steps, undefined, "generic.technical_error"),
    );
  }

  let userId: string | null = null;
  try {
    const userResult = await $fetch<{ data: { id: string } }>(`${directusUrl}/users`, {
      method: "POST",
      headers,
      body: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        title: organisation?.trim() ?? "",
        description: `ARS: ${ars.trim()}`,
        role: LOKALTEAM_ADMIN_ROLE,
        status: "active",
        verified: false,
      },
    });
    userId = userResult.data.id;
    await ensureUserRole(directusUrl, headers, userId, LOKALTEAM_ADMIN_ROLE);
    steps.user = true;
    requestLog(event, "info", "nuxt.registration.user_created", {
      resource: "directus_users",
      resourceId: userId,
      outcome: "success",
    });
  } catch (err: unknown) {
    await deleteUserAfterFailedRegistration(event, directusUrl, headers, userId);
    const isUnique = isDuplicateEmailError(err);
    requestLog(event, isUnique ? "info" : "error", "nuxt.registration.user_creation_failed", {
      outcome: isUnique ? "rejected" : "failed",
    });
    throw createRegistrationError(
      422,
      isUnique
        ? "Ein Account mit dieser E-Mail-Adresse existiert bereits. Bitte logge dich ein oder verwende die Passwort-vergessen-Funktion."
        : "Account konnte nicht erstellt werden. Bitte versuche es später erneut.",
      registrationErrorData(
        steps,
        "user",
        isUnique ? "localteam.register.error.email_registered" : "localteam.register.error.account_create_failed",
      ),
    );
  }

  // --- Step 2: Create Lokalteam ---
  let localteamId: string;
  try {
    const teamResult = await $fetch<{ data: { id: string } }>(`${directusUrl}/items/localteams`, {
      method: "POST",
      headers,
      body: {
        name: `Stadt.Land.Klima! ${municipalityName.trim()}`,
        municipality_name: municipalityName.trim(),
        admin_id: userId,
        status: "draft",
      },
    });
    localteamId = teamResult.data.id;
  } catch {
    requestLog(event, "error", "nuxt.registration.team_creation_failed", { outcome: "failed" });
    await deleteUserAfterFailedRegistration(event, directusUrl, headers, userId);
    throw createRegistrationError(
      422,
      "Lokalteam konnte nicht angelegt werden. Bitte versuche es später erneut.",
      registrationErrorData(steps, "team", "localteam.register.error.localteam_create_failed"),
    );
  }

  // --- Step 2b: Link user to localteam via M2M junction ---
  // AdminLokalteam permissions use $CURRENT_USER.localteams.localteam_id (M2M traversal),
  // so without this junction row the user has no access to their localteam or municipality.
  try {
    await ensureLocalteamUserJunction(directusUrl, headers, userId, localteamId);
    steps.team = true;
    requestLog(event, "info", "nuxt.registration.team_created", {
      resource: "localteams",
      resourceId: localteamId,
      outcome: "success",
    });
  } catch (err) {
    requestFailure(event, "app.server.api.register-municipality.post.failed", err);
    await deleteLocalteamAfterFailedRegistration(event, directusUrl, headers, localteamId);
    await deleteUserAfterFailedRegistration(event, directusUrl, headers, userId);
    throw createRegistrationError(
      503,
      "Registrierung ist momentan nicht verfügbar. Bitte versuche es später erneut.",
      registrationErrorData(steps, "team", "localteam.register.error.localteam_create_failed"),
    );
  }

  // --- Step 3: Update municipality (best-effort, non-fatal) ---
  // The Directus 'createMunicipality' flow creates the municipality record asynchronously
  // when the localteam is created. It sets localteam_id but NOT ars/population/state.
  // We retry the lookup by localteam_id to give the flow time to run.
  const previewToken = randomBytes(24).toString("hex");
  let municipalitySlug: string | undefined;
  try {
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    let municipalityId: string | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await sleep(2000);
      const muniSearch = await $fetch<{ data: Array<{ id: string; slug?: string }> }>(
        `${directusUrl}/items/municipalities`,
        { headers, params: { "filter[localteam_id][_eq]": localteamId, "fields[]": ["id", "slug"], limit: 1 } },
      );
      municipalityId = muniSearch.data?.[0]?.id;
      municipalitySlug = muniSearch.data?.[0]?.slug ?? undefined;
      if (municipalityId) break;
    }
    if (municipalityId) {
      await $fetch(`${directusUrl}/items/municipalities/${municipalityId}`, {
        method: "PATCH",
        headers,
        body: {
          ars: ars.trim(),
          preview_token: previewToken,
          ...(population != null ? { population: population } : {}),
          ...(state ? { state: state.trim() } : {}),
          ...(geolocation ? { geolocation } : {}),
        },
      });
    } else {
      requestLog(event, "warn", "nuxt.registration.municipality_not_ready");
    }
  } catch {
    // Non-fatal: team + user already created; log and continue
    requestLog(event, "warn", "nuxt.registration.municipality_update_failed");
  }

  // --- Step 4: Obtain password-reset URL (will be embedded in the welcome email) ---
  // We call our custom endpoint which generates the token without sending a separate email,
  // so the user receives exactly one email (the welcome email) with the reset link inside.
  let passwordResetUrl: string | null = null;
  try {
    const resetData = await $fetch<{ url: string }>(`${directusUrl}/generate-reset-link`, {
      method: "POST",
      headers: { ...headers },
      body: { email: email.trim() },
    });
    passwordResetUrl = resetData.url ?? null;
    steps.email = true;
  } catch {
    // Non-fatal: fall back to sending a separate Directus password-reset email
    requestLog(event, "warn", "nuxt.registration.reset_link_fallback");
    try {
      await $fetch(`${directusUrl}/auth/password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { email: email.trim() },
      });
      steps.email = true;
    } catch {
      requestLog(event, "error", "nuxt.registration.reset_mail_failed");
    }
  }

  const appPublicUrl = config.appPublicUrl || "https://stadt-land-klima.de";
  const directusPublicUrl = config.directusPublicUrl || "https://stadt-land-klima.de/backend";
  const previewUrl = municipalitySlug
    ? `${appPublicUrl}/municipalities/${municipalitySlug}?preview=${previewToken}`
    : null;

  const notifyAdminFlowUrl = config.directusFlowNotifyAdmin as string | undefined;
  const welcomeEmailFlowUrl = config.directusFlowWelcomeEmail as string | undefined;

  // --- Step 5: Notify admin ---
  const adminEmail = config.adminNotificationEmail || "info@stadt-land-klima.de";
  if (!notifyAdminFlowUrl) {
    requestLog(event, "warn", "nuxt.registration.admin_mail_not_configured");
  } else {
    try {
      await sendDirectusMailFlow(notifyAdminFlowUrl, directusUrl, adminToken, {
        to: adminEmail,
        subject: `Neues Lokalteam registriert: ${municipalityName.trim()}`,
        body: [
          `<p>Ein neues Lokalteam hat sich registriert:</p>`,
          `<ul>`,
          `<li><strong>Name:</strong> ${firstName.trim()} ${lastName.trim()}</li>`,
          `<li><strong>E-Mail:</strong> ${email.trim()}</li>`,
          `<li><strong>Organisation:</strong> ${organisation?.trim() ?? "—"}</li>`,
          `<li><strong>Gemeinde:</strong> ${municipalityName.trim()} (ARS: ${ars.trim()})</li>`,
          `</ul>`,
          `<p><a href="${directusPublicUrl}/admin/users/${userId}">Account in Directus öffnen und verifizieren →</a></p>`,
          previewUrl ? `<p><a href="${previewUrl}">Vorschau der Gemeinde-Seite →</a></p>` : "",
        ].join("\n"),
      });
      steps.notify = true;
      requestLog(event, "info", "nuxt.registration.admin_mail_sent", { resourceId: localteamId, outcome: "success" });
    } catch {
      requestLog(event, "error", "nuxt.registration.admin_mail_failed");
    }
  }

  // --- Step 6: Send welcome email to new user ---
  if (!welcomeEmailFlowUrl) {
    requestLog(event, "error", "nuxt.registration.welcome_mail_not_configured");
  } else {
    try {
      const tutorialUrl = config.welcomeEmailTutorialUrl || "";
      const calendarUrl = config.welcomeEmailCalendarUrl || "";
      const signalUrl = config.welcomeEmailSignalUrl || "";
      await sendDirectusMailFlow(welcomeEmailFlowUrl, directusUrl, adminToken, {
        to: email.trim(),
        subject: `Willkommen bei Stadt.Land.Klima! – Dein Lokalteam für ${municipalityName.trim()} ist eingerichtet`,
        // Retained for deployments that update Nuxt before importing the protected flow.
        template: "email-template-welcome-new-localteam",
        data: {
          firstName: firstName.trim(),
          municipalityName: municipalityName.trim(),
          passwordResetUrl,
          tutorialUrl,
          calendarUrl,
          signalUrl,
          backendUrl: directusPublicUrl,
        },
      });
      steps.welcome = true;
      requestLog(event, "info", "nuxt.registration.welcome_mail_sent", { resourceId: userId, outcome: "success" });
    } catch {
      requestLog(event, "error", "nuxt.registration.welcome_mail_failed");
    }
  }

  requestLog(event, "info", "nuxt.registration.completed", {
    resource: "localteams",
    resourceId: localteamId,
    outcome: "success",
  });
  return { success: true, steps };
});
