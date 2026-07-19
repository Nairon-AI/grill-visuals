import ELKConstructor from "elkjs/lib/elk.bundled.js";
import type { ELK, ElkNode } from "elkjs/lib/elk-api.js";
import { roundedOrthogonalPath } from "./layout.js";
import type {
  FamilyDocument,
  MindMapDocument,
  MindNode,
  Point,
  QuadrantDocument,
  QuadrantPoint,
  SequenceDocument,
  SequenceMessage,
  SequenceParticipant,
  Size,
  StateDocument,
  StateNode,
  StateTransition,
  TimelineDocument,
  TimelineEvent,
} from "./types.js";

const elk = new (ELKConstructor as unknown as new () => ELK)();

interface TextHeightInput {
  width: number;
  label: string;
  description: string;
  minimum: number;
  horizontalSpace: number;
  padding: number;
  labelGlyph?: number;
  descriptionGlyph?: number;
}

export interface PlacedSequenceParticipant extends SequenceParticipant, Point, Size {}
export interface PlacedSequenceMessage extends SequenceMessage {
  index: number;
  y: number;
  sourceX: number;
  targetX: number;
  direction: "self" | "left" | "right";
  path: string;
  labelX: number;
  labelY: number;
}
export interface SequenceLayout extends Size {
  participants: PlacedSequenceParticipant[];
  messages: PlacedSequenceMessage[];
  lifelineBottom: number;
}

export interface PlacedState extends StateNode, Point, Size {}
export interface PlacedTransition extends StateTransition {
  index: number;
  points: Point[];
  path: string;
  labelPosition: (Point & Size) | null;
}
export interface StateLayout extends Size {
  states: PlacedState[];
  transitions: PlacedTransition[];
}

export interface PlacedMindNode extends MindNode, Point, Size {
  parentId: string | null;
  side: -1 | 0 | 1;
  depth: number;
}
export interface MindEdge {
  parentId: string;
  childId: string;
  side: -1 | 1;
  path: string;
}
export interface MindMapLayout extends Size {
  nodes: PlacedMindNode[];
  edges: MindEdge[];
}

export interface PlacedTimelineEvent extends TimelineEvent, Point, Size {
  index: number;
  pointX: number;
  pointY: number;
  above: boolean;
}
export interface TimelineLayout extends Size {
  axisY: number;
  events: PlacedTimelineEvent[];
}

interface QuadrantPlot extends Point, Size {}
interface QuadrantLabelBox extends Point, Size {
  id: string;
  side: "left" | "right";
  connectorPath: string;
}
export interface PlacedQuadrantPoint extends QuadrantPoint {
  cx: number;
  cy: number;
  labelBox: QuadrantLabelBox;
}
export interface QuadrantLayout extends Size {
  plot: QuadrantPlot;
  points: PlacedQuadrantPoint[];
}

export type FamilyLayout = SequenceLayout | StateLayout | MindMapLayout | TimelineLayout | QuadrantLayout;

function wrappedLines(value: string, availableWidth: number, glyphWidth: number): number {
  return Math.max(1, Math.ceil(value.length / Math.max(1, Math.floor(availableWidth / glyphWidth))));
}

function stackedTextHeight({ label, description, width, minimum, horizontalSpace, padding, labelGlyph = 7, descriptionGlyph = 6 }: TextHeightInput): number {
  const copyWidth = width - horizontalSpace;
  return Math.max(
    minimum,
    padding + wrappedLines(label, copyWidth, labelGlyph) * 15 + 4 + wrappedLines(description, copyWidth, descriptionGlyph) * 13,
  );
}

