# Roles And Editorial Permissions

1. Create an `ErfolgsprojekteRedaktion` user for the run.
2. Verify the role assignment through the Directus API.
3. Upload real Directus image assets for article images and organisation logos.
4. Create two organisations with logos.
5. Select a current published measure for article relation checks.
6. As `LokalteamMitglied`, create an article with all required project fields.
7. Verify the contributor-created article is saved as `draft`.
8. Try to publish that article as `LokalteamMitglied`.
9. Verify the publish attempt is rejected or leaves the article as `draft`.
10. As `ErfolgsprojekteRedaktion`, edit and publish the contributor-created article.
11. Verify the edit and published status persist.
12. As `ErfolgsprojekteRedaktion`, create a fully populated sample article with:
    - title, slug, author, municipality, state, subtitle
    - image and image credits
    - abstract and article body
    - organisation
    - project link
    - sectors
    - related measure
    - related article
    - related external project
    - additional examples, sources, economic efficiency, public impact, GHG savings potential, other benefits, ease of implementation
    - autonomous/profitable flags
    - public impact effects
    - GHG savings level
    - Instagram and LinkedIn URLs
13. Publish the sample article.
14. Verify all persisted fields and relations are readable from Directus.
15. Create a published control article with different state, sector, organisation, flags, and savings level for filter checks.
16. Create a draft article that must stay unpublished.
17. Create a separate published article, edit it, delete it, and verify it is gone.

# Public Article Detail

1. Open `/projects/<sample-slug>` in desktop viewport.
2. Verify the rendered page shows title, subtitle, municipality, state, author, image credits, abstract, article body, organisation, related measure name, and related measure id.
3. Verify the project link, Instagram link, LinkedIn link, and article image render.
4. Verify no visible error state and no browser console/page errors occur.
5. Repeat the same checks in mobile viewport.

# Projects Overview

1. Open `/projects`.
2. Verify the published sample article appears.
3. Verify the published control article appears.
4. Verify the redaktion-published contributor article appears.
5. Verify the draft article does not appear.
6. Verify the Bundesland filter shows the matching sample article and hides the control article.
7. Verify the sector filter shows the matching sample article and hides the control article.
8. Verify the organisation filter shows the matching sample article and hides the control article.
9. Verify the `Eigenständig umsetzbar` filter shows the matching sample article and hides the control article.
10. Verify the `Maßnahme amortisiert sich` filter shows the matching sample article and hides the control article.
11. Verify the `Vorbildwirkung` filter shows the matching sample article and hides the control article.
12. Verify the `Akzeptanzfördernd` filter shows the matching sample article and hides the control article.
13. Verify the `municipality` query filter shows the matching sample article and hides the control article.
14. Verify default newest-first sorting places the later control article before the earlier sample article.
15. Verify `Höchstes Einsparpotenzial` sorting places the `very_high` sample article before the `high` control article.

# Backend App Visibility

1. Log in to the Directus app as `ErfolgsprojekteRedaktion`.
2. Open `/admin/content/articles`.
3. Verify the rendered app shows both the published sample article and the unpublished draft article.
