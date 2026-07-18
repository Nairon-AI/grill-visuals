# Grill Visuals V1 specification

## Goal

Help developers and teammates understand Grill Me decisions through beautiful, interactive, shareable diagrams without turning diagrams into another application backend.

## Product contract

- One Grill Me session becomes one local multi-tab site.
- Each diagram-backed question owns one tab, updated in place.
- Tabs show `current`, `resolved`, or `blocked`.
- Every published version returns a stable session URL and an immutable deployment URL.
- Answers stay in the coding agent's native question UI, chat, or teammate ask packet. Pages are read-only.
- Local generation is automatic when a visual materially helps. Public upload only follows explicit `share` intent.
- Public content remains until explicit `unshare`.
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

Initial scaffold validates only the common V1 envelope. Family schemas must land before any renderer is called usable.

## CLI contract

```text
grill-visuals init      create session manifest
grill-visuals upsert    validate and add/update one question tab
grill-visuals render    build one self-contained session site
grill-visuals open      open the local site
grill-visuals validate  validate schema and, later, browser/accessibility output
grill-visuals share     explicitly deploy the whole site to Cloudflare Pages
grill-visuals unshare   tombstone public content and clean recorded deployments
```

`share` records exact Cloudflare project, branch, and deployment IDs. `unshare` operates only on those owned IDs, deploys a content-free tombstone when the newest branch deployment cannot be deleted, deletes older recorded deployments where supported, and verifies the stable URL no longer exposes session data.

Missing Cloudflare auth or deployment failure never breaks the local artifact. Credentials stay in Wrangler's supported user store; never chat, generated HTML, manifests, or repositories.

## Layout and visual system

- Distinct Grill Visuals identity across every component, interaction, and generated artifact.
- Audit copied third-party source before use.
- Mark modified copied files and preserve applicable license headers and notices.
- Deterministic family-owned layouts; no universal auto-layout pretending every diagram is a graph.
- Strong hierarchy, compact cards, orthogonal routing where useful, restrained motion, polished light/dark themes, and responsive mobile views.
- Semantic controls, keyboard navigation, visible focus, reduced motion, high contrast, zoom alternatives, and screen-reader text views.

## Failure behavior

- Invalid input: reject with exact JSON path and correction.
- Unsupported family: list the seven supported values.
- Render/browser failure: preserve source JSON and explain the failed stage.
- Missing package or beta failure inside Grill Me: use Sideshow fallback.
- Share failure: retain working local output; never claim a public URL.
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
