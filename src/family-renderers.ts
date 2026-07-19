import {
  layoutMindMap,
  layoutQuadrant,
  layoutSequence,
  layoutState,
  layoutTimeline,
} from "./family-layouts.js";
import type {
  MindMapLayout,
  PlacedTransition,
  QuadrantLayout,
  SequenceLayout,
  StateLayout,
  TimelineLayout,
} from "./family-layouts.js";
import type {
  ComparisonDocument,
  ComparisonRating,
  DiagramDocument,
  MindMapDocument,
  MindNode,
  QuadrantDocument,
  SequenceDocument,
  StateDocument,
  TimelineDocument,
} from "./types.js";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inspectAttributes({ title, kind, description, detail = "" }: { title: string; kind: string; description: string; detail?: string | undefined }): string {
  return `data-grab-component="FamilyDiagramItem" data-grab-source="src/family-renderers.ts" data-inspect-title="${escapeHtml(title)}" data-inspect-kind="${escapeHtml(kind)}" data-inspect-description="${escapeHtml(description)}" data-inspect-detail="${escapeHtml(detail)}"`;
}

function motionDelay(x: number, y: number, layout: { width: number; height: number }): number {
  return (0.15 + ((x + y) / Math.max(1, layout.width + layout.height)) * 0.9) * 1000;
}

function inspector() {
  return `<aside class="family-popover" aria-live="polite" aria-label="Selected diagram detail" hidden>
    <span class="family-popover-kind"></span>
    <h2></h2>
    <p class="family-popover-description"></p>
    <p class="family-popover-detail"></p>
  </aside>`;
}

function textEquivalent(title: string, contents: string): string {
  return `<section class="sr-only diagram-text-equivalent" aria-label="Text description of ${escapeHtml(title)}">${contents}</section>`;
}

function textSection(title: string, items: string[]): string {
  return `<section><h3>${escapeHtml(title)}</h3><ol>${items.join("")}</ol></section>`;
}

export function renderOptionDock(document: DiagramDocument): string {
  return `<nav class="answer-options" data-grab-component="AnswerOptionDock" data-grab-source="src/family-renderers.ts#renderOptionDock" aria-label="Answer options">
    <span class="answer-options-label">Options</span>
    ${document.options.map((option) => `<button type="button" class="answer-option" data-grab-component="AnswerOption" data-grab-source="src/family-renderers.ts#renderOptionDock" data-answer-option="${escapeHtml(option.id)}" data-highlights="${option.highlights.map(escapeHtml).join(" ")}" data-recommended="${option.recommended === true}" aria-pressed="false" aria-describedby="${escapeHtml(document.id)}-option-${escapeHtml(option.id)}">
      <span>${escapeHtml(option.label)}</span>${option.recommended ? `<em>Recommended</em>` : ""}
      <span class="option-explanation" id="${escapeHtml(document.id)}-option-${escapeHtml(option.id)}" role="tooltip"><strong>${option.recommended ? "Why recommended" : "Tradeoff"}</strong>${escapeHtml(option.description)}</span>
    </button>`).join("")}
  </nav>`;
}

function panelShell(document: DiagramDocument, index: number, body: string, text: string, { canvas = true }: { canvas?: boolean } = {}): string {
  return `<section class="diagram-panel family-panel family-${escapeHtml(document.family)}" id="panel-${document.id}" role="tabpanel" aria-labelledby="tab-${document.id}" ${index === 0 ? "" : "hidden"} data-grab-component="FamilyDiagramPanel" data-grab-source="src/family-renderers.ts#panelShell" data-document-id="${escapeHtml(document.id)}" data-family="${escapeHtml(document.family)}" data-canvas="${canvas}">
    ${body}
    ${inspector()}
    ${renderOptionDock(document)}
    ${textEquivalent(document.title, text)}
  </section>`;
}

