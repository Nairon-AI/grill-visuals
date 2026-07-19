/*
 * Self-contained interaction and presentation layer for Grill Visuals.
 */
import { layoutArchitecture } from "./layout.js";
import type { ArchitectureGroup, ArchitectureLayout, ArchitectureLayoutEdge, PlacedArchitectureNode } from "./layout.js";
import { familyStyles, renderFamilyPanel, renderOptionDock } from "./family-renderers.js";
import { visualSystemStyles } from "./visual-system.js";
import { logoKeyForNode } from "./logos.js";
import { renderTablerIcon } from "./tabler-icons.js";
import type { TablerIconName } from "./tabler-icons.js";
import type {
  ArchitectureDocument,
  ArchitectureNodeKind,
  DiagramDocument,
  Point,
  ProductProject,
  SessionManifest,
  Size,
} from "./types.js";

const KIND_META = Object.freeze({
  entry: { label: "Entry", icon: "bolt", color: "slate", hex: "#64748b" },
  job: { label: "Job", icon: "clock", color: "amber", hex: "#f59e0b" },
  agent: { label: "Agent", icon: "ghost", color: "orange", hex: "#f97316" },
  service: { label: "Service", icon: "hexagon", color: "pink", hex: "#ec4899" },
  store: { label: "Store", icon: "database", color: "emerald", hex: "#10b981" },
  queue: { label: "Queue", icon: "arrowsRight", color: "violet", hex: "#8b5cf6" },
  external: { label: "External", icon: "world", color: "sky", hex: "#0ea5e9" },
  user: { label: "User", icon: "user", color: "blue", hex: "#3b82f6" },
} satisfies Record<ArchitectureNodeKind, { label: string; icon: TablerIconName; color: string; hex: string }>);

const EDGE_META = Object.freeze({
  calls: "calls",
  reads: "reads",
  writes: "writes",
  triggers: "triggers",
  publishes: "publishes",
  subscribes: "subscribes",
});

const LEGEND_GROUPS: ReadonlyArray<{ label: string; kinds: readonly ArchitectureNodeKind[] }> = Object.freeze([
  { label: "People", kinds: ["user"] },
  { label: "Entrypoints", kinds: ["entry", "job"] },
  { label: "Agents", kinds: ["agent"] },
  { label: "Runtime", kinds: ["service", "queue", "store", "external"] },
]);

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value: unknown): string {
  return (JSON.stringify(value) ?? "null")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function delayAt(x: number, y: number, layout: Size): number {
  return (0.15 + ((x + y) / Math.max(1, layout.width + layout.height)) * 0.9) * 1000;
}

function arrowHead(points: readonly Point[], length = 7): string {
  if (points.length < 2) return "";
  const point = points.at(-1);
  const previous = points.at(-2);
  if (!point || !previous) return "";
  const angle = Math.atan2(point.y - previous.y, point.x - previous.x);
  const spread = 0.46;
  const first = { x: point.x - length * Math.cos(angle - spread), y: point.y - length * Math.sin(angle - spread) };
  const second = { x: point.x - length * Math.cos(angle + spread), y: point.y - length * Math.sin(angle + spread) };
  return `M ${first.x} ${first.y} L ${point.x} ${point.y} L ${second.x} ${second.y}`;
}

function labelAnchor(points: readonly Point[]): (Point & { length: number }) | null {
  let best: (Point & { length: number }) | null = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (!best || length > best.length) best = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, length };
  }
  return best;
}

function pathLength(points: readonly Point[]): number {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return previous ? total + Math.hypot(point.x - previous.x, point.y - previous.y) : total;
  }, 0);
}

function renderGroup(group: ArchitectureGroup, _index: number, layout: ArchitectureLayout): string {
  return `<foreignObject x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" class="group-wrap" data-group-id="${escapeHtml(group.id)}" data-group-label="${escapeHtml(group.label)}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="group-card" data-motion-enter="group" data-motion-delay="${delayAt(group.x, 0, layout)}"><span class="group-label">${escapeHtml(group.label)}</span><i class="beam-hit-ring" aria-hidden="true"></i></div>
  </foreignObject>`;
}

