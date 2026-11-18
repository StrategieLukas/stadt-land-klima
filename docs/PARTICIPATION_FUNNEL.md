# Participation funnel

`/mitmachen` has two routes: local participants select tools and enter their
municipality; SLK contributors select organisation areas, open projects, or an
undecided option. Both routes share a final form with name, email, current AGB
and privacy acceptances, and a choice between personal onboarding and account
creation without an appointment. There is no separate email-code step.

## Setup and content

Apply the checked schema, private service permissions and DE/EN/IT translations
through the normal repository-root command:

```bash
./bin/slk stack compose --env development -- exec directus /directus/cli/import-all.sh
```

The import seeds the seven existing organisation-chart areas only when
`organisation_teams` is completely empty. It preserves every nonempty collection,
including edited labels or deliberately removed teams. Administrators manage
`participation_projects` in Directus: title, short contribution description,
optional organisation area, sort order and draft/open/paused/closed status. Only
open projects recruit; no example projects are published automatically.

Exactly one `agreement_versions` record per `terms_of_service` and
`data_protection` must have `isCurrentVersion: true`, a version and nonempty
`legal_text`. The frontend displays those documents with unchecked required
checkboxes. If documents are missing, empty or ambiguous, interest selection
works but registration is unavailable. Never substitute example legal text.

Configure these private Directus environment variables for live booking:

```dotenv
SLK_PARTICIPATION_CAL_API_KEY=<private Cal.com API key>
SLK_PARTICIPATION_CAL_EVENT_TYPE_ID=<numeric onboarding event type ID>
```

Use the existing `stadt-land-klima/onboarding` event or its replacement. It must
accept ordinary immediate bookings with name/email and send attendee
confirmations. Host approval, payment, extra required questions and provider-side
email-code requirements need an additional integration before enabling them.
Account email ownership is established by the native Directus invitation.

Missing calendar credentials explicitly disable personal booking; account-only
registration remains available when the legal documents are configured. Configure
normal Directus SMTP and its public URL as well. The new
`email-template-participation-account.liquid` supports DE/EN/IT. Cal.com sends the
appointment confirmation and Directus sends the account confirmation to the same
normalized email address.

The fixed provider origin is `https://api.cal.com/v2`; slots use API version
`2024-09-04` and bookings use `2026-02-25`. Availability is live and timezone-aware.
[Slots documentation](https://cal.com/docs/api-reference/v2/slots/get-available-time-slots-for-an-event-type),
[booking documentation](https://cal.com/docs/api-reference/v2/bookings/create-a-booking).

Rebuild `consent-management` after source changes. Development Compose mounts its
manifest and compiled output; production packaging includes the shared checked
participation contract. No deployment is authorized by this feature change.

## Identity, agreements and security

Browser requests use checked same-origin Nuxt routes. Reads and writes are rate
limited; registration also verifies origin, its explicit request header and a
single-use purpose-bound ALTCHA proof. The private extension accepts only the
Frontend-Server identity. No anonymous collection/user write permissions were
added. Selecting interests never grants staff or local-team privileges.

Registration locks the normalized email using the role-invitation advisory-lock
namespace. Any existing account, regardless of status/role, is rejected unchanged:
no new consent, password/profile update, appointment or mail. A matching retry
credential is the sole exception: identical requests resume their own operation.
Changing input under the same credential is rejected.

Current agreements are re-read and locked before writing. IDs and content digests
must match the versions shown. Changed IDs, versions or text require fresh
acceptance. Selected areas and recruiting project statuses are revalidated too.

One transaction creates an **invited MinimalUser**, both native `user_consent`
records and a private `participation_registrations` record. The minimal role must
not inherit an administrator policy. Evidence stores the exact IDs, versions,
legal text, SHA-256 digests and server acceptance timestamps. The account remains
inactive until the person accepts the emailed native invitation and sets a
password. No activation/password token is returned to the browser.

Name/email and draft choices stay in page memory for Back navigation, not local
storage or analytics. Only a digest of the random in-memory retry credential is
stored. Calendar metadata contains an opaque registration ID, not that credential,
interest answers or consent text. Success requires both the requested accepted
booking and successful account-mail submission.

## External operations and recovery

Provider, SMTP and database operations are separate systems. A persisted state
machine prevents automatic duplicate external operations:

| State              | Meaning                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `reserved`         | Invited account and consents committed; external operations not started.   |
| `booking_started`  | One worker claimed booking; concurrent retries cannot book again.          |
| `booked`           | An accepted provider appointment has been saved; account mail remains.     |
| `email_sending`    | One worker claimed account mail; concurrent retries wait.                  |
| `delivery_pending` | Mail failed; the same request can retry it without rebooking.              |
| `complete`         | Return the saved success on identical retries, without more mail/bookings. |
| `needs_review`     | Provider outcome ambiguous; automatic booking retries stop.                |

An explicit provider validation/conflict rejection removes only the new unbooked
reservation/account and its consents, allowing another slot. Network timeouts or
unexpected replies retain the invited account/evidence for review. Submitted
identity/consent fields remain locked during uncertain outcomes. Known
pre-creation errors unlock them; specific messages offer retry or contact.

For stuck external operations, inspect the private registration and provider
metadata `slkRegistrationId`/SMTP outcome before an authenticated, reviewed
reconciliation. Do not clear a claim and replay an ambiguous booking. Cal.com's
confirmation email handles rescheduling/cancellation/reminders. Automatic webhook
reconciliation, an administrative recovery UI and in-site rescheduling are not
implemented in this initial release.

## Verification and conversion

`participation.test.ts` is included in `test:unit` and covers strict requests,
native consent transfer, unchanged existing accounts, stale documents, closed
projects, privilege checks, transaction rollback, booking conflict/uncertainty,
mail retry, idempotence, provider transport and public DTOs using controlled
service/database boundaries. The development runner includes
`flows/participationFlow.ts`: both routes and final options, preserved answers,
shared email/agreements, duplicate errors and 1280/320px theme checks using
explicit browser transport fixtures. These tests create no real bookings/mail.

```bash
npm --prefix bin/test_suite run test:participation
npm --prefix bin/test_suite run test:participation:ui -- http://localhost:8080
./bin/slk check ready
```

Real provider/SMTP delivery, invitation acceptance, native non-Linux builds and
deployed acceptance require their configured environments. Do not treat fixture
success as live provider acceptance. Dedicated funnel analytics/attendance
reconciliation are not implemented. Conversion improvement remains a hypothesis:
compare completed registrations/appointments by route and onboarding attendance;
never send email, raw locations or legal answers to analytics.
