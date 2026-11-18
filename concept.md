# SLK participation funnel

## Concept

**One invitation, two ways to contribute, one booked onboarding.**

A focused `/mitmachen` page guides visitors from “I want to participate” to a confirmed onboarding appointment. Each screen asks for one decision. Local participation and building SLK have distinct entry routes, then share account creation and booking.

The interface uses German copy. This concept is in English for review. Organisation areas and projects below are explicitly illustrative: the actual organisation chart, project inventory, brand system, existing authentication and calendar setup were not supplied. The clickable prototype simulates registration and appointments; it creates no accounts or bookings.

## Journey

```text
                                 /mitmachen
                                     │
                          How do you want to join?
                         ╱                         ╲
                 BUILD SLK                         LOCAL
                     │                               │
           Areas and/or projects             Choose 1–3 tools
                     │                               │
                     │                      Select municipality
                     ╲                               ╱
                       Create or sign in to account
                                     │
                           Verify email ownership
                                     │
                         Choose an onboarding slot
                                     │
                           Appointment confirmed
```

Use four stable progress labels: **Dein Weg → Interessen → Konto → Termin**. For local participants, municipality is a second screen within Interessen. Do not imply that the two routes have identical numbers of screens. Back navigation preserves answers; changing routes preserves each route’s draft separately. The initial choice describes the person’s current starting point; they can add the other kind of participation after onboarding.

## Screen concepts and wireframes

### 1. Entry: two equal invitations

```text
 SLK · Mitmachen                  Dein Weg — Interessen — Konto — Termin

                     Wie möchtest du mitmachen?
                       Dein Einstieg. Dein Beitrag.

 ┌─────────────────────────────┐ ┌─────────────────────────────┐
 │        [connected nodes]    │ │         [local places]      │
 │                             │ │                             │
 │ SLK mitgestalten            │ │ Vor Ort aktiv werden        │
 │ Gemeinsam SLK weiterbringen. │ │ In deiner Kommune loslegen. │
 │                             │ │                             │
 │ [ SLK mitgestalten → ]      │ │ [ Lokal mitmachen → ]       │
 └─────────────────────────────┘ └─────────────────────────────┘

                    Du kannst später beides machen.
```

Desktop: a genuine 50/50 split, building SLK on the left and local participation on the right. Mobile: two stacked cards with equal prominence; the first must not occupy an entire screen. Make the whole card a single accessible button. Selecting it advances immediately, since there is only one choice and the action is reversible. No additional “Continue” screen.

### 2A. Local: choose tools

```text
 ← Zurück                                      Interessen

                    Was möchtest du vor Ort tun?
                         Mehrfachauswahl möglich.

 ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
 │ ☑ Ranking      │ │ □ Wahlcheck    │ │ ☑ Erfolgsprojekt│
 │ Am SLK-Ranking │ │ Den Wahlcheck  │ │ Ein Projekt vor │
 │ mitarbeiten.   │ │ vor Ort nutzen.│ │ Ort angehen.    │
 └────────────────┘ └────────────────┘ └────────────────┘

 2 ausgewählt                                  [ Weiter → ]
```

Select any combination of Ranking, Wahlcheck and Erfolgsprojekt. Each choice has a recognisable icon, exact product name, one short outcome sentence and a visible checked state. Keep all three visible. Continue requires at least one selection. Show a clear hint when nothing is selected. Tool descriptions should be checked by the respective SLK owners before release.

### 3A. Local: municipality

```text
 ← Zurück                                      Interessen

                     Wo möchtest du aktiv werden?

                     Kommune oder Postleitzahl
                     [ Freiburg                      ]
                     ┌───────────────────────────────┐
                     │ Freiburg im Breisgau · BW      │
                     │ Freiburg (Elbe) · Niedersachsen│
                     └───────────────────────────────┘

                          [ Weiter zum Konto → ]
```

