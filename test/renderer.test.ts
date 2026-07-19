import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderSession } from "../src/renderer.js";
import { createInitialManifest, isDiagramDocument } from "../src/contracts.js";
import type { ArchitectureDocument, DiagramDocument } from "../src/types.js";

function parseFixture(source: string): DiagramDocument {
  const value: unknown = JSON.parse(source);
  if (!isDiagramDocument(value)) throw new Error("invalid renderer fixture");
  return value;
}

const fixtureValue = parseFixture(
  await readFile(new URL("../examples/checkout-migration.json", import.meta.url), "utf8"),
);
if (fixtureValue.family !== "architecture") throw new Error("expected architecture fixture");
const fixture: ArchitectureDocument = fixtureValue;
const familyFixtures = await Promise.all([
  "checkout-migration.json",
  "teammate-ask-sequence.json",
  "question-readiness-state.json",
  "replacement-readiness-mind-map.json",
  "grill-visuals-rollout-timeline.json",
  "diagram-priority-quadrant.json",
  "sharing-options-comparison.json",
].map(async (name) => parseFixture(await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8"))));
const manifest = createInitialManifest("checkout-migration");
const viewerRuntime = await readFile(new URL("../dist/browser/viewer.js", import.meta.url), "utf8");

test("renders a self-contained interactive and accessible session", async () => {
  const html = await renderSession(manifest, [fixture]);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /class="sr-only diagram-text-equivalent"/);
  assert.match(html, /Text description of How should checkout cross the new payment boundary\?/);
  assert(!html.includes("Text view"));
  assert(!html.includes("tab-state"));
  assert.match(html, /data-node-id="checkout-api"/);
  assert.match(html, /data-theme-toggle/);
  assert.match(html, /data-zoom="fit" title="Fit diagram"/);
  assert(!html.includes('aria-keyshortcuts="F"'));
  assert.match(html, /data-share aria-label="Publish" title="Publish this session" aria-haspopup="dialog"/);
  assert.match(html, /<span data-share-label>Publish<\/span>/);
  assert.match(html, /data-share-dialog aria-labelledby="share-dialog-title"/);
  assert.match(html, /Publish publicly/);
  assert.match(html, /data-grab-component="ArchitectureNodeCard"/);
  assert.match(html, /data-grab-source="src\/renderer\.ts#renderNode"/);
  assert.match(html, /src="\.\/react-grab\.js"/);
  assert.match(html, /src="\.\/motion\.js"/);
  assert.match(html, /src="\.\/viewer\.js"/);
  assert.match(viewerRuntime, /__REACT_GRAB_DISABLED__/);
  assert.match(viewerRuntime, /shareButtonLabel\.textContent = "Share"/);
  assert.match(html, /"maxContextLines":50/);
  assert.match(html, /data-group-label="Payment boundary"/);
  assert.match(viewerRuntime, /function downstream\(rootId\)/);
  assert.match(html, /data-original-indices=/);
  assert.match(html, /aria-label="Answer options"/);
  assert(!/data-answer-option="[^"]+"[^>]*>\s*<i/.test(html));
  assert(!html.includes(".answer-option > i"));
  assert(!html.includes('<div class="share-warning"><i'));
  assert(!html.includes(".share-warning i"));
  assert.match(html, /data-question-selector data-expanded="false"/);
  assert.match(html, /data-grab-component="QuestionSelector"/);
  assert.match(html, /data-rail-summary>The migration keeps order ownership internal/);
  assert(!html.includes("QuestionContextAccordion"));
  assert.match(html, /\.tab-copy \{[^}]*overflow: visible;[^}]*overflow-wrap: anywhere; white-space: normal;/);
  assert(!html.includes("text-overflow:"));
  assert.match(html, /role="tooltip"/);
  assert.match(html, /Why recommended/);
  assert.match(html, /data-highlights="customer checkout-api/);
  assert(!html.includes("vector-effect: non-scaling-stroke"));
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert(!html.includes("script-src 'self' 'unsafe-inline'"));
  assert.match(html, /connect-src 'self'/);
  assert(!html.includes("https://"));
  assert(!html.includes("eval("));
});

test("renders the Grill Visuals component and motion system", async () => {
  const html = await renderSession(manifest, [fixture]);
  assert.match(html, /--background: oklch\(0\.17 0 0\)/);
  assert.match(html, /--custom-outline-shadow:/);
  assert.match(html, /font-family: "Inter Variable"/);
  assert.match(html, /font-src 'self'/);
  assert.match(html, /\.family-map foreignObject, \.node-object \{ overflow: visible; \}/);
  assert.match(html, /inset 0 0 0 1px color-mix\(in srgb, var\(--brand\) 66%, transparent\)/);
  assert(!html.includes("0 12px 36px rgba(255,122,26,.13)"));
  assert(!html.includes(".node-card:hover"));
  assert.match(html, /corner-shape: squircle/);
  assert.match(html, /transform: scale\(\.97\)/);
  assert.match(html, /\.answer-option \{ min-height: 32px; gap: 5px; padding: 0 12px;[^}]*font-size: 14px; font-weight: 500;/);
  assert.match(html, /\.question-rail \{\s+position: fixed;\s+top: 24px;\s+left: 50%;/);
  assert.match(html, /grill-icon-swap \.3s/);
  assert.match(html, /\.question-rail \{ display: flex; flex-direction: column; overflow: hidden;/);
  assert.match(html, /width: min\(620px, calc\(100vw - 720px\)\)/);
  assert.match(html, /\.question-rail\[data-expanded="true"\] \{\s+max-height: min\(76dvh, 680px\);/);
  assert.match(html, /data-expanded="false" data-grab-component="QuestionSelector"/);
  assert.match(html, /content-visibility: auto/);
  assert.match(viewerRuntime, /function initializePanel\(panel\)/);
  assert.match(html, /@media \(min-width: 781px\) and \(max-width: 1279px\) \{\s+\.question-rail \{ top: 76px;/);
  assert.match(html, /\.session-tabs \{ display: grid; width: 100%; min-height: 0; gap: 3px;/);
  assert(!html.includes(".question-rail:hover"));
  assert(!html.includes(".question-rail:focus-within"));
  assert.match(viewerRuntime, /\[data-rail-summary\]/);
  assert.match(viewerRuntime, /\[data-rail-status-label\]/);
  assert(!html.includes('<span class="context-status" data-rail-status data-status="current"><i>'));
  assert(!html.includes(".context-status i"));
  assert.match(viewerRuntime, /function collapseRailAfterSelection\(tab, keyboard, event\)/);
  assert.match(viewerRuntime, /collapseRailAfterSelection\(tab, event\.detail === 0, event\)/);
  assert.match(viewerRuntime, /performance\.now\(\) - railCollapsedAt < 320/);
  assert.match(viewerRuntime, /Math\.hypot\(event\.clientX - railSelectionPointer\.x, event\.clientY - railSelectionPointer\.y\) < 16/);
  assert.match(viewerRuntime, /pointerenter[\s\S]*clearSelectionCollapse\(\);[\s\S]*setRailExpanded\(true\)/);
  assert.doesNotMatch(viewerRuntime, /pointerleave[\s\S]{0,180}delete questionRail\.dataset\.selectionCollapsed/);
  assert.match(html, /\.question-rail\[data-selection-collapsed="true"\] \.session-tabs \{\s+max-height: 0;/);
  assert(!html.includes("padding: 0 48px 0 0"));
  assert.match(html, /data-motion-enter="node"/);
  assert.match(viewerRuntime, /opacity:\s*\[0, 1\],\s*scale:\s*\[0?\.85, 1\],\s*filter:\s*\["blur\(6px\)", "blur\(0px\)"\]/);
  assert.match(viewerRuntime, /type:\s*"spring",\s*duration:\s*0?\.55,\s*bounce:\s*0?\.25,\s*delay/);
  assert.match(viewerRuntime, /pathLength:\s*\[0, 1\],\s*opacity:\s*\[0, 1\]/);
  assert.match(viewerRuntime, /duration:\s*0?\.6,\s*delay,\s*ease:\s*"easeOut"/);
  assert.match(viewerRuntime, /controllers\.get\(id\)\?\.fit\(\);\s*playEntrance\(activePanel\)/);
  assert(!html.includes("legacy-node-in"));
  assert.match(html, /class="edge-comet"/);
  assert.match(viewerRuntime, /clamp\(length \/ 0?\.25, 1600, (?:5000|5e3)\)/);
  assert.match(viewerRuntime, /(?:30000|3e4) \+ Math\.random\(\) \* (?:25000|25e3)/);
  assert.match(viewerRuntime, /graphViewport\.style\.willChange = "auto"/);
  assert.match(viewerRuntime, /state\.x -= event\.deltaX/);
  assert.match(viewerRuntime, /const padLeft = compact \? 24 : 48/);
  assert.match(viewerRuntime, /const padRight = compact \? 24 : 48/);
  assert(!viewerRuntime.includes("railBox"));
  assert.match(viewerRuntime, /const preserveWholeDiagram = panel\.dataset\.family === "quadrant"/);
  assert.match(viewerRuntime, /if \(fitScale >= 0?\.45 \|\| preserveWholeDiagram\)/);
  assert.match(viewerRuntime, /state\.k = clamp\(fitScale, preserveWholeDiagram \? 0?\.2 : 0?\.3, 1\)/);
  assert.match(viewerRuntime, /state\.k = clamp\(availableHeight \/ graphHeight \* 0?\.9, 0?\.5, 0?\.8\)/);
  assert.match(viewerRuntime, /state\.x = padLeft \+ 16/);
  assert.match(html, /scroll-snap-type: none/);
  assert.match(html, /\.brand-pill \.powered-label \{ display: none; \}/);
  assert.match(html, /\.floating-actions \.share-button \{ width: auto; padding-inline: 10px; \}/);
  assert.match(html, /@media \(max-width: 360px\) \{\s+\.floating-actions \.share-button \.icon-swap \{ display: none; \}/);
  assert(!html.includes(".floating-actions .share-button [data-share-label] { display: none; }"));
  assert.match(html, /\.answer-options \{ display: grid; width: calc\(100vw - 24px\); max-width: calc\(100vw - 24px\); grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(html, /\.answer-option \{ width: 100%; min-width: 0; min-height: 38px; height: auto; justify-content: flex-start;/);
  assert.match(html, /\.answer-option > span:not\(\.option-explanation\) \{ min-width: 0; overflow-wrap: normal; \}/);
  assert.match(html, /\.answer-option em \{ flex: none; margin-left: auto; \}/);
  assert(!html.includes(".answer-option > span:not(.option-explanation) { overflow-wrap: anywhere; }"));
  assert.match(html, /\.option-explanation \{ position: fixed; bottom: 76px;/);
  assert(!viewerRuntime.includes('event.key.toLowerCase() === "f"'));
  assert(!viewerRuntime.includes("plainF"));
  assert.match(viewerRuntime, /panel\.classList\.toggle\("has-kind-focus", Boolean\(kinds\)\)/);
  assert.match(viewerRuntime, /button\.addEventListener\("focus", \(\) => focusLegend\(button\)\)/);
  assert.match(html, /\.diagram-panel\.has-kind-focus \.node-card\.is-dimmed \{ opacity: \.15 !important; \}/);
  assert(!html.includes("class=\"edge-beam\""));
  assert(!html.includes("agent-beam 4.6s"));
});

test("renders product and provider logos without viewer network requests", async () => {
  const logoSources = new Map([
    ["domain:shopify.com", "data:image/png;base64,cHJvamVjdA=="],
    ["domain:stripe.com", "data:image/png;base64,c3RyaXBl"],
    ["domain:neon.tech", "data:image/png;base64,bmVvbg=="],
    ["domain:upstash.com", "data:image/png;base64,dXBzdGFzaA=="],
  ]);
  const html = await renderSession(manifest, [fixture], { logoSources });
  assert.equal((html.match(/data-node-logo data-logo-key/g) ?? []).length, fixture.data.nodes.length);
  assert.match(html, /data-logo-key="domain:shopify\.com"/);
  assert.match(html, /data-logo-key="domain:stripe\.com"/);
  assert.match(html, /"logos":\{"domain:shopify\.com":"data:image\/png;base64/);
  assert.match(viewerRuntime, /image\.src = source/);
  assert.match(viewerRuntime, /classList\.add\("has-logo"\)/);
  assert.match(viewerRuntime, /icon\.setAttribute\("class", "popover-logo"\)/);
  assert(!html.includes("t3.gstatic.com"));
});

test("renders all seven families as native question tabs", async () => {
  const html = await renderSession({ ...manifest, session: "diagram-families" }, familyFixtures);
  assert.equal((html.match(/class="session-tab"/g) ?? []).length, 7);
  assert(!/data-quadrant-filter="[^"]+"[^>]*><i/.test(html));
  for (const family of ["architecture", "sequence", "state", "mind-map", "timeline", "quadrant", "comparison"]) {
    assert.match(html, new RegExp(`data-family="${family}"`));
    assert.match(html, new RegExp(`<span class="tab-family">${family}</span>`));
  }
  assert.match(html, /data-sequence-step=/);
  assert.match(html, /data-state-transition=/);
  assert.match(html, /data-mind-toggle=/);
  assert.match(html, /data-timeline-event=/);
  assert.match(html, /data-quadrant-point=/);
  assert.match(html, /data-comparison-cell=/);
  assert.match(html, /class="graph-stage comparison-stage" data-stage/);
  assert.match(html, /class="comparison-viewport" data-graph data-viewport data-width="1320"/);
  assert(!html.includes('data-family="comparison" data-canvas="false"'));
  assert.match(html, /class="sequence-participant" data-motion-enter="node"/);
  assert.match(html, /class="state-transition-line" data-motion-enter="edge"/);
  assert.match(html, /\.sequence-message-label strong \{[^}]*border: 0;[^}]*border-radius: 0;[^}]*background: transparent;[^}]*box-shadow: none;/);
  assert.match(html, /\.state-transition-label \{[^}]*border: 0;[^}]*border-radius: 0;[^}]*background: transparent;[^}]*box-shadow: none;/);
  assert.match(html, /class="mind-edge" data-motion-enter="edge"/);
  assert.match(html, /class="timeline-card" data-motion-enter="node"/);
  assert.match(html, /class="quadrant-label" data-motion-enter="node"/);
  assert.match(html, /data-label-side="right"/);
  assert(!html.includes(".quadrant-point.option-active .quadrant-label, .comparison-option.option-active"));
  assert.match(html, /\.quadrant-point\.option-active \.quadrant-label \{ color: var\(--brand\); \}/);
  assert.match(html, /class="comparison-board" data-motion-enter="node"/);
  assert.equal((html.match(/aria-label="Answer options"/g) ?? []).length, 7);
});

test("renders a 250-question session with lazy browser initialization", async () => {
  const source = familyFixtures.find((document) => document.family === "comparison");
  assert(source);
  const documents = Array.from({ length: 250 }, (_, index) => ({
    ...structuredClone(source),
    id: `question-${index + 1}`,
    title: `Question ${index + 1}: choose the safest rollout path`,
  }));
  const html = await renderSession(createInitialManifest("long-grill"), documents);
  assert.equal((html.match(/class="session-tab"/g) ?? []).length, 250);
  assert.match(html, /data-rail-position>1\/250</);
  assert.match(html, /content-visibility: auto/);
  assert.match(viewerRuntime, /function initializePanel\(panel\)/);
  assert(Buffer.byteLength(html) < 25 * 1024 * 1024);
});

test("escapes markup in content and embedded JSON", async () => {
  const document = structuredClone(fixture);
  document.title = "Close </script><img src=x onerror=alert(1)>";
  const firstNode = document.data.nodes[0];
  assert(firstNode);
  firstNode.detail = "<script>alert('no')</script>";
  const html = await renderSession(manifest, [document]);
  assert(!html.includes("</script><img src=x"));
  assert(!html.includes("<script>alert('no')</script>"));
  assert(html.includes("&lt;/script&gt;&lt;img"));
  assert(html.includes("\\u003cscript"));
});
