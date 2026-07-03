# Create A New Localteam

1. Open `/register_localteam` in the frontend.
2. Verify the page renders the localteam registration entry point and municipality search.
3. Open `/register_localteam?ars=<valid-test-ars>&name=<new-test-municipality>` to simulate the frontend CTA with a selected municipality.
4. Fulfill the optional StadtLandZahl area lookup with deterministic test data for that ARS, so the frontend exercises a successful selected-municipality path while cleanup can still key records by run id.
5. Verify the selected municipality is shown and the new-team registration form is visible.
6. Verify the existing-team contact state is not shown.
7. Fill first name, last name, email, and organisation.
8. Solve the real Altcha widget in the browser.
9. Submit the form and verify `/api/register-municipality` succeeds.
10. Verify the success state shows:
   - `Durchstarten!`
   - `Account erstellen`
   - `Lokalteam anlegen`
   - `Passwort-E-Mail versenden`
   - `Aktivierungs-E-Mail`
   - the submitted email
   - the selected municipality
11. Verify no visible registration error and no browser console/page errors occur.
12. Verify Directus created an active, unverified `LokalteamAdmin` user with the submitted contact data.
13. Verify Directus created a draft localteam named `Stadt.Land.Klima! <new-test-municipality>`.
14. Verify the localteam admin is the created user.
15. Verify exactly one user/localteam junction exists for the created user and localteam.
16. Verify the generated municipality is linked to the localteam, keeps the selected name, has the selected ARS, is unverified, and has a preview token.

# Join An Existing Localteam

1. Create a disposable published localteam and let the Directus `createMunicipality` flow generate its municipality.
2. Patch that municipality with a valid test ARS.
3. Open `/register_localteam?ars=<existing-test-ars>&name=<existing-test-municipality>` in a mobile frontend viewport.
4. Fulfill the optional StadtLandZahl area lookup with deterministic test data for that ARS.
5. Verify the rendered page detects the existing localteam from Directus and shows `Lokalteam aktiv - Bewertung läuft`.
6. Verify the selected municipality name is visible.
7. Verify `Kontakt aufnehmen` is available and links to `/contact` with municipality context.
8. Verify the new-team registration form and `Lokalteam beantragen` submit button are not shown.
9. Verify no visible registration error and no browser console/page errors occur.

# Ask User To Verify

1. Confirm a welcome/activation email arrived for the newly registered localteam user.
2. Confirm the email references the newly requested localteam and contains the expected account setup link.