function renderSequence(document: SequenceDocument, layout: SequenceLayout, index: number): string {
  const markerId = `sequence-arrow-${document.id}`;
  const participants = layout.participants.map((participant) => `
    <line class="sequence-lifeline" data-sequence-related="${escapeHtml(participant.id)}" x1="${participant.x + participant.width / 2}" y1="${participant.y + participant.height}" x2="${participant.x + participant.width / 2}" y2="${layout.lifelineBottom}"></line>
    <foreignObject class="sequence-participant-object" x="${participant.x}" y="${participant.y}" width="${participant.width}" height="${participant.height}">
      <button xmlns="http://www.w3.org/1999/xhtml" type="button" class="sequence-participant" data-motion-enter="node" data-motion-delay="${motionDelay(participant.x, participant.y, layout)}" data-sequence-participant="${escapeHtml(participant.id)}" data-highlight-id="${escapeHtml(participant.id)}" ${inspectAttributes({ title: participant.label, kind: participant.kind, description: participant.description })}>
        <span class="sequence-avatar" data-kind="${escapeHtml(participant.kind)}" aria-hidden="true">${escapeHtml(participant.label.slice(0, 1))}</span>
        <span><strong>${escapeHtml(participant.label)}</strong><small>${escapeHtml(participant.description)}</small></span>
      </button>
    </foreignObject>`).join("");
  const messages = layout.messages.map((message) => {
    const delay = motionDelay(message.labelX, message.labelY, layout) + 250;
    return `
    <g class="sequence-message" data-sequence-message="${message.index}" data-source="${escapeHtml(message.source)}" data-target="${escapeHtml(message.target)}" data-highlight-id="${escapeHtml(message.id)}" data-highlight-links="${escapeHtml(message.source)} ${escapeHtml(message.target)}">
      <path class="sequence-message-line" data-motion-enter="edge" data-motion-delay="${delay}" pathLength="1" d="${message.path}" marker-end="url(#${markerId})"></path>
      <foreignObject x="${message.labelX - 126}" y="${message.labelY - 20}" width="252" height="44">
        <button xmlns="http://www.w3.org/1999/xhtml" type="button" class="sequence-message-label" data-motion-enter="fade" data-motion-delay="${delay + 350}" data-sequence-step="${message.index}" ${inspectAttributes({ title: message.label, kind: `Step ${message.index + 1} · ${message.kind}`, description: message.description ?? `${message.source} to ${message.target}` })}>
          <span>${String(message.index + 1).padStart(2, "0")}</span><strong>${escapeHtml(message.label)}</strong>
        </button>
      </foreignObject>
    </g>`;
  }).join("");
  const body = `<div class="graph-stage" data-stage>
    <svg class="architecture-map family-map sequence-map" data-graph data-width="${layout.width}" data-height="${layout.height}" role="group" aria-label="Interactive sequence diagram for ${escapeHtml(document.title)}" tabindex="0">
      <defs><marker id="${markerId}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" class="sequence-arrow"></path></marker></defs>
      <g data-viewport>${participants}${messages}</g>
    </svg>
  </div>`;
  const participantItems = document.data.participants.map((item) => `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.kind)} — ${escapeHtml(item.description)}</span></li>`);
  const messageItems = document.data.messages.map((item, messageIndex) => `<li><strong>${messageIndex + 1}. ${escapeHtml(item.label)}</strong><span>${escapeHtml(item.source)} → ${escapeHtml(item.target)} · ${escapeHtml(item.kind)}</span>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</li>`);
  return panelShell(document, index, body, textSection("Participants", participantItems) + textSection("Messages", messageItems));
}

function stateLabelOffset(transition: PlacedTransition): PlacedTransition["labelPosition"] {
  let longest = null;
  for (let index = 0; index < transition.points.length - 1; index += 1) {
    const from = transition.points[index];
    const to = transition.points[index + 1];
    if (!from || !to) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (!longest || length > longest.length) longest = { from, to, length };
  }
  const position = transition.labelPosition;
  if (!position || !longest) return position;
  const horizontal = Math.abs(longest.to.x - longest.from.x) >= Math.abs(longest.to.y - longest.from.y);
  return horizontal
    ? { ...position, y: position.y - 18 }
    : { ...position, x: position.x + position.width / 2 + 14 };
}

function renderState(document: StateDocument, layout: StateLayout, index: number): string {
  const markerId = `state-arrow-${document.id}`;
  const transitions = layout.transitions.map((transition, transitionIndex) => {
    const label = stateLabelOffset(transition);
    const delay = motionDelay(label?.x ?? transitionIndex * 80, label?.y ?? 0, layout) + 250;
    return `<g class="state-transition" data-state-transition="${transitionIndex}" data-source="${escapeHtml(transition.source)}" data-target="${escapeHtml(transition.target)}" data-highlight-id="${escapeHtml(transition.id)}" data-highlight-links="${escapeHtml(transition.source)} ${escapeHtml(transition.target)}">
      <path class="state-transition-line" data-motion-enter="edge" data-motion-delay="${delay}" pathLength="1" d="${transition.path}" marker-end="url(#${markerId})"></path>
      ${label ? `<foreignObject x="${label.x - label.width / 2}" y="${label.y - label.height / 2}" width="${label.width}" height="${label.height}"><button xmlns="http://www.w3.org/1999/xhtml" type="button" class="state-transition-label" data-motion-enter="fade" data-motion-delay="${delay + 350}" ${inspectAttributes({ title: transition.event, kind: "Transition", description: transition.description ?? `${transition.source} to ${transition.target}`, detail: transition.guard ? `Guard: ${transition.guard}` : "" })}>${escapeHtml(transition.event)}${transition.guard ? `<small>[${escapeHtml(transition.guard)}]</small>` : ""}</button></foreignObject>` : ""}
    </g>`;
  }).join("");
  const states = layout.states.map((state) => `<foreignObject class="state-object" x="${state.x}" y="${state.y}" width="${state.width}" height="${state.height}">
    <button xmlns="http://www.w3.org/1999/xhtml" type="button" class="state-card" data-motion-enter="node" data-motion-delay="${motionDelay(state.x, state.y, layout)}" data-state-id="${escapeHtml(state.id)}" data-highlight-id="${escapeHtml(state.id)}" data-kind="${escapeHtml(state.kind)}" ${inspectAttributes({ title: state.label, kind: state.kind, description: state.description, detail: state.detail })}>
      <i aria-hidden="true"></i><span><strong>${escapeHtml(state.label)}</strong><small>${escapeHtml(state.description)}</small></span>
    </button>
  </foreignObject>`).join("");
  const body = `<div class="graph-stage" data-stage><svg class="architecture-map family-map state-map" data-graph data-width="${layout.width}" data-height="${layout.height}" role="group" aria-label="Interactive state diagram for ${escapeHtml(document.title)}" tabindex="0">
    <defs><marker id="${markerId}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" class="state-arrow"></path></marker></defs>
    <g data-viewport><g>${transitions}</g><g>${states}</g></g>
  </svg></div>`;
  const stateItems = document.data.states.map((item) => `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.kind)} — ${escapeHtml(item.description)}</span>${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ""}</li>`);
  const transitionItems = document.data.transitions.map((item) => `<li><strong>${escapeHtml(item.event)}</strong><span>${escapeHtml(item.source)} → ${escapeHtml(item.target)}</span>${item.guard ? `<p>Guard: ${escapeHtml(item.guard)}</p>` : ""}</li>`);
  return panelShell(document, index, body, textSection("States", stateItems) + textSection("Transitions", transitionItems));
}

