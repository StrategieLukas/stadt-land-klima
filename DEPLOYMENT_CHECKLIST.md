# Deployment acceptance

Use restored staging data before production. Current constraints are in
[PROJECT_DECISIONS.md](PROJECT_DECISIONS.md); host/runtime details are in
[PODMAN.md](PODMAN.md). Directus remains **11.17.4**.

## Prepare and build

1. Preserve a verified off-host database/uploads/configuration/gateway backup and
   all active `podman/core-storage/` overlays. Confirm restore and build RAM/disk.
2. Install the reviewed revision/locks without overwriting private dotenv files.
   Keep source readable and private files mode 0600/0400; do not recursively chmod
   uploads/source or repeat completed major-service upgrades.
3. Prepare the rootless host, real application DB role and imported policies on
   the restored target. Production startup checks reject an unprepared target.

```bash
./bin/slk stack doctor --env production
./bin/slk stack build --env production
./bin/slk stack start --env production --import --prepare-only
```

Preparation leaves frontend stopped. Maintenance is a fallback, not a CMS write
lock; pause external/editorial writers during sensitive operations. Build source,
locked dependencies, extension bundles and matching YAML together.

## Private service identities

Use the mounted private CLI administrator credential:

```bash
slk_private="$(mktemp -d /tmp/slk-release.XXXXXX)"
chmod 700 "$slk_private"
./bin/slk stack compose --env production -- exec -T -e DIRECTUS_URL=http://127.0.0.1:8055 directus \
  node /directus/cli/tasks/provisionServiceUsers.ts > "$slk_private/service-users.env"
chmod 600 "$slk_private/service-users.env"
```

Provisioning reuses strong existing tokens and rejects conflicting accounts. Copy
private server/preview values into `src/frontend/.env`; never use public runtime
config for them. Set real mail-flow UUIDs, canonical/public/private URLs and strong
signing/session secrets. Translation-worker setup is in its separate operator
guide. If needed, rehearse/apply the restricted database-role cutover from README.

## Caddy and runtime verification

Validate/reload the selected Caddy gateway with the host's real TLS configuration.
Keep isolated CMS guards, explicit trusted forwarding and separate API/page/asset
budgets. Verify loopback application listeners, private data services, CSP/CORS/
referrers, resource limits and required disabled CMS surfaces.

```bash
./bin/slk stack start --env production
./bin/slk stack audit --env production
npm --prefix bin/test_suite run test:public -- https://www.stadt-land-klima.de
```

Use the staging origin on staging. Verify actual content/search/media, controlled
candidate/editor operations, nonce CSP and real configured integrations. Test a
real `/contact` search hit; HTTP 200 with empty fallback is insufficient. Writable
full workflows run only on isolated fixtures.

After an ordinary dotenv edit use `slk stack restart <service> --env production`.
Validate the new effective setting with a safe functional check; do not print
credentials or rely on inspect metadata (which intentionally has no mounted
secret values). No image rebuild is needed. Explicit `NUXT_*` keys override their
legacy aliases. Topology/image changes and persisted-account rotation are separate.

## Legacy credentials, if still present

Only after replacement access passes acceptance, review
[credential-rotation.yaml](src/directus/cli/credential-rotation.yaml). Candidate
invitation tokens and municipality preview links remain **retained**. The tool
only revokes legacy Frontend-role accounts, not arbitrary exposed administrators.

```bash
./bin/slk stack compose --env production -- exec -T -e DIRECTUS_URL=http://127.0.0.1:8055 \
  -e PUBLIC_URL=https://www.stadt-land-klima.de directus \
  node /directus/cli/tasks/retireCredentials.ts plan /directus/.tmp/credential-retirement.json \
  --policy /directus/cli/credential-rotation.yaml
./bin/slk stack compose --env production -- cp directus:/directus/.tmp/credential-retirement.json "$slk_private/"
./bin/slk stack compose --env production -- cp directus:/directus/.tmp/credential-retirement.json.links.json "$slk_private/"
```

Review/back up both private files off-container, pause credential-issuing writers,
then apply the same reviewed plan with unchanged policy selection:

```bash
./bin/slk stack compose --env production -- exec -T -e DIRECTUS_URL=http://127.0.0.1:8055 \
  -e PUBLIC_URL=https://www.stadt-land-klima.de directus \
  node /directus/cli/tasks/retireCredentials.ts apply /directus/.tmp/credential-retirement.json \
  --policy /directus/cli/credential-rotation.yaml
```

Verify suspension/token removal and website access. Resume the same plan after a
partial failure; never restore exposed tokens as rollback or rotate retained
candidate/preview links as part of this operation.

## Finish acceptance

Run actual image regressions/audits with Podman and retain raw artifacts. The
reviewed image dispositions expire **2026-11-24** and need evidence-based renewal.
Check search reconciliation, safe logs, Redis/rate limits and real SMTP/providers.
Purge identified stale application/CDN responses only; never `FLUSHALL` Redis.
Record revision/date, restore evidence, effective runtime changes and smoke results.
Verify certificates, reboot/systemd recovery and remote CI/branch protection on the
actual target. Local tests do not establish production acceptance.