export function layoutSequence(document: SequenceDocument): SequenceLayout {
  const participantWidth = 184;
  const participantGap = 116;
  const left = 88;
  const top = 54;
  const participantHeight = Math.max(72, ...document.data.participants.map((participant) => stackedTextHeight({
    label: participant.label,
    description: participant.description,
    width: participantWidth,
    minimum: 72,
    horizontalSpace: 64,
    padding: 20,
  })));
  const rowStart = top + participantHeight + 84;
  const rowGap = 88;
  const participants: PlacedSequenceParticipant[] = document.data.participants.map((participant, index) => ({
    ...participant,
    x: left + index * (participantWidth + participantGap),
    y: top,
    width: participantWidth,
    height: participantHeight,
  }));
  const participantById = new Map<string, PlacedSequenceParticipant>(participants.map((participant) => [participant.id, participant]));
  const messages: PlacedSequenceMessage[] = document.data.messages.map((message, index) => {
    const source = participantById.get(message.source);
    const target = participantById.get(message.target);
    if (!source || !target) throw new Error(`sequence message ${message.id} references an unknown participant`);
    const sourceX = source.x + source.width / 2;
    const targetX = target.x + target.width / 2;
    const y = rowStart + index * rowGap;
    if (source.id === target.id) {
      return {
        ...message,
        index,
        y,
        sourceX,
        targetX,
        direction: "self",
        path: `M ${sourceX} ${y} C ${sourceX + 92} ${y} ${sourceX + 92} ${y + 52} ${sourceX} ${y + 52}`,
        labelX: sourceX + 110,
        labelY: y + 24,
      };
    }
    const direction = targetX > sourceX ? "right" : "left";
    return {
      ...message,
      index,
      y,
      sourceX,
      targetX,
      direction,
      path: `M ${sourceX} ${y} L ${targetX} ${y}`,
      labelX: (sourceX + targetX) / 2,
      labelY: y - 18,
    };
  });
  return {
    width: Math.max(940, left * 2 + participants.length * participantWidth + (participants.length - 1) * participantGap),
    height: Math.max(560, rowStart + messages.length * rowGap + 64),
    participants,
    messages,
    lifelineBottom: rowStart + Math.max(1, messages.length - 1) * rowGap + 64,
  };
}

export async function layoutState(document: StateDocument): Promise<StateLayout> {
  const nodeWidth = 188;
  const nodeHeight = Math.max(84, ...document.data.states.map((state) => stackedTextHeight({
    label: state.label,
    description: state.description,
    width: nodeWidth,
    minimum: 84,
    horizontalSpace: 52,
    padding: 24,
  })));
  const graph = {
    id: "state-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      "elk.layered.spacing.nodeNodeBetweenLayers": "112",
      "elk.spacing.nodeNode": "56",
      "elk.spacing.edgeNode": "26",
      "elk.edgeLabels.inline": "true",
      "elk.spacing.edgeLabel": "8",
      "elk.padding": "[top=52,left=52,bottom=52,right=52]",
    },
    children: document.data.states.map((state) => ({ id: state.id, width: nodeWidth, height: nodeHeight })),
    edges: document.data.transitions.map((transition, index) => ({
      id: `transition-${index}`,
      sources: [transition.source],
      targets: [transition.target],
      labels: [(() => {
        const text = `${transition.event}${transition.guard ? ` [${transition.guard}]` : ""}`;
        const width = Math.max(64, Math.min(320, text.length * 6 + 20));
        return {
          id: `transition-label-${index}`,
          text,
          width,
          height: Math.max(28, wrappedLines(text, width - 16, 6) * 12 + 8),
        };
      })()],
    })),
  };
  const result: ElkNode = await elk.layout(graph);
  const stateById = new Map<string, StateNode>(document.data.states.map((state) => [state.id, state]));
  const states: PlacedState[] = (result.children ?? []).flatMap((placed) => {
    const state = stateById.get(placed.id);
    return state ? [{
      ...state,
      x: placed.x ?? 0,
      y: placed.y ?? 0,
      width: placed.width ?? nodeWidth,
      height: placed.height ?? nodeHeight,
    }] : [];
  });
  const transitions: PlacedTransition[] = (result.edges ?? []).flatMap((placed, index) => {
    const transition = document.data.transitions[index];
    if (!transition) return [];
    const section = placed.sections?.[0];
    const points = section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : [];
    const label = placed.labels?.[0];
    return [{
      ...transition,
      index,
      points,
      path: roundedOrthogonalPath(points, 24),
      labelPosition: label?.x != null && label?.y != null
        ? { x: label.x + (label.width ?? 0) / 2, y: label.y + (label.height ?? 0) / 2, width: label.width ?? 0, height: label.height ?? 28 }
        : null,
    }];
  });
  return {
    width: Math.max(820, Math.ceil(result.width ?? 820)),
    height: Math.max(520, Math.ceil(result.height ?? 520)),
    states,
    transitions,
  };
}

function mindLeafCount(node: MindNode): number {
  if (!node.children?.length) return 1;
  return node.children.reduce((sum, child) => sum + mindLeafCount(child), 0);
}