interface MindTextItem extends MindNode { depth: number }

function flattenMind(node: MindNode, depth = 0, output: MindTextItem[] = []): MindTextItem[] {
  output.push({ ...node, depth });
  node.children?.forEach((child) => flattenMind(child, depth + 1, output));
  return output;
}

function renderMindMap(document: MindMapDocument, layout: MindMapLayout, index: number): string {
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const edges = layout.edges.map((edge) => {
    const source = nodeById.get(edge.parentId);
    return `<path class="mind-edge" data-motion-enter="edge" data-motion-delay="${motionDelay(source?.x ?? 0, 0, layout) + 250}" pathLength="1" data-mind-parent="${escapeHtml(edge.parentId)}" data-mind-child="${escapeHtml(edge.childId)}" d="${edge.path}"></path>`;
  }).join("");
  const nodes = layout.nodes.map((node) => `<foreignObject class="mind-object" data-mind-object="${escapeHtml(node.id)}" data-highlight-id="${escapeHtml(node.id)}" data-parent-id="${escapeHtml(node.parentId ?? "")}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="mind-node-shell" data-motion-enter="node" data-motion-delay="${motionDelay(node.x, node.y, layout)}">
      <button type="button" class="mind-card" data-mind-id="${escapeHtml(node.id)}" data-kind="${escapeHtml(node.kind)}" ${inspectAttributes({ title: node.label, kind: node.kind, description: node.description })}><i aria-hidden="true"></i><span><strong>${escapeHtml(node.label)}</strong><small>${escapeHtml(node.description)}</small></span></button>
      ${node.children?.length ? `<button type="button" class="mind-toggle" data-mind-toggle="${escapeHtml(node.id)}" aria-label="Collapse ${escapeHtml(node.label)} branch" aria-expanded="true">−</button>` : ""}
    </div>
  </foreignObject>`).join("");
  const body = `<div class="graph-stage" data-stage><svg class="architecture-map family-map mind-map" data-graph data-width="${layout.width}" data-height="${layout.height}" role="group" aria-label="Interactive mind map for ${escapeHtml(document.title)}" tabindex="0"><g data-viewport><g>${edges}</g><g>${nodes}</g></g></svg></div>`;
  const items = flattenMind(document.data.root).map((item) => `<li style="margin-left:${item.depth * 12}px"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.kind)} — ${escapeHtml(item.description)}</span></li>`);
  return panelShell(document, index, body, textSection("Branches", items));
}

function renderTimeline(document: TimelineDocument, layout: TimelineLayout, index: number): string {
  const events = layout.events.map((event) => `<g class="timeline-event" data-timeline-group="${escapeHtml(event.id)}" data-highlight-id="${escapeHtml(event.id)}">
    <line class="timeline-stem" x1="${event.pointX}" y1="${layout.axisY}" x2="${event.pointX}" y2="${event.above ? event.y + event.height : event.y}"></line>
    <circle class="timeline-dot" data-status="${escapeHtml(event.status)}" cx="${event.pointX}" cy="${event.pointY}" r="7"></circle>
    <foreignObject x="${event.x}" y="${event.y}" width="${event.width}" height="${event.height}"><button xmlns="http://www.w3.org/1999/xhtml" type="button" class="timeline-card" data-motion-enter="node" data-motion-delay="${motionDelay(event.x, event.y, layout)}" data-timeline-event="${event.index}" data-status="${escapeHtml(event.status)}" ${inspectAttributes({ title: event.label, kind: event.date, description: event.description, detail: event.detail })}><span class="timeline-date">${escapeHtml(event.date)}</span><strong>${escapeHtml(event.label)}</strong><small>${escapeHtml(event.description)}</small></button></foreignObject>
  </g>`).join("");
  const body = `<div class="graph-stage timeline-stage" data-stage><svg class="architecture-map family-map timeline-map" data-graph data-width="${layout.width}" data-height="${layout.height}" role="group" aria-label="Interactive timeline for ${escapeHtml(document.title)}" tabindex="0"><g data-viewport><line class="timeline-axis" x1="80" y1="${layout.axisY}" x2="${layout.width - 80}" y2="${layout.axisY}"></line>${events}</g></svg></div>`;
  const items = document.data.events.map((item) => `<li><strong>${escapeHtml(item.date)} · ${escapeHtml(item.label)}</strong><span>${escapeHtml(item.status)} — ${escapeHtml(item.description)}</span>${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ""}</li>`);
  return panelShell(document, index, body, textSection("Events", items));
}

