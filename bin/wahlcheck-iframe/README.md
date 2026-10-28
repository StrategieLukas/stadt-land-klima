# Wahlcheck iframe smoke test

A static HTML page for manually checking the real Wahlcheck in a foreign-origin
iframe. No build, npm installation, API proxy, header rewriting or application
configuration changes are needed to serve this page. The embedded frontend must
include the `/embed/wahlcheck/{municipalitySlug}` route from this checkout. The
small inline browser module selects that route and translates the test controls
into German, English or Italian.

From the repository root, run:

```bash
python3 -m http.server 8090 --bind 127.0.0.1 --directory bin/wahlcheck-iframe
```

Open <http://127.0.0.1:8090>. Paste the full URL of a published Wahlcheck into the
URL field and click **Laden**. Normal URLs with
`/elections/wahlcheck/{municipalitySlug}` are automatically converted to
`/embed/wahlcheck/{municipalitySlug}` for the iframe. The standalone link retains
the normal full-page URL. Existing embed URLs and shared-result queries also work.
The embed layout renders only the Wahlcheck, without the site's header, footer,
mobile dock or search. Result links generated inside the iframe open the normal
standalone Wahlcheck.

The default source is
`https://future.stadt-land-klima.de/elections/wahlcheck/sachsen-anhalt-landesebene`.
On 2026-10-28 the live future deployment did not yet include the embed route and
blocked foreign framing. See the deployment requirements below. The local-preview
link switches to `http://localhost:8080/elections/wahlcheck/nettetal`, a published
test election in the current local database. Start the development stack first
(`bin/start_development.sh`) and choose another local published election if that
record is unavailable. Published slugs are listed by
`http://localhost:8080/api/public/wahlcheck`. Local and production databases can
contain different elections. The test does not create or publish an election.

You can bookmark the configured test, including an existing result URL:

```text
http://127.0.0.1:8090/?url=http%3A%2F%2Flocalhost%3A8080%2Felections%2Fwahlcheck%2Fnettetal&lang=en
```

For a running local frontend, enter
`http://localhost:8080/elections/wahlcheck/YOUR-SLUG`. A different localhost port
tests cross-origin behavior, but not all cross-site cookie restrictions. Loading
the public HTTPS site from this local page also exercises cross-site embedding.
The production domain will support the embed URL only after this change is
deployed there; the previously deployed full-page URL includes the site's header
and footer. For the final partner-domain check, serve these static files on the partner's
actual HTTPS origin; its own CSP, permissions policy and browser environment also
affect the result. Do not expose the repository root through the static server.

The iframe delegates `clipboard-write` and `web-share`. Its sandbox allows scripts,
the embedded site's own origin, forms (including dialog controls), downloads and
social-sharing popups. It does not grant top-level navigation. `allow-same-origin`
preserves the embedded site's origin; it does not give this page access to its
contents. The host controller automatically grows and shrinks the iframe to the
content's actual height, including question changes, expanded results and restart.
The surrounding page scrolls; the iframe has no internal document scrollbar once
the handshake completes. Without a cooperating controller, the standalone embed
document retains ordinary scrolling rather than hiding content.

The controller retries a small versioned initialization message while Nuxt starts.
The child only accepts messages from its actual parent, binds that parent's HTTP(S)
origin, and replies to that exact origin. The host checks both the iframe's origin
and its `contentWindow`, and accepts only bounded numeric resize/scroll values.
Messages contain layout metadata, not answers or results. `ResizeObserver` watches
the content wrapper rather than the document viewport; no viewport-based minimum
height can feed back into measurement. The host also sends its visible viewport so
explanation dialogs stay visible inside a long iframe. Long dialogs retain their
own scrollable content, as normal modal dialogs do.

The host-side JavaScript in `index.html` is required for automatic height. An iframe
element alone cannot measure a document on another origin. Use this controller in
the foreign site's approved script bundle, or apply that site's CSP nonce to an
inline copy. The child needs its own deployed embed route and existing application
scripts; no iframe library or CORS permission is needed for resizing.

