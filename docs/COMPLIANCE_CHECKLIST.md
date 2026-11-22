# Stadt Land Klima compliance checklist

Assessment date: **22 November 2026**

This English checklist translates and evaluates the supplied German requirements
REQ-01 through REQ-33 against the current repository. It also identifies relevant
omissions. It records proposed work, implementation options and their effects;
unchecked items are not claims that a legal obligation has already been fulfilled.

Much of the concept is technically feasible within the existing Nuxt/Directus
stack, and several proposed safeguards already exist. The largest gaps concern
publication defaults, evidence of acceptance and rights, mail approval,
moderation and operational processes.

Prioritise Wahlcheck answer URLs, automatic public uploads, mail approval and
quotas, consent evidence, and the legal-reporting workflow.

The assessment covers the repository and official legal sources checked on the
assessment date. Production configuration, contracts, existing content licences
and internal procedures need operator verification. German counsel should confirm
applicability and approve the final legal texts.

## Priorities and interpretation

- **P0:** address promptly.
- **P1:** planned implementation.
- **P2:** recurring improvement.

These are proposed delivery priorities, separate from whether a particular legal
obligation applies. References retain the original German requirement numbers.
Related requirements are combined where they share an implementation.

## Applicability and agreements

- [ ] **P0 — Establish the legal classification first. [REQ-18]**

  Assess the actual services separately: local-team assessments, submitted
  projects, candidate answers, uploads and SLK's editorial publications. Public
  dissemination of third-party submissions supports investigating hosting/platform
  classification; the economic-service element and SLK's editorial responsibility
  also matter.

  Record the operator, activities, staff and financial figures, and relevant
  partner/linked organisations. A nonprofit label alone does not settle the
  classification or size exemption.

  **Legal correction:** micro/small-enterprise exemptions do not generally remove
  hosting obligations under Articles 16–18. Article 15 reporting and additional
  platform obligations have separate exemptions; Article 24(3) information on
  request survives the Article 19 exemption. Where additional platform obligations
  apply, assess internal complaints, out-of-court redress, transparency reporting
  and other applicable procedures. [DSA](https://eur-lex.europa.eu/legal-content/en/ALL/?uri=CELEX:32022R2065)

  **Impact:** classification determines which additional mechanisms are compulsory.
  Implementing the core reporting process remains useful while classification is
  resolved.

- [ ] **P0 — Repair the existing agreement process. [REQ-01]**

  **Current:** SLK already has `agreement_versions`, `user_consent` and a
  [consent extension](../src/directus/extensions/consent-management/src/consent/endpoint/index.ts).
  However, legal texts remain editable, the acceptance request identifies no
  displayed document version, and inserts use parallel calls rather than a
  transaction. A document changed between display and submission could therefore
  produce misleading acceptance evidence.

  Make released versions immutable through normal application permissions. Record
  the exact version, language, text hash, authenticated user and server timestamp.
  Accept only the versions actually displayed; enforce uniqueness and
  transactional writes.

  **Options:** gate all contributor writes pending acceptance, or gate only the
  functions affected by a contractual change. Preserve access to legal documents,
  account-security functions and rights requests.

  **Impact:** contributors may encounter an acceptance screen; public visitors need
  no general acceptance wall. Renewed agreement depends on a valid contractual
  change process, rather than every editorial correction.
  [Section 305 BGB](https://www.gesetze-im-internet.de/bgb/__305.html)

- [ ] **P0 — Separate contractual acceptance, privacy information and optional consent. [REQ-01, REQ-28]**

  The current module requires users to accept both terms and the privacy policy
  and gates reads as well as creates/updates.

  Present the privacy notice as information. Where processing relies on consent,
  request that consent separately for its specific purpose, with withdrawal. Keep
  newsletter consent optional. Review enforcement across deletes and
  custom/elevated operations too; the generic item hook does not establish complete
  coverage.

  **Impact:** clearer choices and fewer unnecessary account lockouts. A
  privacy-policy acknowledgement must not imply consent to every processing
  activity. [GDPR Articles 6–7 and 13–14](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)

- [ ] **P0 inventory, P1 migration — Establish rights for existing content. [REQ-02]**

  Inventory texts, images, attachments, imported datasets and jointly edited
  assessments. Store rights status separately from publication status: existing
  documented permission, newly confirmed permission, unresolved, or prohibited.

  **Options:** request confirmation against a fixed list of content/version IDs;
  retain material under documented existing permissions; replace or withdraw
  material whose necessary rights cannot be established.

  Account acceptance cannot establish ownership of every contribution or grant
  rights held by another author. Historical permissions may already cover some
  uses, depending on their scope.
  [Section 31 UrhG](https://www.gesetze-im-internet.de/urhg/__31.html)

  **Impact:** contributor follow-up and editorial review. Some material may remain
  published under its existing licence while being excluded from broader reuse.

- [ ] **P1 — Introduce structured rights metadata and a mixed-licence policy. [REQ-03]**

  **Current:** author and image-credit fields exist, and the data explorer already
  has attribution utilities. There is no consistent rights model across
  contributed content.

  Add licence/version, rights holder, attribution wording, source, modification
  information, permission evidence and permitted uses. Carry these into relevant
  pages, API DTOs and exports. Route missing or incompatible rights information to
  review before publication under the proposed licence.

  **Options:** permit several supported licences with explicit exceptions, or
  accept only original/suitably licensed contributions into particular
  collections.

  **Legal correction:** third-party material need not all become CC BY-NC-SA.
  Collections can contain separately licensed works; adaptations have different
  compatibility rules. Copyright permissions also do not settle privacy or
  personality rights. [Creative Commons guidance](https://creativecommons.org/faq/),
  [BY-NC-SA legal code](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en)

  **Impact:** additional submission fields and review, but more reliable
  attribution and export permissions. Software cannot conclusively verify
  ownership from a checkbox.

- [ ] **P1 — Extend existing revision history into usable evidence. [REQ-04]**

  Preserve Directus activity/revisions and Blökkli's revision controls. Identify
  custom database writes that bypass ordinary revisions, and record significant
  assessment changes with actor, timestamp, affected version and reason.

  **Options:** retain native revisions with a restricted review/export tool, or
  add immutable snapshots for published assessments and legally significant
  events.

  **Impact:** internal accountability without publishing contributors' identities
  or sensitive revision contents. Define retention and access separately from
  ordinary operational logs.

## Access control and uploads

- [ ] **P0 — Verify the existing access model and close exceptional paths. [REQ-05, REQ-06]**

  The repository already has scoped roles, checked public DTOs, server-only
  credentials and publication-aware reads. Preserve this architecture rather than
  replacing it with the concept's example role names.

  Test additive/inherited permissions, cross-team and SLK/LocalZero boundaries,
  custom extensions, flows, shares, files, previews and static tokens. The dormant
  [Frontend-Public policy](../src/directus/policies/Frontend-Public.yaml) permits
  unrestricted file reads despite its description; verify assignments and retire
  or narrow that identity through an authorised migration.

  Public submissions also use an administrator credential server-side. Consider
  dedicated, narrowly privileged ingestion operations.

  **Impact:** mostly administrative changes. No public-role expansion is needed.

- [ ] **P0 — Provide and test coordinated access revocation. [REQ-07]**

  Website sessions already support logout/revocation, but this does not establish
  immediate revocation across every credential type.

  Provide a controlled operation covering membership removal, account suspension,
  CMS sessions, website sessions, static tokens and applicable candidate/preview
  credentials. Verify behaviour using an already-issued access token. Record the
  trigger, scope, time and relevant notification.

  **Options:** use native revocation where it meets the required timing; otherwise
  add an account revocation/version check at the relevant request boundary.

  Review [editor deletion](../src/directus/extensions/editor-manager/src/delete-editor/api.ts):
  its operation resolves users by email and deletes accounts. Removing a local
  relationship should have a separately defined effect.

  **Impact:** affected sessions stop working; membership removal becomes safer for
  people serving multiple teams.

- [ ] **P0 for privileged users — Enforce MFA through supported login flows. [REQ-08]**

  Checked-in human policies currently use `enforce_tfa: false`. Individual accounts
  may already have MFA, but mandatory enforcement is not established.

  **Options:** enforce native Directus TOTP and add OTP handling to the website
  editor login, or integrate an identity provider enforcing MFA. The
  [website login](../src/frontend/server/api/editor/session/login.post.ts)
  currently accepts only email/password, so enabling enforcement alone can break
  access.

  Add recovery/offboarding procedures, privileged-access reviews and suitable
  password/brute-force controls. Preserve security-relevant administration audit
  events and the existing patch workflow.

  **Impact:** an extra login step and recovery support. MFA is a risk-based security
  measure here, rather than a universal statutory requirement for every account.

- [ ] **P0 — Apply upload safeguards consistently across entry points. [REQ-09]**

  **Current:** public project submissions allow JPEG/PNG/WebP, check size and basic
  signatures, and require image-rights confirmation. Editor uploads have size/rate
  limits. These controls do not establish equivalent protection for direct CMS
  uploads/imports.

  **Options:** use a central upload-validation hook, or route less-trusted uploads
  through a constrained ingestion service. Decode and re-encode raster images
  with pixel/resource limits. Give PDF, SVG, office files and archives separate
  policies; add scanning or quarantine where justified. Bound upload volume and
  storage consumption as well as individual request size.

  **Impact:** some formats are rejected or require review; processing adds latency
  and resource use. Tests should cover malformed images, active content, oversized
  dimensions and direct API bypasses.

- [ ] **P0 — Make file publication explicit and remove unnecessary metadata. [REQ-10]**

  The [public-assets hook](../src/directus/extensions/custom-slk-interfaces/src/public-assets/index.ts)
  moves images without a selected folder into `public`. Consequently, uploading
  an image can publish it independently of a page.

  **Option A, recommended:** retain private originals and explicitly release
  sanitised public copies. This fits the existing public-folder boundary.

  **Option B:** serve private originals through an owner/publication-aware
  endpoint. This gives finer control but requires more relationship and caching
  logic.

  Strip unnecessary EXIF/GPS and review exposed file metadata. Preserve required
  credits through structured fields. Explain public release and confidential-data
  restrictions before upload.

  **Impact:** editors gain a release step; abandoned drafts stay private.
  Withdrawal must cover originals, transformed variants, previews and caches.
  Audit existing assets before changing defaults.

## Content quality and moderation

- [ ] **P1 — Connect provenance, methodology and corrections. [REQ-11, REQ-12]**

  Reuse existing authorship, verification, assessment approval and catalogue
  information. Display who contributed the content, what review actually
  occurred, the assessment date and methodology version. Define precisely what
  reviewed means.

  Link correction reports to the affected assessment and revision. Record the
  correction, reviewer and reason; support a municipal/local-team response where
  appropriate.

  **Options:** reuse feedback cases with structured references, or create a
  dedicated correction workflow.

  **Impact:** clearer context and some additional editorial work. Municipalities
  as legal entities do not acquire GDPR rights merely because they receive a
  score; statements about identifiable people need separate consideration.

- [ ] **P0 — Extend the public contact form into a compliant reporting mechanism. [REQ-13]**

  **Current:** `/contact` and
  [submit-feedback](../src/frontend/server/api/submit-feedback.post.ts) already
  support legal and factual-error reports. They require name/email and lack
  dedicated content-location and good-faith fields. Optional message copies are
  not a complete acknowledgement/decision process.

  Add structured location, explanation, declaration, case reference and
  notification handling. Support the statutory contact-data exception. Provide an
  accessible alternative if CAPTCHA or JavaScript prevents submission.

  Missing fields should not automatically cause potentially actionable reports to
  be disregarded. [Bundesnetzagentur guidance](https://www.bundesnetzagentur.de/DE/Fachthemen/DSC/1_Themen/PflichtenVermittlunggsdienste/start.html)

  **Impact:** outsiders can report without accounts; moderators receive more
  actionable cases.

- [ ] **P0 — Add moderation cases and reasoned decisions. [REQ-14, REQ-15]**

  Existing feedback records already have statuses and an internal response
  summary. Extend them, or create related moderation cases containing restricted
  evidence, content/revision references, legal or contractual basis, decision,
  reviewer, scope/duration, notifications and review outcome. Record any automated
  means used.

  **Options:** Directus case management keeps everything within the current stack;
  an external ticket system offers assignment/escalation features but adds
  integration and provider obligations.

  Use reversible restriction actions covering public APIs, search, media, exports
  and social images. Generate separate communications for reporters and affected
  contributors, protecting reporter identity and explaining available redress.

  **Impact:** decisions require recorded reasons and follow-up. Case statuses are
  implementation choices; their exact names are not prescribed by law.

- [ ] **P0 — Establish emergency and authority-order handling. [REQ-16]**

  Create an escalation procedure and a tested means to restrict content/assets
  immediately. Separate criminal-threat reports, authority orders, privacy
  breaches and general security incidents because their duties and clocks differ.

  Article 18 concerns suspected offences involving threats to life or safety; it
  is not a general duty to report every suspected offence.
  [DSA Article 18](https://eur-lex.europa.eu/legal-content/en/ALL/?uri=CELEX:32022R2065)

  Also assess terrorist-content regulation applicability: qualifying removal
  orders can require action within one hour.
  [Regulation 2021/784](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32021R0784)

  **Impact:** named cover and a tested escalation channel are needed. Avoid routine
  email forwarding, downloading or uncontrolled copying of suspected child
  sexual-abuse material.

- [ ] **P0 — Publish and staff the required contact points. [REQ-17]**

  Publish clearly identified authority and user contact routes, supported
  languages and responsibility for escalation. These can share infrastructure
  where it meets the different requirements; no particular mailbox naming
  convention is mandatory.

  Include a human communication route and test receipt, absence cover and delivery
  failures.

  **Impact:** little frontend work, but continuing operational responsibility. A
  published address alone does not establish a functioning process.

## Election checks and email

- [ ] **P0 — Enforce election-mail approval on the server. [REQ-19]**

  **Current:** election actions check the caller's scoped access. However, the
  [sending handler](../src/directus/extensions/election-check/src/send-candidate-mails/api.ts)
  does not enforce `is_approved`; approval also is not bound to an immutable
  message/recipient version.

  **Option A:** central approval of a frozen dispatch containing theses,
  templates, recipients and relevant rendering inputs.

  **Option B:** approved locked templates, with local teams allowed to send only
  within a separately approved recipient scope.

  Reject sending after relevant changes until approval is renewed. Protect
  manual-flow and other invocation paths too.

  **Impact:** additional approval when content or recipients change. Two-person
  approval is a sensible safeguard, rather than a generally prescribed legal
  mechanism.

- [ ] **P0 — Limit actual message delivery, including CC recipients. [REQ-20]**

  Gateway request limits do not adequately limit a request that sends an entire
  batch. Add persistent quotas per account, election, recipient and system,
  reserved before delivery, plus dispatch locking, duplicate protection and a kill
  switch.

  Validate all recipient fields, including configurable CC and reply-to. Review CC
  copies of invitation emails: they contain candidate access links and therefore
  extend access to those mailboxes. Preserve the controlled sender identity.

  **Options:** enforce quotas in the existing sender, or introduce a durable
  queue/outbox for paced delivery and better recovery.

  **Impact:** large sends may take longer and repeated sends may require
  intervention. Verify SPF/DKIM/DMARC and bounce/complaint handling against the
  actual production mail service.

- [ ] **P1 — Keep a restricted dispatch record. [REQ-21]**

  Current flags such as `already_sent_mails` and per-candidate log events are
  insufficient to reconstruct the approved message and historical recipient set
  reliably.

  Store approval and triggering identities, immutable template/thesis references,
  recipient snapshot, send status and provider reference. Keep sensitive content
  out of ordinary logs. Treat uncertain delivery separately from confirmed
  failure. Define retention for dispatches and response associations.

  **Impact:** better complaint handling and selective retries, with additional
  restricted personal-data retention. Avoid blindly resending a whole batch after
  partial failure.

- [ ] **P1 — Publish and preserve election methodology. [REQ-22]**

  Document thesis selection, sources, weighting, matching calculation, treatment of
  missing answers and publication dates. Preserve the version actually used for an
  election; do not silently alter its historical basis. Preserve candidate/party
  answers accurately and distinguish missing answers from substantive scores.

  **Options:** centrally maintained methodology with recorded local additions, or
  locally proposed methodologies approved before use.

  **Impact:** additional review and clearer explanations for visitors and
  candidates. Partisan neutrality concerns the actual activity and statutory
  purpose, not merely the presence of a methodology page.
  [Federal Fiscal Court](https://www.bundesfinanzhof.de/de/entscheidung/entscheidungen-online/detail/STRE202110007/)

- [ ] **P0 — Prevent automatic disclosure of visitors' political answer profiles. [REQ-23]**

  The [Wahlcheck flow](../src/frontend/components/Elections/WahlCheckFlow.vue)
  calculates answers locally and uses `sessionStorage`, but automatically writes
  the answers and weights into a `?share=` URL on the results step. Base64 encoding
  is reversible. Reloading or sharing can send that profile to servers, recipients
  and analytics; the tracker constructs events using `location.href`.

  **Option A, recommended:** keep ordinary result URLs free of answers and generate
  a fragment-based link only after an explicit sharing action. Exclude profile
  data from analytics.

  **Option B:** share only a locally generated result image or generic election
  link.

  **Option C:** server-hosted result links, with a separately assessed legal basis,
  expiry and deletion process.

  **Impact:** sharing becomes deliberate. Fragments reduce HTTP disclosure but
  remain readable by page scripts and link recipients. Candidate political data
  needs its own Article 6/9 assessment; public availability is not unlimited
  permission.

## Privacy and operations

- [ ] **P0 — Complete the processing inventory and verify public defaults. [REQ-24, REQ-28]**

  Map registration, contributions, contacts, uploads, histories, candidate records,
  mail, feedback, moderation, logs, Redis, search, translations and backups to
  purposes, legal bases, recipients, access and deletion rules.

  Preserve good existing defaults: for example, public team display defaults to
  false. Verify public author names, contact fields, filenames and metadata
  separately.

  **Options:** maintain the register in controlled documents initially, or use a
  structured internal register with owners/review dates.

  **Impact:** mainly organisational work. Small associations commonly still
  require records because processing is ongoing.
  [Association guidance](https://www.baden-wuerttemberg.datenschutz.de/faq-vereine/)

- [ ] **P0 — Implement a rights-request and deletion workflow. [REQ-25]**

  Start with a documented, authorised manual process plus repeatable
  export/deletion tools. Self-service account deletion can follow once
  dependencies are understood.

  Search by account IDs and relevant contact references, including anonymous
  submissions. Review shared content, attribution, revisions, files, mailboxes,
  translations and search indexes. Separate account closure, membership removal,
  content withdrawal and personal-data erasure.

  Add legal holds, deletion records and a restore procedure that reapplies
  deletions before restored data becomes public. Include rectification,
  restriction and objection handling.

  **Impact:** shared assessments can survive account closure where justified.
  Exports need review to protect others' information. Requests generally require
  a response within one month; portability has narrower conditions than general
  access. [Commission guidance](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en)

- [ ] **P0 — Establish the breach-response process. [REQ-26]**

  Define incident intake, decision-maker, deputy, containment, evidence handling,
  affected-data analysis and notification templates. Record breaches and
  notification decisions.

  Notify the supervisory authority without undue delay and, where feasible,
  within 72 hours of awareness unless the breach is unlikely to create risk.
  High-risk breaches can require notification to affected people without undue
  delay. Initial reports can be supplemented.
  [EDPB guidance](https://www.edpb.europa.eu/system/files/documents/2025-03/edpb_summary_092022-012021_data_breach_en.pdf)

  **Impact:** training and periodic exercises; no automatic regulator reporting
  from an unreviewed alert.

- [ ] **P1 — Turn backup tooling into demonstrated recovery capability. [REQ-27]**

  The repository already contains encrypted off-host backups, rollback
  checkpoints, verification and retention tooling. Run and record isolated
  restoration exercises, including database, uploads, secrets and application
  dependencies. Set recovery-time and recovery-point objectives.

  **Implementation detail:** retaining five snapshots or releases does not
  establish a maximum retention period. Rare releases and failed nightly jobs can
  leave old personal data in backups for much longer.

  **Impact:** recurring operator time and isolated infrastructure. Development
  restores containing real data require restricted access, blocked real-world
  mail/integrations and an explicit handling policy.

- [ ] **P0 — Assign owners and usable procedures. [REQ-29, REQ-30]**

  Assign primary/deputy responsibility for legal reports, authority requests,
  privacy incidents, security incidents, election approval and rights complaints.

  Provide short decision trees, escalation contacts, evidence rules, restoration
  procedures and handover instructions. Use separate access for especially
  sensitive cases.

  **Options:** trained volunteer cover with external legal escalation, or
  contracted support for defined gaps.

  **Impact:** continuing staffing commitments. The software can assign cases and
  deadlines; it cannot supply legal judgement or absence cover.

- [ ] **P1 — Inventory providers and partner responsibilities. [REQ-31]**

  Include hosting, SMTP, backups, analytics, newsletter, Cal.com, media embeds,
  DeepL and the configured Mistral integration—not just Directus.

  Determine processor, independent-controller or possible joint-controller
  relationships. Review contracts, subprocessors, locations, remote support
  access, transfer mechanisms and deletion terms. The SLK/LocalZero data category
  does not itself establish the legal relationship between organisations.

  **Impact:** contractual work and potentially changed service configurations.
  Not every provider relationship calls for an Article 28 processing agreement.
  [Berlin authority guidance](https://www.datenschutz-berlin.de/themen/unternehmen-und-vereine/auftragsverarbeitung/)

- [ ] **P1, before risky processing — Record DPIA screening. [REQ-32]**

  Screen identifiable political profiles, candidate data, AI use, monitoring and
  any future cross-service tracking. Consider necessity, scale, vulnerable users,
  linkage and safeguards.

  **Options:** retain a minimal browser-only Wahlcheck design, or introduce
  identifiable profiles only after the additional legal and risk assessment.

  **Impact:** the first option substantially reduces operational complexity. A
  full DPIA is required where likely high risk exists; every feature does not
  automatically require one.

- [ ] **P2 recurring, with immediate ownership — Review effectiveness. [REQ-33]**

  Schedule permission reviews, report-handling exercises, deletion samples,
  restore tests, licence samples and mail-abuse checks. Give findings owners and
  due dates.

  Preserve the existing dependency/image audits and Directus **11.17.4**
  constraint. Reviewed backports and mitigations need ongoing reassessment: at
  the assessment date, the repository's image-advisory review expires
  **24 November 2026**. Check the current review before relying on this dated
  observation.

  **Impact:** predictable maintenance work. Record deployed-artifact verification
  separately from repository test results.

## Additions to the original concept

- [ ] **P0 — Verify legal notices and collection-specific privacy information.**

  Check the operator identification, applicable register/representation details
  and editorial responsibility under DDG/MStV. Provide privacy information at
  registration, submissions, candidate contact and reporting—not only a general
  footer link. Address Article 14 information where personal data comes from
  public sources.

  Local requests during the assessment returned **404** for `/datenschutz` and
  `/impressum`; the local homepage also lacked normal CMS content. Verify routes,
  imported content and navigation in each deployed environment. These local
  observations do not establish what production serves.
  [Section 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html),
  [Section 18 MStV](https://www.gesetze-bayern.de/Content/Document/MStV-18)

  **Impact:** legal/editorial review, content publication and route/link repairs
  where needed.

- [ ] **P0 — Assess browser storage, analytics and external embeds.**

  Browser-local processing is not automatically outside privacy law. Assess
  `sessionStorage`, preferences, analytics and external services individually
  under section 25 TDDDG and GDPR.

  **Options:** minimise nonessential processing and use click-to-load external
  content, or provide granular consent where required. Existing
  YouTube/Vimeo/Cal.com embeds need this review; lazy loading alone does not
  establish consent.

  **Impact:** an extra activation step for external content or a preference
  interface. Essential service storage may qualify for an exception.
  [Section 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html)

- [ ] **P0 — Reconcile newsletter withdrawal and assess outreach legality.**

  The public newsletter route uses Listmonk's double opt-in. The CMS consent
  endpoints manipulate local records without visible Listmonk synchronisation;
  opt-out deletes only the current-version consent.

  Make actual subscription state and withdrawal authoritative across both
  systems, while retaining only necessary consent evidence. Separate newsletter
  marketing, transactional messages and candidate invitations. A published email
  address alone does not settle outreach permission.
  [Section 7 UWG](https://www.gesetze-im-internet.de/uwg_2004/BJNR141400004.html)

  **Impact:** reliable unsubscribing and fewer contradictory subscription
  indicators.

- [ ] **P1 — Screen political-advertising activities.**

  Assess sponsored election content, paid promotion, commissioned campaigns and
  targeting under Regulation 2024/900. Editorial election information and
  political advertising require different treatment; internal activities can
  also be relevant.

  **Options:** operate a documented editorial model, or implement the applicable
  sponsor/advertisement transparency requirements for advertising activities.

  **Impact:** campaign approval and potentially public disclosures. Keep visitor
  answer profiles out of advertising targeting.
  [Political-advertising regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R0900)

- [ ] **P1 — Determine accessibility obligations and test essential journeys.**

  Assess BFSG scope against actual services and contracts, its microenterprise
  service exemption, and any public-sector/funding obligations. A public website
  does not automatically fall within every BFSG requirement.

  Independently test keyboard/screen-reader access to registration, reporting,
  consent, Wahlcheck, authentication and document alternatives.

  **Impact:** frontend and content remediation. Existing responsive/focus tests
  provide partial evidence, not complete accessibility acceptance.
  [Federal accessibility guidance](https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/FAQ/faq_node.html)

- [ ] **P1 — Determine whether a formal data protection officer is required.**

  Assess GDPR Article 37 and section 38 BDSG, including regularly engaged people
  rather than assuming only payroll employees count. Some processing triggers
  apply independently of headcount.

  **Impact:** potentially an independent internal appointment or external service.
  Assign a privacy owner regardless of whether formal designation is compulsory.
  [Section 38 BDSG](https://www.gesetze-im-internet.de/bdsg_2018/BJNR209710017.html)

- [ ] **P1 — Govern AI-assisted research and publication.**

  Inventory Mistral access and DeepL translation, permitted inputs, provider
  handling, training, review and publication responsibility. The translation
  pipeline already restricts itself to checked public sources; preserve that
  boundary.

  **Options:** require human review/editorial responsibility, or disclose relevant
  unreviewed AI-generated/manipulated public-interest text where Article 50
  applies. Assess actual functionality before assigning obligations.

  **Impact:** review work or additional provenance labels. A system prompt alone
  cannot enforce confidential-data handling or publication safeguards.
  [Commission AI transparency guidance](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)

## Implementation and acceptance

Preserve the existing code-first YAML/import workflow, private server identities,
checked DTOs and supported components. Do not expand public-role permissions.
Update [FEATURES.md](../FEATURES.md) with exact coverage for each implemented
application change. Consult [PROJECT_DECISIONS.md](../PROJECT_DECISIONS.md) and
[AGENTS.md](../AGENTS.md) before implementation; follow the design guidelines for
appearance or interaction changes.

Prioritise targeted regressions for:

- Stale-version agreement acceptance and transactional evidence.
- Private-upload access through metadata, originals and transformed variants.
- Server-side election-mail approval and delivery-quota bypass attempts.
- Revocation with already-issued tokens and active sessions.
- Complete content withdrawal across API, search, media and generated previews.
- Absence of visitor answer profiles from ordinary URLs, analytics and other
  network traffic.

## Assessment verification and limits

The assessment was read-only. The required full `./bin/slk check ready` run on
22 November 2026 completed unsuccessfully: a host-logging unit test failed on an
unresolved template marker, which blocked development regressions. Types, lint,
extension builds, production build, dependency audit, reviewed image audit, Caddy,
formatting and diff checks passed. The local private report is
`.reports/checks/2026-11-22T11-24-52-447Z-d3x3H6/report.json`; it is not a tracked
deliverable or a production security sign-off.

Native and deployed acceptance remain pending. Production permissions, DNS/mail
delivery, provider contracts and operational procedures were not verified.
Existing test references describe partial coverage; unchecked checklist items
require their own implementation and acceptance evidence before being marked
complete. This inventory of relevant issues is not a certification of exhaustive
legal compliance.