function renderEdge(edge: ArchitectureLayoutEdge, index: number, documentId: string, nodeById: ReadonlyMap<string, PlacedArchitectureNode>, layout: ArchitectureLayout): string {
  const label = edge.label ?? EDGE_META[edge.kind];
  const kindOnly = !edge.label;
  const labelPosition = edge.labelPosition ?? labelAnchor(edge.points);
  const labelWidth = edge.labelPosition?.width ?? Math.max(54, Math.round(label.length * 6) + 14);
  const edgeDelay = delayAt(nodeById.get(edge.source)?.x ?? 0, 0, layout) + 250;
  const labelMarkup = labelPosition
    ? `<g class="edge-label${kindOnly ? " is-kind-only" : ""}" data-motion-enter="fade" data-motion-delay="${kindOnly ? 0 : edgeDelay + 350}" data-kind-only="${kindOnly}" transform="translate(${labelPosition.x} ${labelPosition.y})">
        <rect x="-${labelWidth / 2}" y="-11" width="${labelWidth}" height="22" rx="11"></rect>
        <text text-anchor="middle" dominant-baseline="central">${escapeHtml(label)}</text>
      </g>`
    : "";
  const sourceKind = nodeById.get(edge.source)?.kind ?? "entry";
  const sourceColor = KIND_META[sourceKind].hex;
  const gradientId = `beam-${documentId}-${index}`;
  return `<g class="edge-wrap" data-grab-component="ArchitectureEdge" data-grab-source="src/renderer.ts#renderEdge" data-edge-index="${index}" data-original-indices="${edge.originalIndices.join(" ")}" data-highlight-links="${edge.highlightIds.map(escapeHtml).join(" ")}">
      <defs><linearGradient id="${gradientId}" x1="0" x2="1"><stop offset="0" stop-color="${sourceColor}" stop-opacity="0"></stop><stop offset="1" stop-color="${sourceColor}"></stop></linearGradient></defs>
      <path class="edge-line" data-motion-enter="edge" data-motion-delay="${edgeDelay}" pathLength="1" d="${edge.path}"></path>
      <path class="edge-arrow" data-motion-enter="fade" data-motion-delay="${edgeDelay + 500}" d="${arrowHead(edge.points)}"></path>
      <g class="edge-comet" data-edge-length="${pathLength(edge.points)}" data-target-id="${escapeHtml(edge.target)}" data-beam-color="${sourceColor}" style="color:${sourceColor}" aria-hidden="true">
        <line x1="-32" y1="0" x2="0" y2="0" stroke="url(#${gradientId})"></line><circle cx="0" cy="0" r="1.5" fill="${sourceColor}"></circle>
      </g>
      ${labelMarkup}
    </g>`;
}

function renderNode(node: PlacedArchitectureNode, _index: number, layout: ArchitectureLayout, project: ProductProject, logoSources: ReadonlyMap<string, string>): string {
  const meta = KIND_META[node.kind];
  const logoKey = logoKeyForNode(project, node);
  const logo = logoKey && logoSources.has(logoKey)
    ? `<img class="node-logo" data-node-logo data-logo-key="${escapeHtml(logoKey)}" alt="">`
    : "";
  const rows = (node.tags ?? [])
    .map((tag) => `<span class="node-row"><i aria-hidden="true">•</i><span>${escapeHtml(tag)}</span></span>`)
    .join("");
  const entranceDelay = delayAt(node.x, node.y, layout);
  return `<foreignObject x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" class="node-object" data-motion-delay="${entranceDelay}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="node-frame" data-motion-enter="node" data-motion-delay="${entranceDelay}">
      <button class="node-card" type="button" data-grab-component="ArchitectureNodeCard" data-grab-source="src/renderer.ts#renderNode" data-node-id="${escapeHtml(node.id)}" data-highlight-id="${escapeHtml(node.id)}" data-kind="${escapeHtml(node.kind)}" data-kind-label="${escapeHtml(meta.label)}" aria-pressed="false" aria-label="Trace downstream from ${escapeHtml(node.label)}">
        <span class="agent-border-beam" aria-hidden="true"></span>
        <span class="node-head">
          <span class="node-glyph" data-color="${meta.color}" aria-hidden="true"><span class="node-logo-fallback">${renderTablerIcon(meta.icon)}</span>${logo}</span>
          <span class="node-copy"><strong>${escapeHtml(node.label)}</strong><span>${escapeHtml(node.description)}</span></span>
        </span>
        ${rows ? `<span class="node-rows">${rows}</span>` : ""}
        <span class="beam-hit-ring" aria-hidden="true"></span>
      </button>
    </div>
  </foreignObject>`;
}

function renderTextEquivalent(document: ArchitectureDocument): string {
  const nodeById = new Map(document.data.nodes.map((node) => [node.id, node]));
  const nodes = document.data.nodes
    .map(
      (node) => `<li>
        <strong>${escapeHtml(node.label)}</strong>
        <span>${escapeHtml(KIND_META[node.kind].label)} — ${escapeHtml(node.description)}</span>
        ${node.detail ? `<p>${escapeHtml(node.detail)}</p>` : ""}
        ${node.sourceRef ? `<code>${escapeHtml(node.sourceRef)}</code>` : ""}
      </li>`,
    )
    .join("");
  const edges = document.data.edges
    .map((edge) => {
      const from = nodeById.get(edge.source)?.label ?? edge.source;
      const to = nodeById.get(edge.target)?.label ?? edge.target;
      return `<li><strong>${escapeHtml(from)}</strong> ${escapeHtml(edge.label ?? edge.kind)} <strong>${escapeHtml(to)}</strong></li>`;
    })
    .join("");
  return `<section class="sr-only diagram-text-equivalent" aria-label="Text description of ${escapeHtml(document.title)}">
    <div>
      <section><h3>Components</h3><ol>${nodes}</ol></section>
      <section><h3>Connections</h3><ol>${edges || "<li>No connections.</li>"}</ol></section>
    </div>
  </section>`;
}

