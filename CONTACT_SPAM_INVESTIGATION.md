# Contact spam and CAPTCHA investigation

Reviewed: 2026-10-21. Scope: investigation and this report only; no application, configuration, permission, database, or deployment changes.

## Findings in brief

**Production currently exposes a route that bypasses CAPTCHA entirely.** A read-only request to production's Directus permission endpoint confirmed that the token exposed to website visitors has full `create` access to the `feedback` collection. The contact page's CAPTCHA runs in a separate Nuxt endpoint; direct Directus submissions do not pass through it. The configured Directus flow sends the notification shown in the example whenever a feedback record is created.

**There is also a separate CAPTCHA replay flaw in the inspected code.** A valid solution never expires and is not marked as used. I verified locally, using the actual verifier, that the same proof is accepted repeatedly. Fixing only one of these two paths leaves the other available.

The random strings strongly suggest automated form spam or probing. The example alone cannot establish who sent it, their objective, or which submission path they used. No production submissions were made during this investigation.

## Branch and evidence boundaries

- The checkout was `0000-security-updates`, initially at `f1c634225bef83e0c623e947930975db29300042`, with another agent's existing changes. Those changes were left untouched.
- There is no local or remote branch literally named `dev`. A read-only remote lookup found `main` at `7e5095b7ed5c394a8e95552ad3e7d06cfd86f83f` and `testing` at `ed85b54bdba4e0e46002f2d808d96a8b503faeb0`. The exact production commit remains unconfirmed.
- The feedback handler, challenge generator, shared verifier, and feedback notification flow are identical between the inspected `origin/main` and checkout HEAD. Both also contain the relevant Frontend feedback-create permission. Other ongoing security work differs substantially; it must not be assumed deployed.
- Live production checks independently establish the exposed permission, public environment setting, and challenge format. They do not establish which path produced past spam. Production access logs and Directus activity records were not accessed.

## What are these messages, and what is the point?

The supplied name, subject, and message look like generated alphanumeric filler. The address is syntactically valid, and `cooperation` is an allowed form option. This satisfies the current handler's basic checks: nonempty fields, an allowed type, and an email-shaped contact value.

Plausible explanations, in decreasing evidential certainty:

1. **Automated submissions:** the random fields and repetition strongly suggest a script or automated browser filling forms.
2. **Testing whether a form accepts submissions:** random markers can help an operator identify successful requests or received messages before sending advertising or malicious content. A generic bot may simply populate every required field without understanding the site.
3. **Testing or exploiting copy-to-sender email:** the form can send submitted text to an arbitrary supplied address when `sendCopy` is enabled. An operator controlling the address could test delivery, or use someone else's address to send unwanted mail. The example does not show whether a copy was requested.
4. **Nuisance flooding or unattended broken automation:** these can generate meaningless messages without an immediate commercial payload.

There is no visible promotional link or exploit payload in this sample. There is no evidence here of encryption, a particular bot family, mailbox ownership, or an administrator-account compromise. Ten to fifty requests per day is a small computational workload, even for a bot that solves a fresh proof each time. Ordinary per-minute flood limits alone may never trigger.