function renderQuadrant(document: QuadrantDocument, layout: QuadrantLayout, index: number): string {
  const { plot } = layout;
  const verticals = [25, 50, 75].map((value) => `<line class="quadrant-grid" x1="${plot.x + plot.width * value / 100}" y1="${plot.y}" x2="${plot.x + plot.width * value / 100}" y2="${plot.y + plot.height}"></line>`).join("");
  const horizontals = [25, 50, 75].map((value) => `<line class="quadrant-grid" x1="${plot.x}" y1="${plot.y + plot.height * value / 100}" x2="${plot.x + plot.width}" y2="${plot.y + plot.height * value / 100}"></line>`).join("");
  const points = layout.points.map((point) => `<g class="quadrant-point" data-quadrant-point="${escapeHtml(point.id)}" data-highlight-id="${escapeHtml(point.id)}" data-quadrant-group="${escapeHtml(point.group)}" data-label-side="${point.labelBox.side}">
    <path class="quadrant-leader" d="${point.labelBox.connectorPath}"></path>
    <circle class="quadrant-orbit" cx="${point.cx}" cy="${point.cy}" r="15"></circle><circle class="quadrant-core" cx="${point.cx}" cy="${point.cy}" r="5"></circle>
    <foreignObject x="${point.labelBox.x}" y="${point.labelBox.y}" width="${point.labelBox.width}" height="${point.labelBox.height}"><button xmlns="http://www.w3.org/1999/xhtml" type="button" class="quadrant-label" data-motion-enter="node" data-motion-delay="${motionDelay(point.cx, point.cy, layout)}" ${inspectAttributes({ title: point.label, kind: point.group, description: point.description, detail: point.detail })}>${escapeHtml(point.label)}</button></foreignObject>
  </g>`).join("");
  const groups = [...new Set(document.data.points.map((point) => point.group))];
  const legend = `<nav class="quadrant-legend" aria-label="Filter point groups">${groups.map((group) => `<button type="button" data-quadrant-filter="${escapeHtml(group)}" aria-pressed="false">${escapeHtml(group)}</button>`).join("")}</nav>`;
  const body = `<div class="graph-stage quadrant-stage" data-stage><svg class="architecture-map family-map quadrant-map" data-graph data-width="${layout.width}" data-height="${layout.height}" role="group" aria-label="Interactive quadrant for ${escapeHtml(document.title)}" tabindex="0"><g data-viewport>
    <rect class="quadrant-plot" x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}" rx="26"></rect>${verticals}${horizontals}
    <line class="quadrant-midline" x1="${plot.x + plot.width / 2}" y1="${plot.y}" x2="${plot.x + plot.width / 2}" y2="${plot.y + plot.height}"></line><line class="quadrant-midline" x1="${plot.x}" y1="${plot.y + plot.height / 2}" x2="${plot.x + plot.width}" y2="${plot.y + plot.height / 2}"></line>
    <text class="quadrant-axis-label" x="${plot.x + plot.width / 2}" y="${plot.y + plot.height + 70}" text-anchor="middle">${escapeHtml(document.data.axes.x.label)}</text><text class="quadrant-end-label" x="${plot.x}" y="${plot.y + plot.height + 40}">${escapeHtml(document.data.axes.x.low)}</text><text class="quadrant-end-label" x="${plot.x + plot.width}" y="${plot.y + plot.height + 40}" text-anchor="end">${escapeHtml(document.data.axes.x.high)}</text>
    <text class="quadrant-axis-label" x="24" y="${plot.y + plot.height / 2}" transform="rotate(-90 24 ${plot.y + plot.height / 2})" text-anchor="middle">${escapeHtml(document.data.axes.y.label)}</text><text class="quadrant-end-label" x="${plot.x - 28}" y="${plot.y + plot.height}">${escapeHtml(document.data.axes.y.low)}</text><text class="quadrant-end-label" x="${plot.x - 28}" y="${plot.y + 10}">${escapeHtml(document.data.axes.y.high)}</text>
    <text class="quadrant-zone" x="${plot.x + 28}" y="${plot.y + 36}">Strategic bets</text><text class="quadrant-zone" x="${plot.x + plot.width - 28}" y="${plot.y + 36}" text-anchor="end">Ship now</text><text class="quadrant-zone" x="${plot.x + 28}" y="${plot.y + plot.height - 24}">Explore later</text><text class="quadrant-zone" x="${plot.x + plot.width - 28}" y="${plot.y + plot.height - 24}" text-anchor="end">Easy wins</text>
    ${points}
  </g></svg></div>${legend}`;
  const axisItems = [`<li><strong>${escapeHtml(document.data.axes.x.label)}</strong><span>${escapeHtml(document.data.axes.x.low)} → ${escapeHtml(document.data.axes.x.high)}</span></li>`, `<li><strong>${escapeHtml(document.data.axes.y.label)}</strong><span>${escapeHtml(document.data.axes.y.low)} → ${escapeHtml(document.data.axes.y.high)}</span></li>`];
  const pointItems = document.data.points.map((item) => `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.group)} · x ${item.x}, y ${item.y}</span><p>${escapeHtml(item.description)}</p></li>`);
  return panelShell(document, index, body, textSection("Axes", axisItems) + textSection("Points", pointItems));
}

function scoreDots(score: number): string {
  return `<span class="score-dots" aria-hidden="true">${[1, 2, 3, 4, 5].map((value) => `<i class="${value <= score ? "is-filled" : ""}"></i>`).join("")}</span>`;
}