Use autocomplete backed by a municipality directory, with municipality ID, state and district where needed to distinguish names. Searching by postcode must still return municipality choices where the postcode is ambiguous. Accept selection using keyboard, pointer and touch. For unlisted municipalities, offer “Meine Kommune fehlt” and retain the entered name for later review; do not strand a willing participant. Do not request street address, telephone number or a profile. Continue goes directly to account creation.

The prototype uses a plain municipality field to illustrate the screen without inventing a real directory integration.

### 2B. Build SLK: interests and current projects

```text
 ← Zurück                                      Interessen

                     Wo möchtest du mitgestalten?
                          Wähle, was dich anspricht.

 Bereiche
 [☑ Technik & Produkt] [□ Kommunikation] [□ Community] [□ Organisation]

 Aktuelle Projekte
 ┌─────────────────────────────┐ ┌─────────────────────────────┐
 │ □ Tool-Erlebnis verbessern  │ │ ☑ Neue Kommunen begleiten   │
 │ Technik & Produkt           │ │ Community                   │
 └─────────────────────────────┘ └─────────────────────────────┘

 [ Noch offen? Gemeinsam finden wir deinen Einstieg. ]
                                              [ Weiter zum Konto → ]
```

Area names come from the existing organisation chart, presented as plain-language areas of interest rather than an internal hierarchy people must understand. Visitors can choose one or more areas, projects, or both. A project alone is sufficient; its linked area informs routing without being silently added to the visitor’s explicit selections. “Gemeinsam finden” is a valid undecided state and clears conflicting explicit choices; selecting an area/project clears that state.

Show both areas and projects on this screen. If many projects exist, show a short, editorially ordered set with an expandable “Weitere Projekte”; do not add mandatory filters. Selected items remain visible when the list changes. Display one brief contribution/task line when available. Optional details open inline, with the selection retained. Only show projects actively seeking contributions. If none are open, areas and the undecided option still provide a complete route.

The area and project names in this wireframe and prototype are **examples**, not SLK’s confirmed organisation structure or live opportunities.

### 4. Shared account: minimal identity, then verification

```text
 ← Zurück                                          Konto

                         Dein Einstieg ist fast geschafft.
                         Lokale Teilnahme · Freiburg
                         Ranking, Erfolgsprojekt  [ändern]

                         E-Mail-Adresse
                         [ du@beispiel.de             ]
                         [ Weiter mit E-Mail →        ]

                         Bereits ein Konto? Anmelden
                         Datenschutz · Nutzungsbedingungen
```

Prefer a passwordless email code if the existing authentication system supports it. Otherwise use its existing secure registration/sign-in flow, with the same funnel context retained. Ask for email first. Collect the name once, at the latest when required for the calendar invitation. Existing users sign in and continue at the same point; do not create duplicate accounts. Avoid exposing account existence through differing error messages.

```text
 ← E-Mail ändern                                   Konto

                         Prüfe dein Postfach.
                         Code an deine E-Mail gesendet.

                         Bestätigungscode
                         [  _ _ _ _ _ _  ]
                         [ Bestätigen & Termin wählen → ]
                         Code erneut senden
```

Support code paste, resend, expiry and recovery without losing interests. Create/activate the account and attach its participation draft only after the required verification succeeds. Show relevant policy links; any required terms acceptance is explicit. Marketing choices, if offered later, are separate and optional.

### 5. Shared booking: relevant availability, no repeated questionnaire

```text
 ← Zurück                                           Termin

                    Lass uns deinen Einstieg planen.

 SLK-Onboarding                  Dezember 2026
 Online · 20 Minuten*            [ Di 1 ] [ Mi 2 ] [ Do 3 ]
 Dein Weg: Lokale Teilnahme
                                 [ 10:00 ] [ 14:00 ] [ 17:00 ]
 Name für die Einladung
 [ Vor- und Nachname       ]     Zeitzone: Europe/Berlin [ändern]

                                  [ Termin verbindlich buchen → ]
```