export function layoutMindMap(document: MindMapDocument): MindMapLayout {
  const nodeWidth = 206;
  const flattened: MindNode[] = [];
  (function collect(node: MindNode): void {
    flattened.push(node);
    node.children?.forEach(collect);
  })(document.data.root);
  const nodeHeight = Math.max(74, ...flattened.map((node) => stackedTextHeight({
    label: node.label,
    description: node.description,
    width: nodeWidth,
    minimum: 74,
    horizontalSpace: 71,
    padding: 22,
  })));
  const depthGap = 280;
  const leafGap = nodeHeight + 38;
  const root = document.data.root;
  const leftBranches: MindNode[] = [];
  const rightBranches: MindNode[] = [];
  (root.children ?? []).forEach((child, index) => (index % 2 === 0 ? leftBranches : rightBranches).push(child));
  const maxLeaves = Math.max(
    1,
    leftBranches.reduce((sum, branch) => sum + mindLeafCount(branch), 0),
    rightBranches.reduce((sum, branch) => sum + mindLeafCount(branch), 0),
  );
  const height = Math.max(660, maxLeaves * leafGap + 180);
  const maxDepth = (() => {
    function depth(node: MindNode): number {
      return node.children?.length ? 1 + Math.max(...node.children.map(depth)) : 0;
    }
    return depth(root);
  })();
  const width = Math.max(1320, 2 * (maxDepth * depthGap + nodeWidth + 100));
  const centerX = width / 2;
  const nodes: PlacedMindNode[] = [{
    ...root,
    parentId: null,
    side: 0,
    depth: 0,
    x: centerX - nodeWidth / 2,
    y: height / 2 - nodeHeight / 2,
    width: nodeWidth,
    height: nodeHeight,
  }];
  const edges: MindEdge[] = [];

  function placeSide(branches: MindNode[], side: -1 | 1): void {
    const leafTotal = branches.reduce((sum, branch) => sum + mindLeafCount(branch), 0);
    let cursor = (height - leafTotal * leafGap) / 2 + leafGap / 2;

    function place(node: MindNode, parent: MindNode, depth: number): number {
      let centerY;
      if (node.children?.length) {
        const childCenters = node.children.map((child) => place(child, node, depth + 1));
        centerY = childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length;
      } else {
        centerY = cursor;
        cursor += leafGap;
      }
      const x = side < 0
        ? centerX - depth * depthGap - nodeWidth
        : centerX + depth * depthGap;
      nodes.push({
        ...node,
        parentId: parent.id,
        side,
        depth,
        x,
        y: centerY - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
      });
      return centerY;
    }

    branches.forEach((branch) => place(branch, root, 1));
  }

  placeSide(leftBranches, -1);
  placeSide(rightBranches, 1);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (!node.parentId) continue;
    const parent = nodeById.get(node.parentId);
    if (!parent || node.side === 0) continue;
    const fromX = node.side < 0 ? parent.x : parent.x + parent.width;
    const toX = node.side < 0 ? node.x + node.width : node.x;
    const fromY = parent.y + parent.height / 2;
    const toY = node.y + node.height / 2;
    const bend = (fromX + toX) / 2;
    edges.push({
      parentId: parent.id,
      childId: node.id,
      side: node.side,
      path: `M ${fromX} ${fromY} C ${bend} ${fromY} ${bend} ${toY} ${toX} ${toY}`,
    });
  }
  return { width, height, nodes, edges };
}

export function layoutTimeline(document: TimelineDocument): TimelineLayout {
  const eventGap = 260;
  const left = 130;
  const axisY = 320;
  const cardWidth = 214;
  const cardHeights = document.data.events.map((event) => Math.max(
    112,
    28
      + wrappedLines(event.date, cardWidth - 30, 5.5) * 11
      + 6
      + wrappedLines(event.label, cardWidth - 30, 7) * 15
      + 6
      + wrappedLines(event.description, cardWidth - 30, 6) * 13,
  ));
  const width = Math.max(1180, left * 2 + (document.data.events.length - 1) * eventGap + cardWidth);
  const events = document.data.events.map((event, index) => {
    const x = left + index * eventGap;
    const above = index % 2 === 0;
    const cardHeight = cardHeights[index] ?? 112;
    return {
      ...event,
      index,
      x,
      pointX: x + cardWidth / 2,
      pointY: axisY,
      y: above ? axisY - 76 - cardHeight : axisY + 76,
      width: cardWidth,
      height: cardHeight,
      above,
    };
  });
  return { width, height: Math.max(660, axisY + 156 + Math.max(...cardHeights)), axisY, events };
}

const QUADRANT_LABEL_WIDTH = 142;
const QUADRANT_LABEL_HEIGHT = 26;
const QUADRANT_LABEL_GAP = 8;
const QUADRANT_POINT_CLEARANCE = 20;
const QUADRANT_LABEL_INSET = 56;
const QUADRANT_GUTTER_GAP = 20;