function renderComparison(document: ComparisonDocument, index: number): string {
  const ratingByKey = new Map<string, ComparisonRating>(document.data.ratings.map((rating) => [`${rating.criterion}:${rating.option}`, rating]));
  const headers = document.data.options.map((option) => `<th scope="col"><button type="button" class="comparison-option" data-comparison-option="${escapeHtml(option.id)}" data-highlight-id="${escapeHtml(option.id)}" ${inspectAttributes({ title: option.label, kind: option.recommended ? "Recommended option" : "Option", description: option.summary })}>${option.recommended ? `<span class="recommended-chip">Recommended</span>` : ""}<strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.summary)}</small></button></th>`).join("");
  const rows = document.data.criteria.map((criterion) => `<tr data-comparison-row="${escapeHtml(criterion.id)}">
    <th scope="row"><button type="button" class="comparison-criterion" data-comparison-criterion="${escapeHtml(criterion.id)}" data-highlight-id="${escapeHtml(criterion.id)}" ${inspectAttributes({ title: criterion.label, kind: "Criterion", description: criterion.description })}><strong>${escapeHtml(criterion.label)}</strong><small>${escapeHtml(criterion.description)}</small></button></th>
    ${document.data.options.map((option) => {
      const rating = ratingByKey.get(`${criterion.id}:${option.id}`);
      if (!rating) throw new Error(`missing comparison rating for ${criterion.id}:${option.id}`);
      return `<td data-comparison-cell="${escapeHtml(criterion.id)}:${escapeHtml(option.id)}" data-highlight-links="${escapeHtml(criterion.id)} ${escapeHtml(option.id)}"><button type="button" class="comparison-rating" data-rating-option="${escapeHtml(option.id)}" data-rating-criterion="${escapeHtml(criterion.id)}" ${inspectAttributes({ title: `${option.label} · ${criterion.label}`, kind: `${rating.score} of 5`, description: rating.rationale })}><strong>${rating.score}<span>/5</span></strong>${scoreDots(rating.score)}</button></td>`;
    }).join("")}
  </tr>`).join("");
  const body = `<div class="graph-stage comparison-stage" data-stage><div class="comparison-viewport" data-graph data-viewport data-width="1320"><div class="comparison-board" data-motion-enter="node" data-motion-delay="150"><div class="comparison-kicker">Decision matrix · click any row, column, or score</div><div class="comparison-scroll"><table><thead><tr><th class="comparison-corner" aria-hidden="true"></th>${headers}</tr></thead><tbody>${rows}</tbody></table></div></div></div></div>`;
  const optionItems = document.data.options.map((item) => `<li><strong>${escapeHtml(item.label)}${item.recommended ? " — recommended" : ""}</strong><span>${escapeHtml(item.summary)}</span></li>`);
  const ratingItems = document.data.ratings.map((item) => `<li><strong>${escapeHtml(item.option)} · ${escapeHtml(item.criterion)}: ${item.score}/5</strong><span>${escapeHtml(item.rationale)}</span></li>`);
  return panelShell(document, index, body, textSection("Options", optionItems) + textSection("Ratings", ratingItems));
}

export async function renderFamilyPanel(document: Exclude<DiagramDocument, { family: "architecture" }>, index: number): Promise<string> {
  if (document.family === "comparison") return renderComparison(document, index);
  if (document.family === "sequence") return renderSequence(document, layoutSequence(document), index);
  if (document.family === "state") return renderState(document, await layoutState(document), index);
  if (document.family === "mind-map") return renderMindMap(document, layoutMindMap(document), index);
  if (document.family === "timeline") return renderTimeline(document, layoutTimeline(document), index);
  if (document.family === "quadrant") return renderQuadrant(document, layoutQuadrant(document), index);
  throw new Error("unsupported rendered family");
}

