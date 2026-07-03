# Initialise
1. Create a new test user with LokalteamMitglied role and automated-test@stadt-land-klima.de if you do not have it already.
2. Create a new localteam "AutomatedTest"
3. For the created user, add the localteam AutomatedTest to its localteams.
4. Verify on the rankings page that the team is not shown.

# Perform ratings
1. Fill out all items in the ratings_measures collections, giving them random ratings in the appropriate scale, and random texts for description and random links in sources. Mark 2-3 measures as "not applicable" with an appropriate reason.
2. Verify that the team is NOT shown on the rankings page for any version yet
3. Test the preview functionality with the "preview" button in the municipality collection. Preview should be visible and show the current score for the municipality in the frontend, but only protected by a token and NOT be in the public ranking.
4. Click the publishing checkboxes in the custom directus interface for each version and ensure nothing happens and you get an error for the account being unverified.
5. Use your admin acc to set this account to be verified and ensure that the checkboxes now work. It is important you actually try clicking the checkboxes rather than doing this programmatically
6. Published/Unpublish the measure_catalog and always verify against the current rankings page to ensure that (a) it is shown for the published version and (b) the non-published versions are not shown. Also verify that the correct score is shown on the rankings page for that version, i.e. that no mix-up happened.
7. End with all catalogs being published

# Perform Wahlcheck
1. Verify the measure_questions_template collection is visible and has between 30 and 50 entries
2. Create a Klimawahlcheck for the municipality and give it the name AutomatedElectionTest
3. Reopen the created Klimawahlcheck and click on "Thesen generieren" and verify that exactly 10 questions are generated for the AutomatedElectionTest, and visible to the user, with sectors set.
4. Create an additional question with sample text and a random sector and verify you now have 11 questions, visible to the user
5. Create 2 candidates, with names AutomatedCandidateA/B and respectively the emails automatedCandidateA@stadt-land-klima.de and autoamtedCandidateB@stadt-land-klima.de. Give one a random party from the list, and give another the new party "AutomatedParty"
6. Verify you can now see exactly these 2 candidates, and you can see the answers collection but with no entires.
7. Set a deadline for the Klimawahlcheck that is a few days in the future.
8. Verify that the button "Send Emails" is still greyed out
9. Verify that the button "Review der Thesen anfragen" is NOT greyed out, and click it

# Approve Wahlcheck
1. Create a new test user with WahlcheckAdmin role and automated-wahlcheck-admin@stadt-land-klima.de if you do not have it already.
2. Verify that the request_review flag is set for that election and approve it with that user.
3. Switch back to the LokalteamMitglied

# Send emails and evaluate responses
\ todo agent: create step-by-step guide

# Publish Wahlcheck
1. Click to publish it in the elections collection element.
2. Verify that the election appears on the overall Wahlcheck page
3. Navigate to the Municipality wahlcheck page and click through the 11 questions, ensure working wahlomat (todo agent: specify)