function renderLegend(document: ArchitectureDocument): string {
  const present = new Set<ArchitectureNodeKind>(document.data.nodes.map((node) => node.kind));
  return LEGEND_GROUPS.filter((group) => group.kinds.some((kind) => present.has(kind)))
    .map((group) => {
      const lead = group.kinds.find((kind) => present.has(kind));
      if (!lead) return "";
      const meta = KIND_META[lead];
      return `<button type="button" data-legend-kinds="${group.kinds.join(" ")}"><i aria-hidden="true" style="color:${meta.hex}">${renderTablerIcon(meta.icon)}</i>${escapeHtml(group.label)}</button>`;
    })
    .join("");
}

function renderPanel(document: ArchitectureDocument, layout: ArchitectureLayout, index: number, logoSources: ReadonlyMap<string, string>): string {
  const nodeById = new Map<string, PlacedArchitectureNode>(layout.nodes.map((node) => [node.id, node]));
  return `<section class="diagram-panel" id="panel-${document.id}" role="tabpanel" aria-labelledby="tab-${document.id}" ${index === 0 ? "" : "hidden"} data-grab-component="ArchitectureDiagramPanel" data-grab-source="src/renderer.ts#renderPanel" data-document-id="${escapeHtml(document.id)}" data-family="architecture" data-canvas="true">
    <div class="graph-stage" data-grab-component="InteractiveGraphCanvas" data-grab-source="src/renderer.ts#renderPanel" data-stage>
      <svg class="architecture-map" data-graph data-width="${layout.width}" data-height="${layout.height}" role="group" aria-label="Interactive architecture diagram for ${escapeHtml(document.title)}" tabindex="0">
        <g data-viewport>
          <g class="group-layer">${layout.groups.map((group, groupIndex) => renderGroup(group, groupIndex, layout)).join("\n")}</g>
          <g class="edge-layer">${layout.edges.map((edge, edgeIndex) => renderEdge(edge, edgeIndex, document.id, nodeById, layout)).join("\n")}</g>
          <g class="node-layer">${layout.nodes.map((node, nodeIndex) => renderNode(node, nodeIndex, layout, document.data.project, logoSources)).join("\n")}</g>
        </g>
      </svg>
    </div>
    <aside class="node-popover" aria-live="polite" aria-label="Selected component details" hidden>
      <span class="popover-kind"><i class="popover-kind-icon" aria-hidden="true"></i><span class="popover-kind-label"></span></span>
      <h2></h2>
      <p class="popover-description"></p>
      <p class="popover-detail"></p>
      <code class="popover-source"></code>
    </aside>
    <nav class="legend" aria-label="Filter component types">${renderLegend(document)}</nav>
    ${renderOptionDock(document)}
    ${renderTextEquivalent(document)}
  </section>`;
}

