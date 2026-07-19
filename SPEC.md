# Grill Visuals V1 specification

## Goal

Help developers and teammates understand Grill Me decisions through beautiful, interactive, shareable diagrams without turning diagrams into another application backend.

## Product contract

- One Grill Me session becomes one local multi-tab site.
- Each diagram-backed question owns one tab, updated in place.
- Tabs show `current`, `resolved`, or `blocked`.
- Each tab shows 2–4 answer options with short explanations.
- Exactly one option is recommended and initially highlights its path, items, or evidence.
- Hovering or focusing any option previews its highlights and explains the recommendation or tradeoff.
- Every published version returns a stable session URL and an immutable deployment URL.
- Answers stay in the coding agent's native question UI, chat, or teammate ask packet. Pages are read-only.
- Local generation is automatic when a visual materially helps. Public upload only follows explicit confirmation in the local viewer or explicit `share --public` CLI intent.
- The local viewer publishes through a loopback-only bridge that runs Wrangler with credentials from its supported user store. The generated page never receives credentials.
- One share publishes the whole session and deep-links the question open when the developer confirmed.
- V1 links are unlisted but public: anyone with the URL can view them. No-index controls reduce discovery; they are not access control.
- Grill Me owns the temporary local server lifecycle: start one server for the session and stop only that server when grilling ends.
- Require confirmation before every first share and update. Show the real question count, active question, and changes, with every included title available under an expandable full review.
- Before enabling publish, hard-block high-confidence credentials. Lower-confidence matches require explicit review before override.
- Every upload returns the stable latest-version URL and a new exact-version URL.
- Claim **Published** only after both URLs serve the expected session marker.
- Choose one Cloudflare account per session, remember it locally, and show its identity in every confirmation. Account changes are explicit.
- On an already-public page, Share invokes the device share sheet when available and otherwise copies the current deep link. Public viewers cannot publish updates.
- Public content remains until explicit `unshare`.
- If the viewer lacks its publishing bridge, Publish explains the limitation and offers one-click copy of the exact `open` command.
- V1 accepts no agent-authored HTML or JavaScript.

## Diagram families

| Family | Best for | Required interaction |
| --- | --- | --- |
| `architecture` | components, dependencies, data flow | pan, zoom, focus path, inspect node |
| `sequence` | actors and time-ordered messages | step focus, participant focus |
| `state` | states, events, guards, transitions | focus transition, inspect state |
| `mind-map` | hierarchical ideas and options | expand/collapse, focus branch |
| `timeline` | milestones, incidents, migration phases | focus event, navigate time |
| `quadrant` | position against two axes | inspect point, filter group |
| `comparison` | choices against repeated criteria | focus row/column, inspect rationale |

Every family also renders a complete text equivalent. Interaction can add clarity; it cannot be the only way to obtain information.

## Data and trust boundary

- Versioned strict JSON schemas per family.
- Unknown fields rejected.
- Typed content and family-specific item/relationship caps.
- Renderer inserts user data as text, never markup, and never evaluates it.
- Self-contained HTML: compiled runtime, data, styles, icons, and licenses; no CDN required.
- Generated sessions live under a gitignored `.context` path in the consuming repository.
- Specs and public artifacts must omit secrets and minimize private repository/business data.

All seven families have strict schemas with family-specific caps, bounded copy, unique IDs, valid references, and no unknown fields. Option highlights must reference IDs in that diagram.

## CLI contract

```text
grill-visuals init      create session manifest
grill-visuals upsert    validate and add/update one question tab
grill-visuals render    build one self-contained session site
grill-visuals open      run and open the local viewer with its publishing bridge
grill-visuals serve     run the local viewer with its loopback-only publishing bridge, optionally opening it
grill-visuals validate  validate schema and, later, browser/accessibility output
grill-visuals share     explicitly deploy the whole site to Cloudflare Pages
grill-visuals unshare   delete the exact recorded owned Pages project and verify removal
grill-visuals handoff   export the active share's non-secret ownership receipt
grill-visuals pickup    verify and import a confirmed ownership receipt
```

`share` creates one uniquely named, owned Cloudflare Pages project per live session share and records its exact project, branch, deployment IDs, stable URL, and immutable URLs. Later updates reuse that project. `unshare` operates only with this local ownership record, deletes the exact project, verifies its control-plane removal, and verifies the stable URL no longer exposes the session marker. The local ledger remains as an audit record.

Keep one isolated Pages project per active public session. Before project creation, show the account's Grill Visuals project usage and warn near Cloudflare's 100-project account limit. Prompt explicit removal of old pages; never delete another session automatically.