_Twenty minutes is a proposed onboarding duration, subject to team capacity._ Route local participants to the local onboarding team, and SLK builders to the relevant area/project team. Use a general onboarding fallback for multiple unrelated selections or undecided visitors; never require visitors to choose an internal host. The routing owner maintains explicit priorities for overlapping interests.

Use an embedded calendar, for example Cal.com, so booking stays in the funnel. Reuse verified identity and relevant preferences through a server-side handoff; do not ask the same questions again. Show the visitor’s timezone and allow changes. Date and time are explicit choices; do not silently choose an appointment.

If the embed fails, offer a normal booking-page link with a resumable funnel. If no appointments are available, show the next available dates or an explicit request for the team to offer a time. Record that as `awaiting_availability`, never as a confirmed booking. A slot taken during booking returns the visitor to availability with their account and preferences intact.

### 6. Confirmation: an appointment, not just a thank-you

```text
                              ✓
                         Dein Termin steht.

                         SLK-Onboarding
                         Di, 1. Dezember · 14:00
                         Europe/Berlin · Online

                         [ Zum Kalender hinzufügen ]
                         Einladungs-E-Mail mit Meeting-Link.
                         Termin ändern · Absagen

                         [ Zu deinem SLK-Bereich → ]
```

Show confirmation only after the provider has confirmed the booking. Include date, timezone, duration, join link, calendar action and reschedule/cancel links. The account area also shows these details and the selected participation route. Send the invitation and a small, agreed reminder sequence; onboarding attendance is the downstream outcome. Avoid asking for more profile fields on this success screen.

## Visual direction and motion

- **Layout:** generous whitespace, a restrained SLK wordmark, four progress labels, one headline, one decision and one main action per screen. Remove campaign-site navigation from the funnel.
- **Identity:** an editorial sans-serif, large concise headings, dark neutral text and a vivid green accent as a proposed direction. Replace these with SLK’s actual brand tokens during implementation. Use simple line icons and abstract local/network motifs, not stock photography.
- **Controls:** large click targets, short descriptive labels, conspicuous selected states, persistent Back and a stable action position. Retain focus outlines, visible input labels and inline errors.
- **Motion:** 180–240 ms transitions, small directional movement between steps, quick checkbox feedback and gentle hover elevation. No autoplay carousels, scroll hijacking, bouncing buttons or motion-dependent meaning. Honour reduced-motion settings.
- **Mobile:** stack the split-screen choices and tool cards; wrap area chips; keep the primary action in normal document flow. Use a compact booking layout with timezone always available. Preserve 44 px touch targets and readable input text.
- **Accessibility:** semantic headings, keyboard navigation, labelled form controls, checked states, focus management after screen changes and a polite live selection count. Use more than colour to indicate selection and progress.

## Directus content and data concept