function styles(): string {
  return `<style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: var(--canvas); }
    body { min-width: 320px; color: var(--ink); font-family: var(--body); -webkit-font-smoothing: antialiased; }
    button, summary { font: inherit; }
    button:focus-visible, summary:focus-visible, svg:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
    [hidden] { display: none !important; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

    .app-shell, .diagram-panel, .graph-stage { position: fixed; inset: 0; }
    .app-shell { overflow: hidden; background: var(--canvas); }
    .graph-stage {
      cursor: grab;
      touch-action: none;
    }
    .graph-stage.is-dragging { cursor: grabbing; }
    .architecture-map { width: 100%; height: 100%; overflow: visible; }
    [data-viewport] { transform-origin: 0 0; }

    .floating-dock {
      position: fixed;
      top: 24px;
      left: 24px;
      z-index: 20;
      display: grid;
      width: min(338px, calc(100vw - 48px));
      gap: 14px;
      pointer-events: none;
    }
    .brand-pill {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 9px;
      padding: 9px 13px 9px 10px;
      border-radius: 999px;
      pointer-events: auto;
    }
    .brand-mark { display: grid; width: 25px; height: 25px; place-items: center; border-radius: 50%; color: #111; background: var(--brand); font: 800 9px/1 var(--mono); }
    .brand-pill strong { font-size: 12px; font-weight: 650; }
    .brand-pill span:last-child { color: var(--muted-foreground); font-size: 10px; }
    .question-rail { display: flex; flex-direction: column; overflow: hidden; pointer-events: auto; }
    .rail-head { display: grid; width: 100%; min-height: 56px; flex: none; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 9px 13px 9px 16px; border: 0; color: var(--muted-foreground); background: transparent; text-align: left; cursor: pointer; }
    .rail-title { min-width: 0; color: var(--ink); font-size: 14px; font-weight: 560; line-height: 1.35; overflow-wrap: anywhere; white-space: normal; }
    .rail-position { flex: none; color: var(--brand); font: 9px/1 var(--mono); }
    .rail-chevron { width: 14px; height: 14px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; transition: transform .2s cubic-bezier(.22, 1, .36, 1); }
    .session-tabs { display: grid; width: 100%; min-height: 0; gap: 3px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; }
    .session-tabs::-webkit-scrollbar { display: none; }
    .session-tab { display: grid; grid-template-columns: 23px minmax(0, 1fr) auto; gap: 8px; align-items: center; width: 100%; padding: 10px; border: 0; border-radius: 16px; color: var(--muted-foreground); background: transparent; text-align: left; cursor: pointer; content-visibility: auto; contain-intrinsic-size: 48px; }
    .session-tab:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 4%, transparent); }
    .session-tab[aria-selected="true"] { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
    .tab-number { color: var(--muted-foreground); font: 9px/1 var(--mono); }
    .session-tab[aria-selected="true"] .tab-number { color: var(--brand); }
    .tab-copy { min-width: 0; overflow: visible; font-size: 11px; font-weight: 560; line-height: 1.375; overflow-wrap: anywhere; white-space: normal; }
    .tab-family { padding: 3px 5px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted-foreground); font: 7px/1 var(--mono); letter-spacing: .03em; text-transform: uppercase; }

    .floating-actions .fit-button { min-width: 44px; font-size: 10px; font-weight: 620; }
    .floating-actions.is-static [data-zoom] { display: none; }

    .share-dialog { width: min(460px, calc(100vw - 32px)); max-height: min(680px, calc(100dvh - 32px)); padding: 0; overflow: visible; border: 0; border-radius: 28px; color: var(--ink); background: transparent; }
    .share-dialog::backdrop { background: rgba(0, 0, 0, .58); backdrop-filter: blur(6px); }
    .share-dialog-card { display: grid; max-height: min(680px, calc(100dvh - 32px)); grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; border-radius: 28px; color: var(--card-foreground); background: var(--card); box-shadow: 0 28px 90px rgba(0, 0, 0, .42), var(--custom-shadow); animation: share-dialog-in .24s cubic-bezier(.22, 1, .36, 1); }
    .share-dialog-head { display: flex; align-items: flex-start; gap: 13px; padding: 24px 24px 0; }
    .share-dialog-icon { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 50%; color: #111; background: var(--brand); }
    .share-dialog-icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .share-dialog-copy { min-width: 0; }
    .share-dialog-eyebrow { display: block; color: var(--muted-foreground); font-size: 11px; font-weight: 500; }
    .share-dialog h2 { margin: 3px 0 0; font-size: 19px; font-weight: 570; letter-spacing: -.025em; }
    .share-dialog-close { display: grid; width: 32px; height: 32px; flex: none; place-items: center; margin-left: auto; padding: 0; border: 0; border-radius: 50%; color: var(--muted-foreground); background: transparent; cursor: pointer; }
    .share-dialog-close:hover { color: var(--foreground); background: var(--muted-surface); }
    .share-dialog-close svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .share-dialog-body { display: grid; gap: 14px; min-height: 0; padding: 20px 24px 24px; overflow-y: auto; }
    .share-dialog-body > p { margin: 0; color: var(--muted-foreground); font-size: 13px; line-height: 1.625; }
    [data-share-intro] { display: grid; gap: 14px; }
    [data-share-intro] > p, .share-result > p { margin: 0; color: var(--muted-foreground); font-size: 13px; line-height: 1.625; }
    .share-warning { padding: 13px 14px; border-radius: 16px; background: color-mix(in oklab, var(--brand) 9%, var(--background)); font-size: 12px; line-height: 1.5; }
    .share-question { display: grid; gap: 4px; padding: 13px 14px; border: 1px solid var(--line); border-radius: 16px; }
    .share-question span { color: var(--muted-foreground); font-size: 10px; }
    .share-question strong { font-size: 12px; font-weight: 520; line-height: 1.45; }
    .share-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .share-meta-item { display: grid; min-width: 0; gap: 5px; padding: 11px 12px; border: 1px solid var(--line); border-radius: 14px; }
    .share-meta-item > span { color: var(--muted-foreground); font-size: 9px; }
    .share-meta-item strong { overflow-wrap: anywhere; font-size: 11px; font-weight: 560; line-height: 1.4; }
    .share-meta-item select { width: 100%; min-width: 0; border: 0; color: var(--ink); background: transparent; font: 560 11px/1.4 var(--body); }
    .share-meta-item:first-child { grid-column: 1 / -1; }
    .share-meta-item small { color: var(--muted-foreground); font-size: 8px; line-height: 1.35; }
    [data-local-share] { display: grid; gap: 14px; }
    .share-details { border: 1px solid var(--line); border-radius: 15px; }
    .share-details summary { padding: 12px 13px; color: var(--ink); font-size: 11px; font-weight: 560; cursor: pointer; }
    .share-details ul { display: grid; gap: 6px; max-height: 170px; margin: 0; padding: 0 13px 13px 30px; overflow-y: auto; color: var(--muted-foreground); font-size: 10px; line-height: 1.45; }
    .share-findings { display: grid; gap: 7px; padding: 12px 13px; border-radius: 15px; background: color-mix(in srgb, #e86b61 10%, transparent); }
    .share-findings strong { font-size: 11px; font-weight: 600; }
    .share-findings span { color: var(--muted-foreground); font-size: 10px; line-height: 1.45; }
    .share-review-check { display: flex; align-items: flex-start; gap: 9px; color: var(--muted-foreground); font-size: 10px; line-height: 1.45; }
    .share-review-check input { width: 15px; height: 15px; flex: none; margin: 0; accent-color: var(--brand); }
    .share-manage { display: grid; gap: 9px; padding-top: 2px; }
    .share-manage > strong { font-size: 11px; font-weight: 600; }
    .share-manage p { margin: 0; color: var(--muted-foreground); font-size: 10px; line-height: 1.45; }
    .share-text-button { width: fit-content; padding: 0; border: 0; color: #e86b61; background: transparent; font-size: 10px; font-weight: 600; cursor: pointer; }
    .share-command { display: grid; gap: 7px; }
    .share-command span { color: var(--muted-foreground); font-size: 10px; }
    .share-command code { display: block; padding: 12px 13px; overflow-x: auto; border-radius: 14px; color: var(--muted-foreground); background: var(--background); font: 10px/1.55 var(--mono); white-space: nowrap; }
    .share-dialog-status { margin: 0; color: #e86b61; font-size: 12px; line-height: 1.5; }
    .share-result { display: grid; gap: 10px; }
    .share-result-link { display: grid; gap: 4px; padding: 12px 13px; border: 1px solid var(--line); border-radius: 15px; color: inherit; text-decoration: none; }
    .share-result-link:hover { background: var(--muted-surface); }
    .share-result-link span { color: var(--muted-foreground); font-size: 10px; }
    .share-result-link strong { min-width: 0; font-size: 11px; font-weight: 520; line-height: 1.4; overflow-wrap: anywhere; white-space: normal; }
    .share-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px 24px; border-top: 1px solid var(--line); }
    .share-dialog-actions button { min-height: 36px; padding: 0 15px; border: 0; border-radius: 999px; color: var(--foreground); background: var(--muted-surface); font-size: 13px; font-weight: 520; cursor: pointer; }
    .share-dialog-actions button:hover { filter: brightness(1.08); }
    .share-dialog-actions button:active { transform: scale(.97); }
    .share-dialog-actions .share-confirm { color: #111; background: var(--brand); }
    .share-dialog-actions button:disabled { opacity: .55; cursor: wait; }
    .share-result-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .share-result-actions button { min-height: 34px; padding: 0 13px; border: 0; border-radius: 999px; color: var(--ink); background: var(--muted-surface); font-size: 11px; cursor: pointer; }
    @keyframes share-dialog-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }

    .node-frame { width: 100%; height: 100%; padding: 2px; }
    .node-card { position: relative; display: flex; width: 100%; height: 100%; flex-direction: column; overflow: hidden; text-align: left; cursor: pointer; }
    .node-head { display: flex; min-height: 56px; align-items: center; gap: 10px; padding: 10px 12px; }
    .node-glyph { position: relative; display: grid; width: 28px; height: 28px; flex: none; place-items: center; border-radius: 9px; color: var(--node-color); background: color-mix(in srgb, var(--node-color) 13%, #1110); font: 700 13px/1 var(--body); }
    .node-logo-fallback { display: grid; place-items: center; }
    .node-logo { position: absolute; width: 16px; height: 16px; border-radius: 3px; object-fit: contain; opacity: 0; }
    .node-glyph.has-logo .node-logo { opacity: 1; }
    .node-glyph.has-logo .node-logo-fallback { visibility: hidden; }
    .node-copy { display: grid; min-width: 0; gap: 3px; }
    .node-copy strong, .node-copy > span { overflow-wrap: anywhere; white-space: normal; }
    .node-copy strong { font-size: 12px; font-weight: 620; line-height: 1.4; }
    .node-copy > span { color: var(--muted-foreground); font-size: 10px; line-height: 1.4; }
    .node-rows { display: grid; gap: 5px; margin: 0 12px; padding: 8px 0 10px; border-top: 1px solid var(--line); }
    .node-row { display: flex; min-width: 0; align-items: center; gap: 6px; color: #c5c6c4; font-size: 10px; font-weight: 550; }
    :root[data-theme="light"] .node-row { color: #4c504e; }
    .node-row i { color: var(--node-color); font-style: normal; }
    .node-row span { overflow-wrap: anywhere; white-space: normal; }
    .node-card[data-kind="entry"] { --node-color: #64748b; }
    .node-card[data-kind="job"] { --node-color: #f59e0b; }
    .node-card[data-kind="agent"] { --node-color: #f97316; }
    .node-card[data-kind="service"] { --node-color: #ec4899; }
    .node-card[data-kind="store"] { --node-color: #10b981; }
    .node-card[data-kind="queue"] { --node-color: #8b5cf6; }
    .node-card[data-kind="external"] { --node-color: #0ea5e9; }
    .node-card[data-kind="user"] { --node-color: #3b82f6; }

    .context-status { display: inline-flex; align-items: center; color: var(--muted-foreground); font-size: 11px; font-weight: 500; text-transform: capitalize; white-space: nowrap; }
    .rail-context { display: grid; max-height: 0; gap: 5px; padding: 0 20px; overflow: hidden; visibility: hidden; opacity: 0; border-top: 1px solid transparent; transition: max-height .22s cubic-bezier(.22,1,.36,1), padding .22s cubic-bezier(.22,1,.36,1), opacity .14s ease, visibility .14s ease; }
    .rail-context > span { color: var(--muted-foreground); font-size: 10px; font-weight: 560; }
    .rail-context p { max-height: 144px; margin: 0; overflow-y: auto; color: var(--muted-foreground); font-size: 12px; line-height: 1.625; overflow-wrap: anywhere; }

    .legend { position: fixed; bottom: 82px; left: 50%; z-index: 20; display: flex; gap: 4px; padding: 6px 8px; border-radius: 999px; transform: translateX(-50%); }
    .legend button { display: flex; align-items: center; gap: 6px; padding: 7px 9px; border: 0; border-radius: 999px; color: var(--muted-foreground); background: transparent; font-size: 8px; font-weight: 650; letter-spacing: .07em; text-transform: uppercase; cursor: default; transition: opacity .2s ease, color .2s ease, background .2s ease; }
    .legend button:hover, .legend button.is-active { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
    .legend button.is-dimmed { opacity: .3; }
    .legend i { width: 5px; height: 5px; border-radius: 50%; background: var(--brand); }

    .node-popover { position: fixed; z-index: 30; width: 245px; padding: 15px 16px; border-radius: 16px; }
    .popover-kind { color: var(--muted-foreground); font-size: 9px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
    .popover-kind-icon img { display: inline-flex; width: 12px; height: 12px; border-radius: 2px; object-fit: contain; }
    .node-popover h2 { margin: 6px 0 0; font-size: 13px; font-weight: 650; }
    .node-popover p { margin: 5px 0 0; color: var(--muted-foreground); font-size: 10px; line-height: 1.45; }
    .node-popover .popover-detail { color: var(--ink); }
    .node-popover code { display: block; margin-top: 8px; overflow-wrap: anywhere; color: var(--muted-foreground); font: 9px/1.4 var(--mono); }
    .node-popover button { display: flex; width: 100%; justify-content: space-between; margin-top: 11px; padding: 9px 0 0; border: 0; border-top: 1px solid var(--line); color: var(--muted-foreground); background: none; font-size: 9px; cursor: pointer; }
    .node-popover button:hover { color: var(--ink); }
    kbd { color: var(--muted-foreground); font: 8px/1 var(--mono); }

    @media (min-width: 781px) and (max-width: 1279px) {
      .floating-actions [data-zoom="out"], .floating-actions [data-zoom="in"] { display: none; }
    }

    @media (max-width: 780px) {
      .floating-dock { top: 12px; left: 12px; width: calc(100vw - 24px); }
      .brand-pill { padding: 7px 11px 7px 8px; }
      .brand-pill .powered-label { display: none; }
      .session-tabs { display: grid; gap: 3px; overflow-x: hidden; overflow-y: auto; scroll-snap-type: none; }
      .session-tab { min-width: 0; min-height: 48px; padding: 8px 10px; }
      .tab-copy { font-size: 12px; line-height: 1.3; }
      .floating-actions { top: 12px; right: 12px; }
      .floating-actions [data-zoom="out"], .floating-actions [data-zoom="in"] { display: none; }
      .floating-actions .share-button { width: auto; padding-inline: 10px; }
      .legend { display: none; }
      .share-dialog { width: calc(100vw - 24px); max-height: calc(100dvh - 24px); margin: auto 12px 12px; }
      .share-dialog-card { max-height: calc(100dvh - 24px); border-radius: 24px; }
      .share-dialog-head { padding: 20px 20px 0; }
      .share-dialog-body { padding: 18px 20px 20px; }
      .share-dialog-actions { padding: 14px 12px 20px; }
      .share-dialog-actions button { flex: 1; padding-inline: 8px; font-size: 12px; white-space: nowrap; }
      .share-meta { grid-template-columns: 1fr; }
    }

    @media (max-width: 480px) {
      .tab-family { display: none; }
    }

    @media (max-width: 780px) and (max-height: 500px) {
      .floating-dock { top: 8px; }
      .brand-pill { padding-block: 6px; }
      .session-tab { min-height: 48px; }
      .floating-actions { top: 8px; right: 8px; }
    }

    @media (max-width: 360px) {
      .floating-actions .share-button .icon-swap { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    }
  </style>`;
}