The local owner viewer exposes **Manage public share** and a confirmed unshare action; the CLI remains available as a fallback. Public pages cannot update or unshare themselves. A Grill Me `pass` handoff may carry the non-secret Pages ownership receipt. `pickup` shows the exact project and URLs, verifies Cloudflare access and the session marker on the public page, and requires explicit confirmation before importing it. The authorized teammate may then update or remove the same page.

Before updating an existing share, compare against its last published manifest. Show added, changed, and removed question counts; keep each group of affected titles expandable. Public pages have no automatic expiry in V1 and remain online until explicit unshare.

Preflight Wrangler authentication before opening the publishing viewer. If authentication expires later, keep the publish dialog open with the exact `wrangler login` recovery command and Retry. Missing auth or deployment failure never breaks the local artifact. Credentials stay in Wrangler's supported user store; never chat, generated HTML, manifests, or repositories.

If upload may have succeeded but either link cannot yet be verified, show **May already be public**, retain the known project and URLs, and offer **Verify again** plus **Unshare**. Do not reduce an ambiguous public state to a generic failure.

## Layout and visual system

- Distinct Grill Visuals identity across every component, interaction, and generated artifact.
- Keep shared tokens, hover states, motion values, and canvas behavior consistent across all families.
- Audit copied third-party source, mark modifications, and preserve applicable license headers and notices.
- Deterministic family-owned layouts; no universal auto-layout pretending every diagram is a graph.
- Strong hierarchy, compact cards, orthogonal routing where useful, restrained motion, polished light/dark themes, and responsive mobile views.
- Keep one top-center question selector collapsed by default. Expand it on hover for pointer devices, focus for keyboard users, and tap for touch users.
- While collapsed, show the active question's status, full title, position, and total. Reveal the full question list and current context after expansion. Close on pointer exit, focus exit, Escape, or outside tap as appropriate.
- Semantic controls, keyboard navigation, visible focus, reduced motion, high contrast, zoom alternatives, and screen-reader text views.

## Failure behavior

- Invalid input: reject with exact JSON path and correction.
- Unsupported family: list the seven supported values.
- Render/browser failure: preserve source JSON and explain the failed stage.
- Missing package or beta failure inside Grill Me: use Sideshow fallback.
- Share failure: retain working local output; never claim a public URL.
- Local publish failure: keep the confirmation dialog open, name the failed stage in plain words, and offer Retry plus the exact login or CLI recovery command.
- Publishing bridge unavailable: explain that the static viewer cannot run Cloudflare commands and offer one-click copy of the exact `open` command.
- Unshare failure: state exactly which URLs may remain public and provide the narrow manual action.

## Release gates

Sideshow remains the production fallback until all pass:

1. All seven strict family schemas and renderers.
2. Largest allowed input and long multi-tab session tests.
3. Light/dark, desktop/mobile, keyboard, screen reader, reduced motion, contrast, and text-equivalent checks.
4. Browser console/network error checks.
5. Local `init`/`upsert`/`render`/`open` lifecycle.
6. Cloudflare `share`/update/immutable URL/`unshare` lifecycle, including partial failures.
7. Secret/privacy redaction and dependency/license audit.
8. Two real Grill Me dogfood sessions.
9. Pinned npm release consumed successfully by Grill Me.
10. A generated 250-question session stays usable with lazy diagram initialization and a virtualized top question selector; larger sessions warn, and assets at risk of exceeding Cloudflare's 25 MiB limit fail before upload.

Only then may Grill Me remove Sideshow.

## Fixed gap pass

1. **User types:** session owner, pickup developer, teammate viewer, Cloudflare user, local-only user.
2. **Contexts:** private repos, local interviews, explicit public shares, resume/handoff, offline rendered viewing.
3. **Failures:** invalid data, renderer/browser/package/auth/deploy failures, stale aliases, partial unshare.
4. **User error:** accidental disclosure, wrong session/target, unsafe cleanup.
5. **Interactions:** native questions, `ask`, `pass`, `pickup`, restart/resume, Sideshow fallback.
6. **Load:** content caps, lazy tabs, largest-family and long-session browser tests, provider limits.
7. **Security/privacy:** local-first, explicit public warning, no custom code/CDN/analytics/secrets, pinned dependencies.
8. **Accessibility:** semantic UI, keyboard/focus, reduced motion, contrast, responsive zoom, full text equivalent.

## Blast radius

- This repository stays independent from `agentic-starter-pack` until a proven version is pinned there.
- Public exposure is the largest risk; explicit sharing and verified unshare contain it.
- Forked code creates ongoing license, dependency, accessibility, and maintenance duties.
- Bounded built-in families trade unlimited flexibility for reliable quality, safety, and portability.