function finishQuadrantLabel(point: Pick<QuadrantPoint, "id"> & { cx: number; cy: number }, label: Point & Size): QuadrantLabelBox {
  const side = label.x + label.width / 2 < point.cx ? "left" : "right";
  const labelEdgeX = side === "left" ? label.x + label.width : label.x;
  const pointEdgeX = point.cx + (side === "left" ? -QUADRANT_POINT_CLEARANCE : QUADRANT_POINT_CLEARANCE);
  return {
    ...label,
    id: point.id,
    side,
    connectorPath: `M ${pointEdgeX} ${point.cy} L ${labelEdgeX} ${label.y + label.height / 2}`,
  };
}

function attachQuadrantLabels(points: Array<QuadrantPoint & { cx: number; cy: number }>, labels: QuadrantLabelBox[]): PlacedQuadrantPoint[] {
  const labelById = new Map(labels.map((label) => [label.id, label]));
  return points.map((point) => {
    const labelBox = labelById.get(point.id);
    if (!labelBox) throw new Error(`quadrant point ${point.id} has no label placement`);
    return { ...point, labelBox };
  });
}

function placeQuadrantLabels(points: Array<QuadrantPoint & { cx: number; cy: number }>, plot: QuadrantPlot): PlacedQuadrantPoint[] {
  const midpoint = plot.x + plot.width / 2;
  const minY = plot.y + QUADRANT_LABEL_INSET;
  const maxY = plot.y + plot.height - QUADRANT_LABEL_INSET - QUADRANT_LABEL_HEIGHT;
  const labels: QuadrantLabelBox[] = [];

  for (const side of ["left", "right"] as const) {
    const sidePoints = points
      .filter((point) => side === "left" ? point.cx < midpoint : point.cx >= midpoint)
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx);
    const tops = sidePoints.map((point) => Math.max(minY, Math.min(maxY, point.cy - QUADRANT_LABEL_HEIGHT / 2)));
    for (let index = 1; index < tops.length; index += 1) {
      tops[index] = Math.max(tops[index] ?? minY, (tops[index - 1] ?? minY) + QUADRANT_LABEL_HEIGHT + QUADRANT_LABEL_GAP);
    }
    if (tops.length > 0) {
      tops[tops.length - 1] = Math.min(tops[tops.length - 1] ?? maxY, maxY);
      for (let index = tops.length - 2; index >= 0; index -= 1) {
        tops[index] = Math.min(tops[index] ?? minY, (tops[index + 1] ?? maxY) - QUADRANT_LABEL_HEIGHT - QUADRANT_LABEL_GAP);
      }
      if ((tops[0] ?? minY) < minY) {
        const shift = minY - (tops[0] ?? minY);
        for (let index = 0; index < tops.length; index += 1) tops[index] = (tops[index] ?? minY) + shift;
      }
    }
    const x = side === "left"
      ? plot.x - QUADRANT_GUTTER_GAP - QUADRANT_LABEL_WIDTH
      : plot.x + plot.width + QUADRANT_GUTTER_GAP;
    sidePoints.forEach((point, index) => labels.push(finishQuadrantLabel(point, {
      x,
      y: tops[index] ?? minY,
      width: QUADRANT_LABEL_WIDTH,
      height: QUADRANT_LABEL_HEIGHT,
    })));
  }

  return attachQuadrantLabels(points, labels);
}

export function layoutQuadrant(document: QuadrantDocument): QuadrantLayout {
  const sideCounts: [number, number] = [0, 0];
  for (const point of document.data.points) {
    if (point.x < 50) sideCounts[0] += 1;
    else sideCounts[1] += 1;
  }
  const largestSide = Math.max(...sideCounts);
  const requiredLabelHeight = largestSide * QUADRANT_LABEL_HEIGHT + Math.max(0, largestSide - 1) * QUADRANT_LABEL_GAP + QUADRANT_LABEL_INSET * 2;
  const plot: QuadrantPlot = { x: 210, y: 74, width: 700, height: Math.max(570, requiredLabelHeight) };
  const points = document.data.points.map((point) => ({
    ...point,
    cx: plot.x + (point.x / 100) * plot.width,
    cy: plot.y + ((100 - point.y) / 100) * plot.height,
  }));
  return {
    width: 1120,
    height: plot.y + plot.height + 116,
    plot,
    points: placeQuadrantLabels(points, plot),
  };
}

export async function layoutFamily(document: FamilyDocument): Promise<FamilyLayout | null> {
  if (document.family === "sequence") return layoutSequence(document);
  if (document.family === "state") return layoutState(document);
  if (document.family === "mind-map") return layoutMindMap(document);
  if (document.family === "timeline") return layoutTimeline(document);
  if (document.family === "quadrant") return layoutQuadrant(document);
  return null;
}
