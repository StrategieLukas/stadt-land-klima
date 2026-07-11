# Initialise

1. Create a disposable LokalteamMitglied user.
2. Create a disposable Lokalteam `AutomatedTest <runId>`.
3. Add the user to the localteam.
4. Verify the municipality is not visible on `/municipalities?v=<currentFrontendCatalog>`.

# Perform ratings

1. Read the ratings that are visible to the LokalteamMitglied user. The permission restriction must come from the role; do not add a test-only filter to decide what the user can see.
2. Fill all current catalog `ratings_measures` entries:
   - set most measures to applicable, green rating, published status, a progress text, and a source URL
   - set 2-3 measures to not applicable with a required explanation
3. Wait until the municipality score has at least 95% completion and a full score.
4. Verify the team is still not shown on the public ranking.
5. Open the municipality detail page without a preview token and verify it is locked.
6. Open the municipality detail page with the preview token and verify it shows the municipality and score while remaining absent from the public ranking.
7. Log in to Directus as the unverified LokalteamMitglied, open the municipality item, and click the custom score publisher checkbox.
8. Verify the rendered Directus app shows the unverified-account dialog and the score remains unpublished.
9. Verify the account with an admin user.
10. Log in again as LokalteamMitglied, open the municipality item, and click the score publisher checkbox.
11. Verify the current catalog score is visible on the ranking.
12. Click the same checkbox again and verify the municipality disappears from the ranking.
13. Click it a final time and leave the current catalog published.
14. Verify non-current catalog score rows remain unpublished.
15. Open the published municipality detail page in desktop viewport.
16. Verify the municipality detail page shows no visible loading/error state and logs no browser errors.
17. Verify a visible sector card and translated heading exists for every standard sector:
    - Energie
    - Verkehr
    - Landwirtschaft, Natur & Ernährung
    - Industrie, Wirtschaft & Konsum
    - Gebäude & Wärme
    - Klimaschutzmanagement & Verwaltung
18. Click the PDF button and verify the response is a non-empty `application/pdf` file with a valid `%PDF` header.
19. Repeat the same detail-page, sector-card, no-error, and PDF checks in mobile viewport.

# Perform Wahlcheck

1. Verify the `measure_questions_template` collection is visible in the Directus app and has between 30 and 50 entries.
2. Create a Klimawahlcheck named `AutomatedElectionTest <runId>`.
3. Open the created Directus election item and verify the custom action UI shows `Thesen generieren` and `Review der Thesen anfragen`.
4. Verify `E-Mails versenden` is not shown before approval.
5. Click `Thesen generieren`.
6. Verify exactly 10 published questions are generated, each with title, thesis, and sector.
7. Create an additional published question with a sample thesis and sector.
8. Verify the user sees 11 total questions in Directus.
9. Create two candidates:
   - `AutomatedCandidateA <runId>` with the first candidate email and a listed party
   - `AutomatedCandidateB <runId>` with the second candidate email and an `AutomatedParty <runId>` party
10. Verify the candidate list shows exactly those two candidates for this election.
11. Verify the answers collection is visible and empty before candidate responses.
12. Set a response deadline a few days in the future.
13. Click `Review der Thesen anfragen`.
14. Verify `review_requested` is set and the Directus app shows `Review angefragt`.

# Approve Wahlcheck

1. Log in as a disposable WahlcheckAdmin user.
2. Open the election in Directus and verify the review request is visible.
3. Approve the Wahlcheck by setting `is_approved` as WahlcheckAdmin.
4. Switch back to the LokalteamMitglied user.
5. Verify the Directus action UI now exposes `E-Mails versenden`.

# Send emails and evaluate responses

1. Click `E-Mails versenden` in the Directus action UI and accept the browser confirmation.
2. Verify the rendered `Versandübersicht` appears.
3. Verify both candidates receive unique stable access tokens.
4. For each candidate token, open `/elections/thesen/<access_token>` in the frontend.
5. Verify the candidate name and localteam are displayed.
6. Answer all 11 theses and fill a reasoning text for every thesis.
7. Submit the form and verify the success message is shown.
8. Verify `candidate.has_answered` is true.
9. Verify exactly 11 answer records exist for each candidate and each answer has a response and explanation.
10. Ask the user to manually verify actual candidate emails if SMTP is configured. Local development usually only verifies token generation, because mail transport is disabled.

# Publish Wahlcheck

1. Publish the approved election.
2. Verify the election appears on `/elections/wahlcheck`.
3. Navigate to `/elections/wahlcheck/<slug>`.
4. Click through all 11 public Wahlcheck questions.
5. On the summary step, mark at least one question as double weighted.
6. Show results.
7. Verify both candidate names appear in the ranked results.
8. Verify the result URL contains a share parameter.