Treat content publishing, identity and participation records as separate concerns. Reuse existing collections where possible. Directus supports the collections, fields and relationships required for this model; these are proposed SLK collection names, not built-in Directus features. [Directus data modelling documentation](https://directus.com/docs/getting-started/data-model).

| Proposed collection                                       | Essential fields and relationships                                                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `participation_tools`                                     | Stable key, title, short description, icon, enabled, sort order. Initial entries: Ranking, Wahlcheck, Erfolgsprojekt.                                                                                   |
| Existing organisation collection, or `organisation_areas` | Stable ID, public label, optional short description, optional parent, published status, sort order, onboarding route. Avoid maintaining a duplicate org chart.                                          |
| `participation_projects`                                  | Title, one-line contribution, related area(s), `draft/open/paused/closed`, recruitment dates, optional detail, sort order, onboarding route. Editors can add opportunities without a deployment.        |
| `onboarding_routes`                                       | Logical route key, provider/event reference, responsible team, fallback route, enabled flag. Provider credentials stay on the server.                                                                   |
| `participation_intents`                                   | Authenticated user reference, route, tool/area/project relationships, municipality ID or unresolved name, undecided flag, lifecycle status. Separate junction collections support multi-select choices. |
| `onboarding_bookings`                                     | Intent reference, unique provider booking ID, status, start/end in UTC, display timezone, provider lifecycle timestamps. Reuse identity data instead of duplicating it unnecessarily.                   |

Anonymous visitors can read only the public, published recruitment fields. Participants can access their own intent and booking data through the application; editors manage content through appropriate roles. Interest selection never grants administrative or project permissions.

Save non-sensitive route choices locally during the funnel and transfer them into an authenticated draft after sign-in. Avoid retaining email or verification codes in local storage or analytics. After sign-in, drafts resume from the latest incomplete step across devices. If a project closes mid-session, explain the change and retain the broader area/general onboarding route.

## Booking integration

The recommended first implementation is an embedded calendar with server-side routing and a booking lifecycle receiver. Cal.com offers embedded booking and routing capabilities; verify the chosen plan/deployment against SLK’s requirements before implementation. [Cal.com overview](https://cal.com/about).

1. Read the authenticated intent and resolve the appropriate onboarding route on the server.
2. Hand the chosen event configuration and permitted identity fields to the booking interface. Pass only an opaque intent reference as metadata; keep interests and identity out of tracking URLs.
3. Receive and verify provider events. Apply repeated deliveries idempotently, keyed by provider booking ID and lifecycle event; handle out-of-order updates without reverting newer state.
4. Persist confirmed, rescheduled and cancelled states against the same intent. Distinguish a requested/pending booking from a confirmed appointment.
5. Refresh the success screen from server-confirmed booking state; do not depend on a browser callback alone. Invitation delivery and analytics must also avoid duplicates.

Cal.com documents booking-created, rescheduled and cancelled webhook events and webhook signature verification. [Cal.com webhooks](https://cal.com/docs/developing/guides/automation/webhooks).

## Conversion strategy and measurement

These are design hypotheses to validate, not guaranteed conversion improvements:

- Give two equally clear entry choices and defer account creation until visitors have expressed intent.
- Ask only for information that changes the next step. Defer CVs, biographies, skill ratings, availability questionnaires and telephone numbers.
- Use explicit multi-select feedback, preserve answers, allow undecided SLK builders and provide municipality/calendar fallbacks.
- Keep an exact summary at account creation, with an edit action, so visitors recognise what they are signing up for.
- Make account creation and appointment confirmation separate milestones. A booked appointment is the primary funnel outcome; attendance is the quality check.

Measure `funnel_viewed`, `path_selected`, `interests_completed`, `municipality_completed`, `account_verified`, `booking_viewed`, `booking_confirmed`, `booking_rescheduled`, `booking_cancelled` and `onboarding_attended`. Track step errors and availability failures separately. Avoid putting email, raw municipality text, codes or personal answers in event payloads; use permitted pseudonymous identifiers and coarse route information.

Primary rate: unique confirmed participants ÷ unique funnel entrants within an agreed attribution window. Report each route separately, plus account-to-booking conversion, mobile drop-off and attendance. Reschedules do not count as new conversions. Establish a baseline before testing alternatives. Start with entry-card wording and project-list length; evaluate attendance alongside booking rate.

## Scope and acceptance

The initial release includes both routes, CMS-managed interests/projects, municipality capture, existing-account recovery, verified account creation, calendar routing, confirmed booking and the essential recovery states.

Ready for implementation when:

- Both routes reach a provider-confirmed appointment on desktop and mobile; all Back/edit actions retain relevant choices.
- Local multi-selection and one-or-more build interests work, including project-only and undecided paths.
- Published project edits appear without frontend changes; paused/closed projects cannot silently recruit new participants.
- Municipality ambiguity, sign-in/verification failures, empty availability, calendar errors and slot conflicts all have a next action.
- The confirmation and account area reflect reschedules and cancellations without duplicate bookings or messages.
- Keyboard and reduced-motion operation work; critical funnel events and provider failures can be measured.

Inputs still to map: actual organisation areas and current projects, SLK brand tokens, municipality data source, authentication capabilities, calendar provider and team availability. These affect content and integration, not the proposed funnel structure.