export async function renderSession(
  manifest: SessionManifest,
  documents: DiagramDocument[],
  { logoSources = new Map<string, string>() }: { logoSources?: ReadonlyMap<string, string> } = {},
): Promise<string> {
  const firstDocument = documents[0];
  if (!firstDocument) throw new Error("cannot render an empty Grill Visuals session");
  const panelMarkup = await Promise.all(
    documents.map(async (document, index) => {
      if (document.family !== "architecture") return renderFamilyPanel(document, index);
      return renderPanel(document, await layoutArchitecture(document), index, logoSources);
    }),
  );
  const data = {
    version: 1,
    session: manifest.session,
    logos: Object.fromEntries(logoSources),
    documents: documents.map((document) => ({
      id: document.id,
      family: document.family,
      title: document.title,
      summary: document.summary,
      status: document.status,
      options: document.options,
      data: document.data,
      nodes: document.family === "architecture" ? document.data.nodes : [],
      edges: document.family === "architecture" ? document.data.edges : [],
    })),
  };
  const tabs = documents
    .map(
      (document, index) => `<button class="session-tab" id="tab-${document.id}" type="button" role="tab" aria-controls="panel-${document.id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-document-id="${escapeHtml(document.id)}">
        <span class="tab-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="tab-copy">${escapeHtml(document.title)}</span>
        <span class="tab-family">${escapeHtml(document.family)}</span>
      </button>`,
    )
    .join("\n");
  const panels = panelMarkup.join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="grill-visuals-session" content="${escapeHtml(manifest.session)}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; font-src 'self'; img-src data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="description" content="${escapeHtml(manifest.session)} Grill Me visual session">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%230c0d0d'/%3E%3Ccircle cx='32' cy='32' r='24' fill='%23ff7a1a'/%3E%3Ctext x='32' y='38' text-anchor='middle' fill='%230c0d0d' font-family='monospace' font-size='16' font-weight='800'%3EGV%3C/text%3E%3C/svg%3E">
  <title>${escapeHtml(manifest.session)} · Grill Visuals</title>
  ${styles()}
  ${familyStyles()}
  ${visualSystemStyles()}
</head>
<body>
  <div class="app-shell" data-grab-component="GrillVisualsAppShell" data-grab-source="src/renderer.ts#renderSession">
    <div class="floating-dock" data-grab-component="BrandDock" data-grab-source="src/renderer.ts#renderSession">
      <div class="brand-pill"><span class="powered-label">Powered by</span><span class="brand-lockup"><svg class="brand-mark" viewBox="0 0 96 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="currentColor"></circle><circle cx="48" cy="24" r="24" fill="#0090FD"></circle><circle cx="72" cy="24" r="24" fill="#FF5513"></circle></svg><strong>Grill Visuals</strong></span></div>
    </div>
    <aside class="question-rail" data-question-selector data-expanded="false" data-grab-component="QuestionSelector" data-grab-source="src/renderer.ts#renderSession" aria-label="Session questions">
      <button class="rail-head" type="button" aria-expanded="false" aria-controls="question-tabs">
        <span class="context-status" data-rail-status data-status="${escapeHtml(firstDocument.status)}"><span data-rail-status-label>${escapeHtml(firstDocument.status)}</span></span>
        <strong class="rail-title" data-rail-title>${escapeHtml(firstDocument.title)}</strong>
        <span class="rail-position" data-rail-position>1/${documents.length}</span>
        <svg class="rail-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg>
      </button>
      <nav class="session-tabs" id="question-tabs" role="tablist" aria-label="Questions">${tabs}</nav>
      <aside class="rail-context" aria-label="Current question context" aria-live="polite"><span>Context</span><p data-rail-summary>${escapeHtml(firstDocument.summary)}</p></aside>
    </aside>
    <div class="floating-actions" data-grab-component="DiagramToolbar" data-grab-source="src/renderer.ts#renderSession" aria-label="Diagram controls">
      <button type="button" class="share-button" data-share aria-label="Publish" title="Publish this session" aria-haspopup="dialog" aria-controls="share-dialog"><span class="icon-swap" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"></path></svg></span><span data-share-label>Publish</span></button>
      <button type="button" class="icon-button" data-zoom="out" aria-label="Zoom out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg></button>
      <button type="button" class="fit-button" data-zoom="fit" title="Fit diagram">Fit</button>
      <button type="button" class="icon-button" data-zoom="in" aria-label="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg></button>
      <button type="button" class="icon-button" data-theme-toggle aria-label="Toggle theme"><span class="icon-swap" aria-hidden="true"><svg class="theme-glyph" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"></path></svg></span></button>
    </div>
    <main>${panels}</main>
  </div>
  <dialog class="share-dialog" id="share-dialog" data-share-dialog aria-labelledby="share-dialog-title">
    <div class="share-dialog-card" data-grab-component="PublicShareDialog" data-grab-source="src/renderer.ts#renderSession">
      <header class="share-dialog-head">
        <span class="share-dialog-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"></path></svg></span>
        <div class="share-dialog-copy"><span class="share-dialog-eyebrow">Cloudflare Pages</span><h2 id="share-dialog-title" data-share-title>Make this session public?</h2></div>
        <button type="button" class="share-dialog-close" data-share-close aria-label="Close share dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg></button>
      </header>
      <div class="share-dialog-body">
        <div data-share-intro>
          <p data-share-description>Grill Visuals will publish the current local session to your Cloudflare Pages account.</p>
          <div class="share-warning"><span>Anyone with the link can view this session. Search indexing is discouraged, but this is not access control.</span></div>
          <div data-local-share>
            <div class="share-meta">
              <label class="share-meta-item"><span>Cloudflare account</span><select data-share-account aria-label="Cloudflare account"></select><small data-share-account-usage></small></label>
              <div class="share-meta-item"><span>Publishes</span><strong data-share-scope></strong></div>
              <div class="share-meta-item"><span>Opens at</span><strong data-share-question></strong></div>
              <div class="share-meta-item"><span>Public lifetime</span><strong>Until you unshare it</strong></div>
            </div>
            <details class="share-details" data-share-review><summary data-share-review-label>Review all questions</summary><ul data-share-question-list></ul></details>
            <details class="share-details" data-share-changes hidden><summary data-share-change-label>Review changes</summary><ul data-share-change-list></ul></details>
            <div class="share-findings" data-share-blocked hidden><strong>Publishing blocked</strong><span data-share-blocked-copy></span></div>
            <div class="share-findings" data-share-warnings hidden><strong>Review privacy warnings</strong><span data-share-warning-copy></span></div>
            <label class="share-review-check" data-share-warning-check hidden><input type="checkbox" data-share-reviewed> I reviewed these matches and they are safe to publish.</label>
            <div class="share-manage" data-share-manage hidden><strong>Manage public share</strong><p data-share-manage-copy></p><button class="share-text-button" type="button" data-share-unshare>Unshare…</button></div>
          </div>
          <div class="share-command" data-share-command-wrap><span>Fallback command</span><code data-share-command></code></div>
        </div>
        <p class="share-dialog-status" data-share-status role="status" hidden></p>
        <div class="share-result" data-share-result hidden>
          <p data-share-result-copy>The stable link follows future updates. The exact-version link never changes.</p>
          <a class="share-result-link" data-share-stable target="_blank" rel="noreferrer"><span>Stable session</span><strong></strong></a>
          <a class="share-result-link" data-share-immutable target="_blank" rel="noreferrer"><span>Exact version</span><strong></strong></a>
          <div class="share-result-actions"><button type="button" data-share-copy-result>Copy public link</button><button type="button" data-share-verify hidden>Verify again</button><button type="button" data-share-result-unshare hidden>Unshare…</button></div>
        </div>
      </div>
      <footer class="share-dialog-actions">
        <button type="button" data-share-cancel data-share-close>Cancel</button>
        <button type="button" class="share-confirm" data-share-confirm>Publish publicly</button>
      </footer>
    </div>
  </dialog>
  <script type="application/json" id="grill-visuals-data">${safeJson(data)}</script>
  <script src="./motion.js"></script>
  <script src="./viewer.js"></script>
  <script src="./react-grab.js" data-options='{"maxContextLines":50}'></script>
</body>
</html>`;
}