Check questions, weighting, results, explanation dialogs, restart, reload,
language selection, copying links, image downloads and social/native sharing.
Answers/results can be shared and their existing storage behavior is unchanged.
Completing a real Wahlcheck can increment its existing completion counter.

Inspect the browser console and Network panel for blocked framing, CSP/CORS
errors, failed API requests and clipboard/share permission failures. Compare with
the standalone link. A loaded iframe event does not prove the application works,
so the page intentionally does not display an automatic success indicator.

A connection error at localhost:8080 means the frontend is stopped. A Wahlcheck
data 404 means the slug is not published in that server's database. An HTML 500
is a server-rendering error: inspect the document response and frontend logs
(`docker logs --tail 50 stadt-land-klima-frontend-1`). It is not fixed by adding
CORS permissions or hiding the error page.

The checked-in production Nuxt and Nginx/Caddy policies restrict framing to
`'self'`. This test does not bypass those policies: if active, the browser will
block this foreign origin until the application owner explicitly permits it.
Allowlisting the final partner domain would not also allow `http://127.0.0.1:8090`.
The test page's language selector changes only its own controls, not Wahlcheck's
language.

## Future source and hardened deployment

Read-only HTTP and Chromium checks on 2026-10-28 confirmed that future's normal
Wahlcheck pages send two enforcing CSP headers with `frame-ancestors 'self'`, plus
`X-Frame-Options: SAMEORIGIN`. The iframe is blocked before the app starts. Its
`/embed/wahlcheck/nettetal` route currently returns 404; that does not mean Nettetal
must exist in the future database. The route itself must first be deployed.

For future to be the iframe source on a foreign website:

1. Deploy this frontend's `/embed/wahlcheck/{slug}` route, layout and message bridge.
2. For that route only, allow the exact host origin in both the Nuxt CSP and the
   gateway fallback CSP, for example
   `frame-ancestors 'self' https://partner.example`. Adding a permissive policy
   alongside the unchanged restrictive policy does not allow framing.
3. Omit `X-Frame-Options` on the permitted embed route. Keep the existing framing
   restrictions on the rest of the site, including CMS/editor/candidate pages.
4. Permit the source origin in the foreign site's own `frame-src`, if restricted.
   Its script CSP must also permit the host controller. Preserve the child's full
   script/style nonce policy; postMessage and ResizeObserver need no CSP exception.

The local static page's origin is `http://127.0.0.1:8090`. It is different from
`http://localhost:8090` and from the eventual HTTPS partner. If testing future from
that local page, explicitly permit that exact test origin in the scoped frame
policy during testing. Do not add the partner to Directus CORS or public-role
permissions. API calls still originate inside the Wahlcheck source document.
No live deployment, gateway or permission configuration is changed by this test.

To run the targeted read-only Chromium regression against a published local election:

```bash
npm --prefix bin/test_suite run test:wahlcheck-embed -- http://localhost:8080 nettetal
```

This starts its own temporary static server, checks question input, shared results,
automatic growth/shrink without internal scrolling, rejected forged/malformed host
messages, visible explanation dialogs, outer-page step scrolling, clipboard copying
and the absence of the site's header/footer, then checks the normal
standalone page. It also runs Firefox with cookies/storage blocked, verifies that
storage is actually denied in the frame, and checks that questions and shared results
still load without unhandled exceptions. It blocks writes and does not increment the
completion counter. Both Chromium and Firefox must be installed for this command.

If Firefox reports “The operation is insecure” and the election spinner never stops,
reload the frame after updating the frontend. Vue Router and Nuxt DevTools used to
import Vue's storage-dependent DevTools runtime before hydration. Development embeds
now skip those overlays and use the upstream no-op DevTools API; locale initialization
reuses the server-rendered locale without reading browser cookies. You do not need
to allow third-party cookies or weaken browser privacy settings.
