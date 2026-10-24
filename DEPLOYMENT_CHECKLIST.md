# Security branch deployment checklist

**2026-10-24. Run on staging first, then production.** The code stays on Directus **11.17.4**. This is a deployment procedure, not a claim that the remaining Directus advisories are resolved. Finish or explicitly accept the release gates in [REMAINING_TODOS.md](REMAINING_TODOS.md) before exposing the release.

## 1. Back up and select the reviewed release

- Keep a fresh off-host SQL + uploads/configuration backup, including `docker/core-storage/`, private environment files and the active host nginx configuration. Test restoration on staging. Check free disk space before building.
- Deploy the reviewed branch/revision after it has been committed/merged by the operator. Preserve host-local `.env` files and storage overlays. **Do not rerun `upgrade_core_services.sh` if the PostgreSQL/Meilisearch major upgrades already succeeded.**
- Commands below run from `/home/deploy/staedtechallenge`. In the same shell, define the production Compose command, including this host's migrated storage:

```bash
cd /home/deploy/staedtechallenge
umask 077
slk_compose=(docker compose -f docker-compose.yaml -f docker-compose.prod.yaml)
if [ -f docker/core-storage/production.compose.json ]; then
  slk_compose+=(-f docker/core-storage/production.compose.json)
fi
slk_private="$(mktemp -d /home/deploy/slk-security-cutover-XXXXXX)"
chmod 700 "$slk_private"
```

## 2. Build and import while the website is stopped

```bash
./bin/stop.sh
for slk_extension in src/directus/extensions/*; do
  [ ! -f "$slk_extension/package.json" ] || npm --prefix "$slk_extension" ci --include=dev
done
./bin/check_extensions.sh --build
./bin/build_production.sh
./bin/start_production.sh --import --prepare-only
```

Use the project's supported host Node version for extension builds. The build uses `--no-cache --pull`; clearing the npm cache is unnecessary. `--prepare-only` starts Directus and imports the code-first schema/roles/flows but leaves the frontend stopped. It stops on import/readiness failure. Maintenance is an nginx **fallback**, not a blanket firewall: the running CMS remains reachable; exclude editorial activity during the cutover. Do not change `public.yaml`.

## 3. Create the private website service identities and configure secrets

```bash
"${slk_compose[@]}" exec -T -e DIRECTUS_URL=http://127.0.0.1:8055 directus \
  node /directus/cli/tasks/provisionServiceUsers.ts > "$slk_private/service-users.env"
chmod 600 "$slk_private/service-users.env"
```

Requires the private administrator `CLI_DIRECTUS_STATIC_TOKEN` already configured in Directus. The command creates missing Frontend-Server/Public/Preview accounts, reuses existing strong tokens, and refuses conflicting accounts. It does **not** rotate existing tokens. Treat its output as secret; do not paste it into tickets or logs.

Copy `DIRECTUS_FRONTEND_SERVER_TOKEN` and `DIRECTUS_PREVIEW_TOKEN` from that private file into `src/frontend/.env`. The public-asset token is inventoried but currently has no frontend consumer; do not reintroduce any browser service token. Set the canonical frontend `PUBLIC_URL=https://www.stadt-land-klima.de` and preserve the correct private/public CMS URLs. Check actual imported UUIDs for the two protected mail webhook URLs. Keep `DIRECTUS_ADMIN_TOKEN` private and update aliases together if it is the same credential as the CLI token.

| Credential action                                                                         | Required handling                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Retire the old `DIRECTUS_TOKEN` / legacy Frontend account**                             | Required after the new website has passed its smoke check. Step 6 does this. Never copy that token into the new private role.                                                                                                                                                                                                                            |
| **Use a unique strong `ALTCHA_SECRET`**                                                   | At least 32 random characters; replace any example, shared or exposed value before starting the frontend. Generate privately with `openssl rand -hex 32`. Empty editor/candidate session secrets derive from it; changing it invalidates those sessions. Independent `EDITOR_SESSION_SECRET` / `CANDIDATE_SESSION_SECRET`, when set, must be strong too. |
| **Database application login**                                                            | If Directus still uses a superuser, perform the staged role cutover below; it generates a fresh app password and preserves the bootstrap operator.                                                                                                                                                                                                       |
| **Known/example/exposed admin, signing, database, SMTP, Meilisearch or provider secrets** | Replace affected credentials in the real service, then every consuming `.env`/instance, and verify delivery/access. Editing `ADMIN_PASSWORD` or `POSTGRES_PASSWORD` alone does not change persisted accounts. No private production values were inspected, so there is no evidence that every family needs a blanket rotation.                           |
| Candidate invitations                                                                     | Review actual exposure; opt into rotation only with replacement invitations coordinated. Default policy skips them.                                                                                                                                                                                                                                      |
| Municipality preview links                                                                | Retain by default, per your decision. The private preview-verifier service token is a separate credential.                                                                                                                                                                                                                                               |