OWASP describes automated spamming and vulnerability scanning as distinct threat patterns; the sample is consistent with automation but does not establish intent. See [OWASP's automated-threat taxonomy](https://owasp.org/projects/automated-threats-to-web-applications?tab=ontology).

## Confirmed production observations

Only GET requests were used. The publicly delivered token was handled in memory and is intentionally omitted from this report.

| Observation | Result | Meaning |
| --- | --- | --- |
| `GET https://www.stadt-land-klima.de/contact` | HTTP 200; public runtime configuration includes a Directus token | This identity is available to visitors and bots. Its permissions must be safe for untrusted callers. |
| Public runtime `appEnv` | `production` | The development CAPTCHA bypass does not appear enabled in this sampled deployment. |
| `GET /backend/permissions/me` using that browser token | `feedback.create.access = full` | Direct feedback creation is currently authorized without passing through the Nuxt contact handler. |
| Allowed feedback-create fields | `title`, `content`, `type`, `sender_name`, `sender_contact`, `date_created`, `status` | All fields needed for the internal spam notification can be submitted directly. `send_copy` is not in this field allowlist. |
| Other feedback actions for this identity | Read, update, delete, share: `none` | This observation establishes unauthorized-by-design submission capability, not feedback disclosure or deletion. |
| `GET /api/altcha` | `SHA-256` challenge, `maxnumber = 100000`; no expiry parameter in salt or separate expiry field | Matches the inspected custom challenge generator. |
| Offline comparison of the challenge signature against the known fallback key | Did not match | The sampled production challenge is not signed with the repository's known default key. This does not measure the actual key's strength. |

No production POST, GraphQL mutation, database write, email delivery test, or load test was performed. The permission response establishes authorization; a successful end-to-end bypass write was deliberately not attempted.

## Why the current protection is ineffective

### 1. Directus permits bypassing the protected endpoint

The intended request path is:

`/contact → POST /api/submit-feedback → validate fields and CAPTCHA → create feedback → notifyNewFeedback`

The additional exposed path is:

`browser-visible Frontend token → POST /backend/items/feedback → create feedback → notifyNewFeedback`

Relevant implementation:

- `src/directus/policies/Frontend.yaml`, `collection: feedback`, `action: create`: permits creation with no validation filter.
- `src/directus/roles/Frontend.yaml`: attaches that policy to the browser identity.
- `src/frontend/nuxt.config.ts` and `src/frontend/plugins/directus.client.js` in `origin/main`: expose and use the Frontend token in the browser.
- `src/frontend/server/api/submit-feedback.post.ts`: performs CAPTCHA validation only on requests routed through this handler.
- `src/directus/flows/notifyNewFeedback.yaml`: listens to `items.create` for `feedback`, with `accountability: all`, and formats the exact notification text supplied in the question.
- `nginx/sites-available/stadt-land-klima.de`: exposes Directus under `/backend/`.

A visible CAPTCHA widget cannot protect a second API entry point. CORS, hiding the token in page code, renaming the endpoint, or changing CAPTCHA providers would not remove this permission. Moving future browser requests to server routes also does not revoke an already distributed token's authority.

### 2. The custom CAPTCHA verification accepts replay indefinitely

`src/frontend/server/api/altcha.get.ts` creates a random salt, chooses a number below 100,000, hashes the salt and number, and signs the hash. It includes no expiration or action binding.

Both `src/frontend/server/utils/verifyAltcha.ts` and the duplicate verifier inside `submit-feedback.post.ts` check the proof hash and HMAC. Neither checks expiration or records that a challenge has been consumed. The proof is not bound to the contact submission or its content.

Consequently, one valid proof can authorize repeated submissions until the signing key changes. The shared verifier also affects registration, article submissions, and generic form responses; hardening only the duplicate contact verifier leaves those other routes exposed to replay.

In-memory checks against the actual `origin/main` contact verifier produced:

| Check | Result |
| --- | --- |
| First, second, and third verification of the same valid proof | All accepted |
| Validly signed proof whose salt includes an old `expires=1` parameter | Accepted; expiry is not interpreted |
| Development bypass proof with development mode enabled | Accepted |
| The same bypass with development mode disabled | Rejected |
| Locally generated proof signed with the fallback key, verified using that fallback | Accepted |
| Base64 JSON `null` | Throws instead of returning a clean validation failure |

These checks used a disposable in-memory key and made no submission requests. The expiry test demonstrates missing enforcement; production's generator does not currently issue expiry parameters at all.

ALTCHA explicitly requires single-use challenges and recommends expiration and rate limiting for custom integrations. Using its cryptographic library alone does not replace the application's replay store. See [ALTCHA server integration](https://altcha.org/docs/integration/server/) and [security recommendations](https://altcha.org/docs/integration/security-recommendations/).

### 3. Proof of work is only one layer

The current challenge requires searching at most 100,000 candidate numbers. Automated software can perform that work just as a browser does. Even correctly implemented proof of work imposes a cost; it does not establish that the submitted text is useful or human-written.

No contact-specific rate limiting, honeypot, duplicate detection, or moderation gate was found in the inspected submission code or checked-in production Nginx file. Host-level includes, external proxies, and production-only controls were not inspected. Every accepted feedback creation triggers the configured internal notification.

The contact handler also lacks strict field type and length validation, and its request-body helper has no application-level size limit. The checked-in proxy permits bodies up to 512 MB. These are additional hardening issues, not evidence that oversized requests caused this incident.

### 4. Two configuration hazards exist, but were not observed active

The code accepts a static development proof when `public.appEnv === 'development'`, and falls back to a known literal when the CAPTCHA secret is absent. The example environment contains both development defaults. Production Compose sets `SLK_ENV=production`, whereas Nuxt reads `APP_ENV`; these are different settings.

The live observations above argue against either hazard being active on the sampled production instance. They should still be removed as production failure modes. A correct `NODE_ENV` or `SLK_ENV` alone does not establish that the effective Nuxt runtime values are correct.

### 5. Copy-to-sender expands the abuse impact

The Nuxt endpoint accepts `sendCopy: true`, and the Directus flow sends submitted content to `sender_contact`. That address is not verified. This can turn contact spam into unwanted outbound mail and damage sender reputation.

The directly exposed Frontend permission does not allow setting `send_copy`; its schema default is false. Therefore, distinguish direct internal-notification spam from copy abuse through the Nuxt endpoint or another identity. The supplied email does not identify which occurred. The HTML email templates interpolate user content; verify escaping in the actual mail renderer rather than assuming injection is possible or impossible.

## Recommended changes, in priority order

### First: close the alternate write path

1. Remove `feedback` creation from the browser-facing Frontend policy in YAML. In this Directus 11 layout, the relevant file is `src/directus/policies/Frontend.yaml`, attached through the role file. Leave Public permissions unchanged.
2. Keep the legitimate contact endpoint as the public entry point. It already writes with a private server token, so removing the browser grant should not require replacing the contact form. Prefer a dedicated server identity restricted to creating the required feedback fields over the current administrator token.
3. Apply the YAML through the repository's normal import workflow, then verify the effective permissions of every policy attached to the browser identity. Check both current and previously distributed credentials if the ongoing access-split work introduces new identities. Removing a token from rendered HTML does not invalidate copies already collected.
4. In an isolated test deployment with captured SMTP, prove that direct REST and GraphQL feedback writes fail while a valid contact submission succeeds and sends exactly one internal notification.

This is the smallest high-impact containment change. It closes a confirmed production authorization gap without waiting for the broader frontend architecture migration. Rotating a publicly exposed token while preserving the same create permission would not solve it.

### Second: harden the shared CAPTCHA boundary

1. Consolidate the duplicated verifier and use the maintained ALTCHA server library for the chosen protocol version.
2. Require a strong private signing key, reject the known development default in production, and fail closed when configuration is missing. Ensure production cannot enable a client-supplied development bypass.
3. Issue authenticated expiration and purpose information, such as `contact`, and enforce both server-side. A proposed starting expiry is 20 minutes, with refresh support for people composing longer messages.
4. Atomically consume each verified challenge before any database write or email. Use a shared store, such as the existing Redis service, with retention through challenge expiry. A per-process set or separate read-then-write check fails across workers or concurrent requests. If the store is unavailable, do not silently accept untracked proofs.
5. Reject malformed payloads, unsupported algorithms, invalid types, invalid numeric ranges, and excessive lengths with controlled errors. Bound the request body before reading it into memory.
6. Apply the same guarantees to registration, article submissions, and generic form responses. Refresh the widget after a consumed proof; use a separate idempotency mechanism if legitimate retries must recover from uncertain submission outcomes.

### Third: reduce spam that solves fresh challenges

- Add shared, route-specific limits before expensive processing and before email delivery. As an initial configuration to tune against real traffic, consider 5 contact attempts per 10 minutes and 20 per day per trusted client IP, plus a tighter copy-recipient budget. Account for shared networks; only trust forwarded IP headers from the actual proxy. These numbers are proposals, not established safe thresholds.
- Add an accessible honeypot and server-issued submission timing signal as additional indicators. Do not rely on a client timestamp or treat fast completion alone as proof of spam.
- Trim and validate bounded string fields, email syntax, allowed type, and booleans. Use combined content signals to quarantine suspicious messages. Do not reject people solely because their name is unusual, their message is short, or their language is unexpected.
- Add a moderation state before notification delivery, so suspected spam does not generate immediate inbox noise. The Directus flow must honor that state; simply marking a new record as spam would currently still trigger its creation notification. Avoid silently discarding legitimate enquiries.
- Disable arbitrary-content sender copies initially, or replace them with a fixed acknowledgement subject to per-recipient and global budgets. Fixed acknowledgements can still be abused to send unwanted email, so they also need controls.
- Record request ID, entry point, coarse outcome/rejection reason, challenge fingerprint, and appropriately minimized network information. Never log credentials, full CAPTCHA payloads, or message content by default.

If spam continues after these changes, evaluate a managed anti-bot service or ALTCHA Sentinel. Cloudflare Turnstile is another option, but requires server-side validation and checked hostname/action context; its tokens expire after five minutes and are single-use. It adds an external service dependency and does not fix a Directus write bypass. See [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## How to establish the actual source of past spam

Correlate notification timestamps and feedback creation times with existing logs:

- Requests to `POST /api/submit-feedback` point to the Nuxt route. Requests to `POST /backend/items/feedback`, other Directus aliases, or GraphQL mutations point to direct writes. Account for any directly reachable upstream port.
- Where available, Directus activity records can distinguish the Frontend identity from the server identity and reveal request IP or user agent. Feedback does not need a `user_created` field for activity logging to be useful, but activity retention and settings must be checked.
- Check whether spam requested sender copies and whether outbound mail logs show those copies. The internal notification alone does not reveal this.
- Compare clustering, request frequency, repeated content, and user agents. User agents and submitted email addresses are untrusted identifiers and do not establish attribution.

Existing logs may not contain CAPTCHA fingerprints, so historical replay may be impossible to prove retrospectively. Do not enable unrestricted request-body logging to investigate it.

## Verification and dependency notes

Completed: read-only production checks above; in-memory verifier checks; baseline comparison; source tracing through the page, Nuxt handler, Directus policy, proxy, and notification flow; local `curl http://localhost:8080/contact` returned HTTP 200. None of these checks asserts that the spam path was exercised end-to-end.

The `origin/main` frontend lockfile resolves ALTCHA 3.0.10 and Nuxt 3.21.6; checkout HEAD resolves ALTCHA 3.4.1 and Nuxt 3.21.11. A read-only npm bulk-advisory lookup for 1,046 package names in the baseline lockfile returned advisories for 29 package names, including high/critical advisories elsewhere in the dependency tree. It returned none for ALTCHA. This is a dependency triage result including development/transitive packages, not proof of exploitability or an inventory of the deployed container. Coordinate dependency remediation with the other agent; the spam paths here arise in application authorization and custom verification and do not require a dependency exploit. Keep Directus at or below the project's required 11.17.4 ceiling.

`FEATURES.md` currently records no dedicated automated coverage for feedback submission, its notification flow, or CAPTCHA security. It was reviewed and left unchanged because this task changes no functionality.

The general `bin/test_dev.sh` suite was deliberately not run: its runner creates and deletes database fixtures, exercises writes, and may trigger mail. That would conflict with the explicit instruction to make no modifications beyond this Markdown file and could interfere with the other agent. The eventual implementation should run it in a controlled development environment, alongside dedicated tests for:

- Direct writes rejected for anonymous, browser, and other untrusted identities, through REST and GraphQL; least-privilege server writes succeed.
- Missing, malformed, expired, forged, wrong-purpose, and development proofs rejected in production mode before side effects.
- Sequential and concurrent replay across workers produces at most one accepted write; shared-store failure fails closed.
- Fresh valid proof produces one record and the intended notification; browser refresh/retry behavior works.
- Rate limits, body/field bounds, spam quarantine, recipient budgets, and copy-email rendering behave as intended.
- German, English, and Italian contact flows remain usable, including long composition time and keyboard/screen-reader access.

Only this report was created. No commits, permission imports, restarts, dependency installs, or application changes were made.
