import { randomBytes } from 'node:crypto';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const hmacKey: string = (config.altchaSecret as string) || 'dev-secret-change-in-production';

  const body = await readBody(event);
  const { firstName, lastName, email, organisation, ars, municipalityName, population, state, geolocation, altcha } = body ?? {};

  // Validate required fields
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !ars?.trim() || !municipalityName?.trim()) {
    throw createError({ statusCode: 400, message: 'Bitte alle Pflichtfelder ausfüllen.' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw createError({ statusCode: 400, message: 'Ungültige E-Mail-Adresse.' });
  }

  // Verify CAPTCHA
  if (!altcha || !verifyAltcha(altcha, hmacKey)) {
    throw createError({ statusCode: 400, message: 'CAPTCHA-Überprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.' });
  }

  const directusUrl = (config.directusServerUrl as string) || 'http://directus:8055';
  const adminToken = config.directusAdminToken as string | undefined;

  if (!adminToken) {
    console.error('[register-municipality] DIRECTUS_ADMIN_TOKEN not configured');
    throw createError({ statusCode: 503, message: 'Registrierung ist momentan nicht verfügbar. Bitte versuche es später erneut.' });
  }

  const headers = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  const steps = { user: false, team: false, email: false, notify: false, welcome: false };

  // --- Pre-check: reject if ARS already has a localteam ---
  try {
    const arsCheck = await $fetch<{ data: Array<{ id: string }> }>(
      `${directusUrl}/items/municipalities`,
      { headers, params: { 'filter[ars][_eq]': ars.trim(), 'filter[localteam_id][_nnull]': true, 'fields[]': 'id', limit: 1 } },
    );
    if (arsCheck.data?.length > 0) {
      throw createError({
        statusCode: 422,
        message: 'Für diese Gemeinde existiert bereits ein Lokalteam. Bitte wende dich an info@stadt-land-klima.de, wenn du mitarbeiten möchtest.',
        data: { steps },
      });
    }
  } catch (err: any) {
    if (err.statusCode === 422) throw err;
    // Non-fatal: proceed with registration if the check itself fails
    console.warn('[register-municipality] ARS duplicate check failed (non-fatal):', err);
  }

  // --- Step 1: Create Directus user ---
  const LOKALTEAM_ADMIN_ROLE = await getLokalteamAdminRoleId();
  let userId: string;
  try {
    const userResult = await $fetch<{ data: { id: string } }>(`${directusUrl}/users`, {
      method: 'POST',
      headers,
      body: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        title: organisation?.trim() ?? '',
        description: `ARS: ${ars.trim()}`,
        role: LOKALTEAM_ADMIN_ROLE,
        status: 'active',
        verified: false,
      },
    });
    userId = userResult.data.id;
    steps.user = true;
  } catch (err: any) {
    const isUnique = err?.data?.errors?.[0]?.extensions?.code === 'RECORD_NOT_UNIQUE';
    throw createError({
      statusCode: 422,
      message: isUnique
        ? 'Ein Account mit dieser E-Mail-Adresse existiert bereits. Bitte logge dich ein oder verwende die Passwort-vergessen-Funktion.'
        : 'Account konnte nicht erstellt werden. Bitte versuche es später erneut.',
      data: { steps },
    });
  }

  // --- Step 2: Create Lokalteam ---
  let localteamId: string;
  try {
    const teamResult = await $fetch<{ data: { id: string } }>(`${directusUrl}/items/localteams`, {
      method: 'POST',
      headers,
      body: {
        name: `Stadt.Land.Klima! ${municipalityName.trim()}`,
        municipality_name: municipalityName.trim(),
        admin_id: userId,
        status: 'draft',
      },
    });
    localteamId = teamResult.data.id;
    steps.team = true;
  } catch (err: any) {
    throw createError({
      statusCode: 422,
      message: 'Lokalteam konnte nicht angelegt werden. Bitte versuche es später erneut.',
      data: { steps },
    });
  }

  // --- Step 2b: Link user to localteam via M2M junction ---
  // AdminLokalteam permissions use $CURRENT_USER.localteams.localteam_id (M2M traversal),
  // so without this junction row the user has no access to their localteam or municipality.
  try {
    await $fetch(`${directusUrl}/items/junction_directus_users_localteams`, {
      method: 'POST',
      headers,
      body: {
        directus_users_id: userId,
        localteam_id: localteamId,
      },
    });
  } catch (err) {
    // Non-fatal: log clearly but don't block — user + team are created
    console.error('[register-municipality] Failed to create M2M junction entry (user will lack permissions):', err);
  }

  // --- Step 3: Update municipality (best-effort, non-fatal) ---
  // The Directus 'createMunicipality' flow creates the municipality record asynchronously
  // when the localteam is created. It sets localteam_id but NOT ars/population/state.
  // We retry the lookup by localteam_id to give the flow time to run.
  const previewToken = randomBytes(24).toString('hex');
  let municipalitySlug: string | undefined;
  try {
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    let municipalityId: string | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await sleep(2000);
      const muniSearch = await $fetch<{ data: Array<{ id: string; slug?: string }> }>(
        `${directusUrl}/items/municipalities`,
        { headers, params: { 'filter[localteam_id][_eq]': localteamId, 'fields[]': ['id', 'slug'], limit: 1 } },
      );
      municipalityId = muniSearch.data?.[0]?.id;
      municipalitySlug = muniSearch.data?.[0]?.slug ?? undefined;
      if (municipalityId) break;
    }
    if (municipalityId) {
      await $fetch(`${directusUrl}/items/municipalities/${municipalityId}`, {
        method: 'PATCH',
        headers,
        body: {
          ars: ars.trim(),
          creator_verified: false,
          preview_token: previewToken,
          ...(population != null ? { population: Number(population) } : {}),
          ...(state ? { state: state.trim() } : {}),
          ...(geolocation ? { geolocation } : {}),
        },
      });
    } else {
      console.warn('[register-municipality] Municipality not found after retries for localteam:', localteamId);
    }
  } catch (err) {
    // Non-fatal: team + user already created; log and continue
    console.warn('[register-municipality] Municipality update failed (non-fatal):', err);
  }

  // --- Step 4: Send password-reset email ---
  try {
    await $fetch(`${directusUrl}/auth/password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: email.trim() },
    });
    steps.email = true;
  } catch (err) {
    // Non-fatal: user + team are created; they can request the email again
    console.warn('[register-municipality] Password reset email failed (non-fatal):', err);
  }

  const appPublicUrl = (config.appPublicUrl as string) || 'https://stadt-land-klima.de';
  const directusPublicUrl = (config.directusPublicUrl as string) || 'https://stadt-land-klima.de/backend';
  const previewUrl = municipalitySlug
    ? `${appPublicUrl}/municipalities/${municipalitySlug}?preview=${previewToken}`
    : null;

  const notifyAdminFlowUrl = config.directusFlowNotifyAdmin as string | undefined;
  const welcomeEmailFlowUrl = config.directusFlowWelcomeEmail as string | undefined;

  // --- Step 5: Notify admin ---
  const adminEmail = (config.adminNotificationEmail as string) || 'info@stadt-land-klima.de';
  if (!notifyAdminFlowUrl) {
    console.warn('[register-municipality] DIRECTUS_FLOW_NOTIFY_ADMIN not configured — skipping admin notification');
  } else {
    try {
      await $fetch(notifyAdminFlowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          to: adminEmail,
          subject: `Neues Lokalteam registriert: ${municipalityName.trim()}`,
          body: [
            `<p>Ein neues Lokalteam hat sich registriert:</p>`,
            `<ul>`,
            `<li><strong>Name:</strong> ${firstName.trim()} ${lastName.trim()}</li>`,
            `<li><strong>E-Mail:</strong> ${email.trim()}</li>`,
            `<li><strong>Organisation:</strong> ${organisation?.trim() ?? '—'}</li>`,
            `<li><strong>Gemeinde:</strong> ${municipalityName.trim()} (ARS: ${ars.trim()})</li>`,
            `</ul>`,
            `<p><a href="${directusPublicUrl}/admin/users/${userId}">Account in Directus öffnen und verifizieren →</a></p>`,
            previewUrl ? `<p><a href="${previewUrl}">Vorschau der Gemeinde-Seite →</a></p>` : '',
          ].join('\n'),
        },
      });
      steps.notify = true;
    } catch (err) {
      console.warn('[register-municipality] Admin notification email failed (non-fatal):', err);
    }
  }

  // --- Step 6: Send welcome email to new user ---
  if (!welcomeEmailFlowUrl) {
    console.warn('[register-municipality] DIRECTUS_FLOW_WELCOME_EMAIL not configured — skipping welcome email');
  } else {
    try {
      const tutorialUrl = (config.welcomeEmailTutorialUrl as string) || '';
      const calendarUrl = (config.welcomeEmailCalendarUrl as string) || '';
      const signalUrl = (config.welcomeEmailSignalUrl as string) || '';
      await $fetch(welcomeEmailFlowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          to: email.trim(),
          subject: `Willkommen bei Stadt.Land.Klima! – Dein Lokalteam für ${municipalityName.trim()} ist eingerichtet`,
          template: 'email-template-welcome-new-localteam',
          data: {
            firstName: firstName.trim(),
            municipalityName: municipalityName.trim(),
            tutorialUrl,
            calendarUrl,
            signalUrl,
            backendUrl: directusPublicUrl,
          },
        },
      });
      steps.welcome = true;
    } catch (err) {
      console.warn('[register-municipality] Welcome email failed (non-fatal):', err);
    }
  }

  return { success: true, steps };
});