The [complete 28-family inventory](SECURITY_DECISIONS.md#credential-inventory-and-rotation-policy--2026-10-24) and [editable policy](src/directus/cli/credential-rotation.yaml) record owners, selections and review/rotation dates without storing values. Provider/administrator/signing-secret rotations remain manual. Do not blindly change `SECRET`: test session invalidation and recovery of any stored encrypted values on a restored staging database first.

If Directus still uses the bootstrap superuser, follow the [database-role cutover procedure](README.md#database-application-role-cutover) now. Rehearse it on restored staging data first. The tool creates a fresh non-superuser app identity without demoting the operator; normal backups retain operator access. Resume at step 4 after restarting/importing with the new credentials.

## 4. Install the host proxy changes

Install/diff the maintained `nginx/sites-available/stadt-land-klima.de` into the host's active site configuration, preserving its real TLS paths and staging-specific hostnames. Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Verify only the intended public listeners are reachable. Production frontend/CMS should be loopback-only on 9000/9001; PostgreSQL, Redis and Meilisearch must not be reachable externally. Check host RAM against the configured container limits. Do not enable the old optional `SLK_STARTUP_SECURITY_CHECKS` whitelist blindly; it still needs alignment with the newer service roles. A separate CMS hostname is an explicit follow-up decision, not required by these commands; its URL/cookie/CORS/old-session changes must be deployed together.

## 5. Start and verify the new website

```bash
./bin/start_production.sh
curl --fail --silent --output /dev/null http://127.0.0.1:9001/server/health
curl --fail --silent --output /dev/null http://127.0.0.1:9000/
npm --prefix bin/test_suite run test:public -- https://www.stadt-land-klima.de
```

Use the staging hostname for the staging run. Verify public content/search/media, candidate access and a controlled submission, editor login/save/logout, and actual configured mail/newsletter/external data integrations. Website editors must sign in again once. Check the enforced nonce CSP and that public runtime data no longer contains the old browser token. Verify the running Node versions and source-verified image guards against the reviewed build. The public smoke is read-only; do not run writable full workflows against production data.

## 6. Retire the old shared identity

Privately identify which actual Directus user owned the previously browser-exposed token. If it was an administrator or another role, rotate/revoke that underlying credential and all aliases explicitly: the retirement tool only suspends users of the legacy Frontend role. Do not assume a role name proves every exposed token has been retired.

Review `src/directus/cli/credential-rotation.yaml` first: default selection revokes only the legacy Frontend identity; preview links remain unchanged and candidates require an explicit rotation choice.

```bash
"${slk_compose[@]}" exec -T -e DIRECTUS_URL=http://127.0.0.1:8055 \
  -e PUBLIC_URL=https://www.stadt-land-klima.de directus \
  node /directus/cli/tasks/retireCredentials.ts plan /directus/.tmp/credential-retirement.json \
  --policy /directus/cli/credential-rotation.yaml
"${slk_compose[@]}" cp directus:/directus/.tmp/credential-retirement.json "$slk_private/"
"${slk_compose[@]}" cp directus:/directus/.tmp/credential-retirement.json.links.json "$slk_private/"
```

Review both private files and back them up off-container. Coordinate any selected candidate replacements; the tool sends no mail. Pause credential-issuing writers, then apply **the same reviewed plan and unchanged policy selection**:

```bash
"${slk_compose[@]}" exec -T -e DIRECTUS_URL=http://127.0.0.1:8055 \
  -e PUBLIC_URL=https://www.stadt-land-klima.de directus \
  node /directus/cli/tasks/retireCredentials.ts apply /directus/.tmp/credential-retirement.json \
  --policy /directus/cli/credential-rotation.yaml
```

Confirm the old identity is suspended/token cleared and the new website still works. Reuse the same plan to resume a partial failure. Do not restore exposed tokens as rollback.

## 7. Finish acceptance

Rebuild existing search data from published content with the reviewed indexing procedure and verify draft/private/obsolete documents disappear; no bulk reindex command is provided by this change. Purge only identified stale application/CDN caches. Do not `FLUSHALL` Redis: it holds sessions and abuse controls. Review historical URL-bearing logs, observe errors/rate limits/CSP and record the deployment revision, credential actions and restore/smoke results. Search reindex tooling, remaining pinned-Directus findings, optional startup-check alignment and any CMS-origin migration remain tracked work; do not mark the full hardening release complete merely because the containers start.
