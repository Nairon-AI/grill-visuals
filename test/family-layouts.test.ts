import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  layoutFamily,
  layoutMindMap,
  layoutQuadrant,
  layoutSequence,
  layoutState,
  layoutTimeline,
} from "../src/family-layouts.js";
import { isDiagramDocument } from "../src/contracts.js";
import type { DiagramDocument } from "../src/types.js";

async function fixture(name: string): Promise<DiagramDocument> {
  const value: unknown = JSON.parse(await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8"));
  if (!isDiagramDocument(value)) throw new Error(`${name} is not a valid diagram fixture`);
  return value;
}

test("lays out sequence messages against participant lifelines", async () => {
  const document = await fixture("teammate-ask-sequence.json");
  assert.equal(document.family, "sequence");
  if (document.family !== "sequence") return;
  const layout = layoutSequence(document);
  assert.equal(layout.participants.length, document.data.participants.length);
  assert.equal(layout.messages.length, document.data.messages.length);
  assert(layout.messages.every((message) => message.path.startsWith("M ")));
});

test("lays out a deterministic bilateral mind map", async () => {
  const document = await fixture("replacement-readiness-mind-map.json");
  assert.equal(document.family, "mind-map");
  if (document.family !== "mind-map") return;
  assert.deepEqual(layoutMindMap(document), layoutMindMap(document));
  const layout = layoutMindMap(document);
  assert.equal(layout.edges.length, layout.nodes.length - 1);
  assert(layout.nodes.some((node) => node.side === -1));
  assert(layout.nodes.some((node) => node.side === 1));
});

test("lays out timeline and quadrant values in their visible bounds", async () => {
  const timelineDocument = await fixture("grill-visuals-rollout-timeline.json");
  assert.equal(timelineDocument.family, "timeline");
  if (timelineDocument.family !== "timeline") return;
  const timeline = layoutTimeline(timelineDocument);
  assert.equal(timeline.events.length, timelineDocument.data.events.length);
  assert(timeline.events.every((event) => event.pointX > 0 && event.pointX < timeline.width));

  const quadrantDocument = await fixture("diagram-priority-quadrant.json");
  assert.equal(quadrantDocument.family, "quadrant");
  if (quadrantDocument.family !== "quadrant") return;
  const quadrant = layoutQuadrant(quadrantDocument);
  assert(quadrant.points.every((point) => point.cx >= quadrant.plot.x));
  assert(quadrant.points.every((point) => point.cy >= quadrant.plot.y));
  assert(quadrant.points.every((point) => point.labelBox.x >= 0));
  assert(quadrant.points.every((point) => point.labelBox.x + point.labelBox.width <= quadrant.width));
  assert(quadrant.points.every((point) => point.labelBox.y >= quadrant.plot.y));
  assert(quadrant.points.every((point) => point.cx < quadrant.plot.x + quadrant.plot.width / 2
    ? point.labelBox.x + point.labelBox.width < quadrant.plot.x
    : point.labelBox.x > quadrant.plot.x + quadrant.plot.width));
  for (let index = 0; index < quadrant.points.length; index += 1) {
    const current = quadrant.points[index]?.labelBox;
    assert(current);
    for (const point of quadrant.points.slice(index + 1)) {
      const other = point.labelBox;
      assert(current.x + current.width <= other.x || other.x + other.width <= current.x || current.y + current.height <= other.y || other.y + other.height <= current.y);
    }
  }

  const denseDocument = {
    ...quadrantDocument,
    data: {
      ...quadrantDocument.data,
      points: Array.from({ length: 30 }, (_, index) => ({
        id: `dense-${index}`,
        label: `Dense point ${index}`,
        x: 90,
        y: 90,
        group: "Dense",
        description: "Exercises worst-case label placement",
      })),
    },
  };
  const denseQuadrant = layoutQuadrant(denseDocument);
  for (let index = 0; index < denseQuadrant.points.length; index += 1) {
    const current = denseQuadrant.points[index]?.labelBox;
    assert(current);
    for (const point of denseQuadrant.points.slice(index + 1)) {
      const other = point.labelBox;
      assert(current.x + current.width <= other.x || other.x + other.width <= current.x || current.y + current.height <= other.y || other.y + other.height <= current.y);
    }
  }
});

test("dispatches the ELK state layout with valid paths", async () => {
  const document = await fixture("question-readiness-state.json");
  assert.equal(document.family, "state");
  if (document.family !== "state") return;
  const layout = await layoutFamily(document);
  assert(layout && "states" in layout);
  if (!layout || !("states" in layout)) return;
  assert.equal(layout.states.length, document.data.states.length);
  assert.equal(layout.transitions.length, document.data.transitions.length);
  assert(layout.transitions.every((transition) => transition.path.startsWith("M ")));
});

test("grows family cards instead of clipping long copy", async () => {
  const sequenceDocument = await fixture("teammate-ask-sequence.json");
  assert.equal(sequenceDocument.family, "sequence");
  if (sequenceDocument.family !== "sequence") return;
  const participant = sequenceDocument.data.participants[0];
  assert(participant);
  participant.label = "W".repeat(32);
  participant.description = "W".repeat(80);
  assert((layoutSequence(sequenceDocument).participants[0]?.height ?? 0) > 72);

  const stateDocument = await fixture("question-readiness-state.json");
  assert.equal(stateDocument.family, "state");
  if (stateDocument.family !== "state") return;
  const state = stateDocument.data.states[0];
  assert(state);
  state.label = "W".repeat(36);
  state.description = "W".repeat(100);
  assert(((await layoutState(stateDocument)).states[0]?.height ?? 0) > 84);

  const mindDocument = await fixture("replacement-readiness-mind-map.json");
  assert.equal(mindDocument.family, "mind-map");
  if (mindDocument.family !== "mind-map") return;
  mindDocument.data.root.label = "W".repeat(40);
  mindDocument.data.root.description = "W".repeat(100);
  assert((layoutMindMap(mindDocument).nodes[0]?.height ?? 0) > 74);

  const timelineDocument = await fixture("grill-visuals-rollout-timeline.json");
  assert.equal(timelineDocument.family, "timeline");
  if (timelineDocument.family !== "timeline") return;
  const event = timelineDocument.data.events[0];
  assert(event);
  event.label = "W".repeat(44);
  event.description = "W".repeat(120);
  assert((layoutTimeline(timelineDocument).events[0]?.height ?? 0) > 112);
});