export function familyStyles(): string {
  return `<style>
    .answer-options { position: fixed; bottom: 24px; left: 50%; z-index: 24; display: flex; width: max-content; max-width: min(1040px, calc(100vw - 192px)); align-items: center; gap: 8px; padding: 10px; overflow: visible; border: 1px solid var(--line); border-radius: 999px; background: var(--card-soft); box-shadow: var(--shadow); backdrop-filter: blur(20px); transform: translateX(-50%); }
    .answer-options-label { padding: 0 7px; color: var(--muted-foreground); font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .answer-option { position: relative; display: flex; flex: none; align-items: center; gap: 5px; min-height: 32px; padding: 0 12px; border: 0; border-radius: 999px; color: var(--muted-foreground); background: var(--background); box-shadow: var(--custom-outline-shadow); font-size: 14px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: color .2s, background-color .2s, transform .2s; }
    .answer-option:hover, .answer-option:focus-visible, .answer-option[aria-pressed="true"] { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
    .answer-option:active { transform: scale(.97); }
    .answer-option em { padding: 3px 5px; border-radius: 999px; color: #111; background: var(--brand); font-size: 6px; font-style: normal; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .option-explanation { position: absolute; bottom: calc(100% + 13px); left: 50%; z-index: 40; display: grid; width: 286px; gap: 6px; padding: 13px 14px; visibility: hidden; border: 1px solid var(--line-strong); border-radius: 15px; color: var(--muted-foreground); background: var(--card); box-shadow: var(--shadow); font-size: 9px; line-height: 1.45; white-space: normal; opacity: 0; pointer-events: none; transform: translate(-50%, 5px); transition: opacity .18s, transform .18s, visibility .18s; }
    .option-explanation strong { color: var(--brand); font-size: 8px; letter-spacing: .07em; text-transform: uppercase; }
    .answer-option:hover .option-explanation, .answer-option:focus-visible .option-explanation { visibility: visible; opacity: 1; transform: translate(-50%, 0); }
    .option-dimmed { opacity: .55 !important; transition: opacity .25s; }
    .option-active { opacity: 1 !important; }
    .edge-wrap.option-active .edge-line, .sequence-message.option-active .sequence-message-line, .state-transition.option-active .state-transition-line, .mind-edge.option-active, .timeline-event.option-active .timeline-stem { stroke: var(--brand) !important; stroke-width: 2.2 !important; }
    .node-card.option-active, .sequence-participant.option-active, .state-card.option-active, .mind-object.option-active .mind-card, .timeline-event.option-active .timeline-card, .comparison-option.option-active, .comparison-criterion.option-active { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand) 66%, transparent), var(--shadow) !important; }
    .quadrant-point.option-active .quadrant-orbit { stroke: var(--brand); stroke-width: 2; fill: color-mix(in srgb, var(--brand) 23%, transparent); }
    .quadrant-point.option-active .quadrant-label { color: var(--brand); }
    td.option-active { background: color-mix(in srgb, var(--brand) 8%, transparent); }

    .family-map button { font-family: var(--body); }
    .family-popover { position: fixed; z-index: 31; right: 24px; top: 82px; width: 270px; padding: 16px 17px; border: 1px solid var(--line); border-radius: 18px; background: var(--card-soft); box-shadow: var(--shadow); backdrop-filter: blur(20px); }
    .family-popover-kind { color: var(--brand); font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .family-popover h2 { margin: 7px 0 0; font-size: 14px; }
    .family-popover p { margin: 6px 0 0; color: var(--muted-foreground); font-size: 10px; line-height: 1.5; }
    .family-popover .family-popover-detail { color: var(--ink); }

    .sequence-lifeline { stroke: var(--line-strong); stroke-width: 1; stroke-dasharray: 4 8; }
    .sequence-participant { display: flex; width: 100%; height: 100%; align-items: center; gap: 10px; padding: 10px 12px; overflow: hidden; border: 1px solid var(--line); border-radius: 15px; color: var(--ink); background: var(--card); box-shadow: var(--shadow); text-align: left; cursor: pointer; transition: opacity .3s; }
    .sequence-avatar { display: grid; width: 30px; height: 30px; flex: none; place-items: center; border-radius: 10px; color: #111; background: var(--brand); font-size: 11px; font-weight: 800; }
    .sequence-participant span:last-child { display: grid; min-width: 0; gap: 4px; }
    .sequence-participant strong, .sequence-participant small { overflow-wrap: anywhere; white-space: normal; }
    .sequence-participant strong { font-size: 11px; line-height: 1.36; }
    .sequence-participant small { color: var(--muted-foreground); font-size: 9px; line-height: 1.45; }
    .sequence-message-line { fill: none; stroke: var(--route); stroke-width: 1.4; stroke-linecap: round; }
    .sequence-arrow { fill: none; stroke: var(--route); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
    .sequence-message-label { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; gap: 8px; padding: 0 8px; border: 0; color: var(--ink); background: transparent; cursor: pointer; }
    .sequence-message-label span { color: var(--brand); font: 8px/1 var(--mono); }
    .sequence-message-label strong { padding: 2px 5px; border: 0; border-radius: 0; background: transparent; box-shadow: none; font-size: 9px; font-weight: 560; line-height: 1.35; overflow-wrap: anywhere; white-space: normal; }
    .sequence-message.is-active .sequence-message-line { stroke: var(--ink); stroke-width: 2; }
    .sequence-message.is-active .sequence-message-label strong { color: var(--brand); }
    .sequence-message.is-dimmed, .sequence-participant.is-dimmed, .sequence-lifeline.is-dimmed { opacity: .14; }

    .state-transition { transition: opacity .25s; }
    .state-transition-line { fill: none; stroke: var(--route); stroke-width: 1.4; stroke-linecap: round; }
    .state-arrow { fill: none; stroke: var(--route); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
    .state-transition-label { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; gap: 4px; padding: 0 6px; border: 0; border-radius: 0; color: var(--muted-foreground); background: transparent; box-shadow: none; font-size: 8px; line-height: 1.25; overflow-wrap: anywhere; white-space: normal; cursor: pointer; }
    .state-transition-label small { color: var(--brand); font-size: 7px; }
    .state-card { position: relative; display: flex; width: 100%; height: 100%; align-items: center; gap: 11px; padding: 12px 14px; overflow: hidden; border: 1px solid var(--line); border-radius: 34px; color: var(--ink); background: var(--card); box-shadow: var(--shadow); text-align: left; cursor: pointer; transition: opacity .3s; }
    .state-card > i { width: 13px; height: 13px; flex: none; border: 3px solid var(--state-color, var(--muted-foreground)); border-radius: 50%; box-shadow: 0 0 0 4px color-mix(in srgb, var(--state-color, var(--muted-foreground)) 10%, transparent); }
    .state-card > span { display: grid; min-width: 0; gap: 5px; }
    .state-card strong, .state-card small { overflow-wrap: anywhere; white-space: normal; }
    .state-card strong { font-size: 11px; line-height: 1.36; }
    .state-card small { color: var(--muted-foreground); font-size: 9px; line-height: 1.45; }
    .state-card[data-kind="initial"] { --state-color: #69a2dc; border-style: dashed; }
    .state-card[data-kind="success"] { --state-color: #65bb86; }
    .state-card[data-kind="failure"] { --state-color: #e86b61; }
    .state-card[data-kind="terminal"] { --state-color: #ff7a1a; box-shadow: inset 0 0 0 3px var(--card), inset 0 0 0 4px var(--line-strong), var(--shadow); }
    .state-card.is-dimmed, .state-transition.is-dimmed { opacity: .14; }
    .state-transition.is-active .state-transition-line { stroke: var(--ink); stroke-width: 2; }

    .mind-edge { fill: none; stroke: var(--route); stroke-width: 1.5; transition: opacity .25s; }
    .mind-node-shell { position: relative; width: 100%; height: 100%; }
    .mind-card { display: flex; width: 100%; height: 100%; align-items: center; gap: 10px; padding: 11px 34px 11px 13px; overflow: hidden; border: 1px solid var(--line); border-radius: 16px; color: var(--ink); background: var(--card); box-shadow: var(--shadow); text-align: left; cursor: pointer; transition: opacity .3s; }
    .mind-card > i { width: 10px; height: 10px; flex: none; border-radius: 3px; background: var(--mind-color); transform: rotate(45deg); }
    .mind-card > span { display: grid; min-width: 0; gap: 4px; }
    .mind-card strong, .mind-card small { overflow-wrap: anywhere; white-space: normal; }
    .mind-card strong { font-size: 11px; line-height: 1.36; }
    .mind-card small { color: var(--muted-foreground); font-size: 8px; line-height: 1.5; }
    .mind-card[data-kind="topic"] { --mind-color: #69a2dc; }
    .mind-card[data-kind="decision"] { --mind-color: #ff7a1a; }
    .mind-card[data-kind="risk"] { --mind-color: #e86b61; }
    .mind-card[data-kind="action"] { --mind-color: #65bb86; }
    .mind-card[data-kind="question"] { --mind-color: #9a7ddd; }
    .mind-toggle { position: absolute; top: 50%; right: 8px; display: grid; width: 22px; height: 22px; place-items: center; border: 1px solid var(--line); border-radius: 50%; color: var(--muted-foreground); background: color-mix(in srgb, var(--canvas) 70%, transparent); font-size: 11px; cursor: pointer; transform: translateY(-50%); }
    .mind-object.is-dimmed, .mind-edge.is-dimmed { opacity: .13; }
    .mind-object.is-collapsed, .mind-edge.is-collapsed { display: none; }

    .timeline-stage { background-size: 80px 80px, 80px 80px, auto, auto; }
    .timeline-axis { stroke: var(--line-strong); stroke-width: 2; }
    .timeline-stem { stroke: var(--line-strong); stroke-width: 1; stroke-dasharray: 3 6; }
    .timeline-dot { fill: var(--timeline-color); stroke: var(--canvas); stroke-width: 5; filter: drop-shadow(0 0 7px var(--timeline-color)); }
    .timeline-dot[data-status="past"] { --timeline-color: #69a2dc; }
    .timeline-dot[data-status="current"] { --timeline-color: #ff7a1a; }
    .timeline-dot[data-status="future"] { --timeline-color: #777b78; }
    .timeline-dot[data-status="risk"] { --timeline-color: #e86b61; }
    .timeline-card { display: grid; width: 100%; height: 100%; align-content: start; gap: 6px; padding: 14px 15px; overflow: hidden; border: 1px solid var(--line); border-radius: 17px; color: var(--ink); background: var(--card); box-shadow: var(--shadow); text-align: left; cursor: pointer; transition: opacity .3s; }
    .timeline-card[data-status="past"] { --timeline-color: #69a2dc; }
    .timeline-card[data-status="current"] { --timeline-color: #ff7a1a; }
    .timeline-card[data-status="future"] { --timeline-color: #777b78; }
    .timeline-card[data-status="risk"] { --timeline-color: #e86b61; }
    .timeline-date { color: var(--timeline-color); font: 8px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; }
    .timeline-card strong { font-size: 11px; }
    .timeline-card small { color: var(--muted-foreground); font-size: 9px; line-height: 1.35; }
    .timeline-event.is-dimmed { opacity: .15; }

    .quadrant-plot { fill: color-mix(in srgb, var(--card) 56%, transparent); stroke: var(--line-strong); }
    .quadrant-grid { stroke: var(--line); stroke-width: 1; stroke-dasharray: 3 7; }
    .quadrant-midline { stroke: var(--line-strong); stroke-width: 1.5; }
    .quadrant-axis-label { fill: var(--ink); font: 600 11px/1 var(--body); }
    .quadrant-end-label { fill: var(--muted-foreground); font: 9px/1 var(--body); }
    .quadrant-zone { fill: color-mix(in srgb, var(--muted-foreground) 68%, transparent); font: 700 9px/1 var(--body); letter-spacing: .08em; text-transform: uppercase; }
    .quadrant-leader { fill: none; stroke: color-mix(in srgb, var(--muted-foreground) 32%, transparent); stroke-width: 1; pointer-events: none; transition: stroke .2s, stroke-width .2s; }
    .quadrant-orbit { fill: color-mix(in srgb, var(--brand) 10%, transparent); stroke: color-mix(in srgb, var(--brand) 45%, transparent); stroke-width: 1; }
    .quadrant-core { fill: var(--brand); filter: drop-shadow(0 0 5px var(--brand)); }
    .quadrant-label { display: flex; width: 100%; height: 100%; align-items: center; padding: 0; border: 0; color: var(--ink); background: transparent; font-size: 10px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; text-align: left; white-space: normal; cursor: pointer; transition: color .2s; }
    .quadrant-point[data-label-side="left"] .quadrant-label { justify-content: flex-end; text-align: right; }
    .quadrant-point { transition: opacity .25s; }
    .quadrant-point.is-dimmed { opacity: .1; }
    .quadrant-point.is-active .quadrant-orbit { fill: color-mix(in srgb, var(--brand) 24%, transparent); stroke: var(--brand); stroke-width: 2; }
    .quadrant-point.is-active .quadrant-leader, .quadrant-point.option-active .quadrant-leader { stroke: color-mix(in srgb, var(--brand) 72%, transparent); stroke-width: 1.5; }
    .quadrant-legend { position: fixed; bottom: 82px; left: 50%; z-index: 20; display: flex; gap: 4px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 999px; background: var(--card-soft); box-shadow: var(--shadow); backdrop-filter: blur(20px); transform: translateX(-50%); }
    .quadrant-legend button { display: flex; align-items: center; gap: 6px; padding: 7px 9px; border: 0; border-radius: 999px; color: var(--muted-foreground); background: none; font-size: 8px; cursor: pointer; }
    .quadrant-legend button[aria-pressed="true"] { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }

    .comparison-stage { overflow: hidden; background: radial-gradient(circle at 65% 45%, color-mix(in srgb, var(--brand) 5%, transparent), transparent 34rem), var(--canvas); }
    .comparison-viewport { position: absolute; top: 0; left: 0; width: 1320px; }
    .comparison-board { width: 1320px; overflow: hidden; border: 1px solid var(--line); border-radius: 26px; background: var(--card-soft); box-shadow: var(--shadow); backdrop-filter: blur(20px); }
    .comparison-kicker { padding: 15px 18px; border-bottom: 1px solid var(--line); color: var(--muted-foreground); font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
    .comparison-scroll { overflow: auto; }
    .comparison-board table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .comparison-board th, .comparison-board td { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .comparison-board tr:last-child th, .comparison-board tr:last-child td { border-bottom: 0; }
    .comparison-board th:last-child, .comparison-board td:last-child { border-right: 0; }
    .comparison-corner, .comparison-board tbody th { width: 220px; }
    .comparison-option, .comparison-criterion, .comparison-rating { width: 100%; height: 100%; border: 0; color: var(--ink); background: transparent; text-align: left; cursor: pointer; transition: background .2s, opacity .2s; }
    .comparison-option { position: relative; display: grid; min-height: 108px; align-content: end; gap: 6px; padding: 18px; }
    .comparison-option strong { font-size: 12px; }
    .comparison-option small, .comparison-criterion small { color: var(--muted-foreground); font-size: 9px; line-height: 1.4; }
    .recommended-chip { position: absolute; top: 12px; left: 17px; padding: 4px 7px; border-radius: 999px; color: #111; background: var(--brand); font-size: 7px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
    .comparison-criterion { display: grid; min-height: 76px; align-content: center; gap: 5px; padding: 14px 17px; }
    .comparison-criterion strong { font-size: 10px; }
    .comparison-rating { display: flex; min-height: 76px; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; }
    .comparison-rating strong { font-size: 17px; }
    .comparison-rating strong span { color: var(--muted-foreground); font-size: 8px; }
    .score-dots { display: flex; gap: 3px; }
    .score-dots i { width: 4px; height: 14px; border-radius: 3px; background: var(--line-strong); }
    .score-dots i.is-filled { background: var(--brand); }
    .comparison-board button:hover, .comparison-board button.is-active { background: color-mix(in srgb, var(--brand) 7%, transparent); }
    .comparison-board .is-dimmed { opacity: .2; }

    @media (max-width: 780px) {
      .answer-options { top: auto; bottom: 12px; left: 12px; width: calc(100vw - 24px); max-width: none; justify-content: flex-start; overflow-x: auto; border-radius: 20px; transform: none; scrollbar-width: none; }
      .answer-options-label { position: sticky; left: 0; z-index: 2; align-self: stretch; display: flex; align-items: center; background: var(--card); }
      .answer-option { flex: none; }
      .option-explanation { position: fixed; bottom: 76px; left: 12px; width: calc(100vw - 24px); max-height: min(180px, calc(100dvh - 210px)); overflow-y: auto; transform: translateY(5px); }
      .answer-option:hover .option-explanation, .answer-option:focus .option-explanation, .answer-option:focus-visible .option-explanation { transform: none; }
      .family-popover { top: auto; right: 12px; bottom: 76px; width: calc(100vw - 24px); max-height: calc(100dvh - 210px); overflow-y: auto; }
      .quadrant-legend { display: none; }
      .comparison-board { width: 1320px; }
    }

    @media (max-width: 780px) and (max-height: 500px) {
      .answer-options { bottom: 8px; }
      .option-explanation, .family-popover { bottom: 66px; max-height: calc(100dvh - 180px); }
    }
  </style>`;
}
