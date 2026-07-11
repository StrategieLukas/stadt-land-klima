# Initialise

1. Create a disposable LokalteamAdmin user and the associated Lokalteam `AutomatedTest <runId>`.
2. Add the user to that localteam through `junction_directus_users_localteams`.
3. Set the localteam `admin_id` to the LokalteamAdmin user.
4. Create a second disposable localteam that is not assigned to the user, so backend visibility can prove the permission restriction.

# Backend visibility

1. Log in to the Directus app as the LokalteamAdmin user.
2. Open `/admin/content/localteams`.
3. Verify the rendered HTML contains the assigned localteam.
4. Verify the rendered HTML does not contain the unrelated localteam.
5. Verify the user API also returns exactly one localteam, matching the Directus app view.

# Invite

1. Open `/admin/content/editors/+` in the Directus app.
2. Verify the rendered form exposes `Email`, `Lokalteam`, `Organisation`, and the localteam relation selector.
3. Create an editor record as the LokalteamAdmin user with email `automated-invite-<runId>@stadt-land-klima.de`, the assigned localteam, and an organisation value.
4. Verify the editor creation triggers `createEditorUser`.
5. Verify the new Directus user has:
   - the invited email
   - status `invited`
   - role `LokalteamMitglied`
   - exactly one junction to the assigned localteam
6. Verify the editor record is readable for the inviting user.
7. Open `/admin/content/editors` in the Directus app and verify the invited email is visible while the unrelated localteam is not.

# Ask User to verify

1. Confirm an invitation email arrived at the invited address.
2. Confirm the subject is `Willkommen bei Stadt.Land.Klima!`.
3. Confirm the signup URL points to the tested Directus backend accept-invite route.
