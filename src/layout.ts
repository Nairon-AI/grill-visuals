/*
 * Deterministic layout primitives for Grill Visuals.
 */
import ELKConstructor from "elkjs/lib/elk.bundled.js";
import type { ELK, ElkEdgeSection, ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api.js";
import type { ArchitectureDocument, ArchitectureEdge, ArchitectureNode, Point, Size } from "./types.js";

const elk = new (ELKConstructor as unknown as new () => ELK)();
const NODE_BASE_WIDTH = 220;
const NODE_HEADER_HEIGHT = 68;
const NODE_ROW_HEIGHT = 18;
const NODE_ROW_GAP = 10;
const NODE_ROW_PADDING = 30;
const LABEL_HEIGHT = 22;
const GROUP_PAD = Object.freeze({ top: 46, right: 16, bottom: 16, left: 16 });

export interface PlacedArchitectureNode extends ArchitectureNode, Size, Point {}

export interface ArchitectureGroup extends Size, Point {
  id: string;
  label: string;
}

export interface EdgeLabelPosition extends Point {
  width: number;
}

export interface ArchitectureLayoutEdge extends ArchitectureEdge {
  originalIndices: number[];
  highlightIds: string[];
  points: Point[];
  labelPosition: EdgeLabelPosition | null;
  path: string;
}

export interface ArchitectureLayout extends Size {
  nodes: PlacedArchitectureNode[];
  groups: ArchitectureGroup[];
  edges: ArchitectureLayoutEdge[];
}

interface SizedArchitectureNode extends ArchitectureNode, Size {}

interface InternalGroupLayout extends Size {
  children: Map<string, Point>;
  edges: Array<{
    originalIndices: number[];
    points: Point[];
    labelPosition: EdgeLabelPosition | null;
  }>;
}

interface RootEdge {
  source: string;
  target: string;
  label?: string;
  originalIndices: number[];
}

function wrappedLines(value: string, availableWidth: number, glyphWidth: number): number {
  return Math.max(1, Math.ceil(value.length / Math.max(1, Math.floor(availableWidth / glyphWidth))));
}

function nodeHeight(node: ArchitectureNode, width: number): number {
  const rows = node.tags?.length ?? 0;
  const copyWidth = width - 86;
  const labelLines = wrappedLines(node.label, copyWidth, 7);
  const descriptionLines = wrappedLines(node.description, copyWidth, 6);
  const headerHeight = Math.max(NODE_HEADER_HEIGHT, 28 + labelLines * 19 + 4 + descriptionLines * 17);
  const rowHeight = rows
    ? rows * NODE_ROW_HEIGHT + Math.max(0, rows - 1) * NODE_ROW_GAP + NODE_ROW_PADDING
    : 0;
  return headerHeight + rowHeight;
}

function labelDimensions(label: string): Size {
  return { width: Math.max(54, Math.min(210, label.length * 6 + 16)), height: LABEL_HEIGHT };
}

function pointsFromSection(section?: ElkEdgeSection): Point[] {
  return section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : [];
}

export function roundedOrthogonalPath(points: readonly Point[], radius = 28): string {
  const clean = points.filter(
    (point, index) => {
      const previous = points[index - 1];
      return index === 0 || !previous || point.x !== previous.x || point.y !== previous.y;
    },
  );
  if (clean.length === 0) return "";
  const first = clean[0];
  if (!first) return "";
  if (clean.length === 1) return `M ${first.x} ${first.y}`;
  const second = clean[1];
  if (!second) return `M ${first.x} ${first.y}`;
  if (clean.length === 2) return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;

  const distance = (from: Point, to: Point): number => Math.hypot(to.x - from.x, to.y - from.y);
  const toward = (from: Point, to: Point, amount: number): Point => {
    const length = distance(from, to) || 1;
    return {
      x: from.x + ((to.x - from.x) / length) * amount,
      y: from.y + ((to.y - from.y) / length) * amount,
    };
  };

  let path = `M ${first.x} ${first.y}`;
  for (let index = 1; index < clean.length - 1; index += 1) {
    const previous = clean[index - 1];
    const current = clean[index];
    const next = clean[index + 1];
    if (!previous || !current || !next) continue;
    const before = toward(current, previous, Math.min(radius, distance(previous, current) / 2));
    const after = toward(current, next, Math.min(radius, distance(current, next) / 2));
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  const last = clean.at(-1);
  if (!last) return path;
  return `${path} L ${last.x} ${last.y}`;
}

function edgeLabelPosition(edge: ElkExtendedEdge): EdgeLabelPosition | null {
  const label = edge.labels?.[0];
  if (label?.x == null || label?.y == null) return null;
  return {
    x: label.x + (label.width ?? 0) / 2,
    y: label.y + (label.height ?? 0) / 2,
    width: label.width ?? 0,
  };
}

function makeElkEdge(edge: ArchitectureEdge | RootEdge, id: string): ElkExtendedEdge {
  const label = edge.label;
  return {
    id,
    sources: [edge.source],
    targets: [edge.target],
    ...(label
      ? { labels: [{ id: `${id}-label`, text: label, ...labelDimensions(label) }] }
      : {}),
  };
}

const rootOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.mergeEdges": "true",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
  "elk.layered.spacing.nodeNodeBetweenLayers": "72",
  "elk.spacing.nodeNode": "26",
  "elk.spacing.edgeNode": "22",
  "elk.spacing.edgeEdge": "14",
  "elk.edgeLabels.inline": "true",
  "elk.spacing.edgeLabel": "4",
  "elk.padding": "[top=16,left=16,bottom=16,right=16]",
};

const groupOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.spacing.nodeNodeBetweenLayers": "30",
  "elk.spacing.nodeNode": "18",
  "elk.spacing.edgeNode": "14",
  "elk.edgeLabels.inline": "true",
  "elk.spacing.edgeLabel": "4",
  "elk.padding": `[top=${GROUP_PAD.top},left=${GROUP_PAD.left},bottom=${GROUP_PAD.bottom},right=${GROUP_PAD.right}]`,
};

export async function layoutArchitecture(document: ArchitectureDocument): Promise<ArchitectureLayout> {
  const degree = new Map<string, number>();
  for (const edge of document.data.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const sizedNodes = document.data.nodes.map((node) => {
    const width = NODE_BASE_WIDTH + Math.min(degree.get(node.id) ?? 0, 6) * 5;
    return { ...node, width, height: nodeHeight(node, width) };
  });
  const nodeById = new Map<string, SizedArchitectureNode>(sizedNodes.map((node) => [node.id, node]));
  const groupNames: string[] = [];
  const membersByGroup = new Map<string, SizedArchitectureNode[]>();

  for (const node of sizedNodes) {
    if (!node.group) continue;
    if (!membersByGroup.has(node.group)) {
      groupNames.push(node.group);
      membersByGroup.set(node.group, []);
    }
    membersByGroup.get(node.group)?.push(node);
  }

  const groupId = (name: string): string => `group-${groupNames.indexOf(name)}`;
  const groupForNode = (id: string): string | undefined => nodeById.get(id)?.group;
  const groupLayouts = new Map<string, InternalGroupLayout>();

  for (const name of groupNames) {
    const members = membersByGroup.get(name) ?? [];
    const memberIds = new Set(members.map((member) => member.id));
    const internalEdges = document.data.edges
      .map((edge, index) => ({ edge, index }))
      .filter(({ edge }) => memberIds.has(edge.source) && memberIds.has(edge.target));
    const result: ElkNode = await elk.layout({
      id: "group-root",
      layoutOptions: groupOptions,
      children: members.map((member) => ({ id: member.id, width: member.width, height: member.height })),
      edges: internalEdges.map(({ edge, index }) => makeElkEdge(edge, `internal-${index}`)),
    });

    groupLayouts.set(name, {
      width: result.width ?? NODE_BASE_WIDTH + GROUP_PAD.left + GROUP_PAD.right,
      height: result.height ?? NODE_HEADER_HEIGHT + GROUP_PAD.top + GROUP_PAD.bottom,
      children: new Map((result.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }])),
      edges: (result.edges ?? []).map((edge) => {
        const originalIndex = Number(edge.id.slice("internal-".length));
        return {
          originalIndices: [originalIndex],
          points: pointsFromSection(edge.sections?.[0]),
          labelPosition: edgeLabelPosition(edge),
        };
      }),
    });
  }

  const rootEdgeMap = new Map<string, RootEdge>();
  document.data.edges.forEach((edge, index) => {
    const sourceGroup = groupForNode(edge.source);
    const targetGroup = groupForNode(edge.target);
    if (sourceGroup && sourceGroup === targetGroup) return;
    const source = sourceGroup ? groupId(sourceGroup) : edge.source;
    const target = targetGroup ? groupId(targetGroup) : edge.target;
    const key = `${source}\u0000${target}`;
    const existing = rootEdgeMap.get(key);
    if (existing) {
      existing.originalIndices.push(index);
      if (!existing.label && edge.label) existing.label = edge.label;
      return;
    }
    rootEdgeMap.set(key, { source, target, ...(edge.label ? { label: edge.label } : {}), originalIndices: [index] });
  });

  const ungrouped = sizedNodes.filter((node) => !node.group);
  const rootChildren = [
    ...ungrouped.map((node) => ({ id: node.id, width: node.width, height: node.height })),
    ...groupNames.map((name) => ({
      id: groupId(name),
      width: groupLayouts.get(name)?.width ?? NODE_BASE_WIDTH,
      height: groupLayouts.get(name)?.height ?? NODE_HEADER_HEIGHT,
    })),
  ];
  const rootEdges = [...rootEdgeMap.values()];
  const rootResult = await elk.layout({
    id: "root",
    layoutOptions: {
      ...rootOptions,
      "elk.layered.spacing.nodeNodeBetweenLayers": rootChildren.length > 12 ? "56" : "72",
      "elk.spacing.nodeNode": rootChildren.length > 12 ? "18" : "26",
    },
    children: rootChildren,
    edges: rootEdges.map((edge, index) => makeElkEdge(edge, `root-${index}`)),
  });

  const rootPositions = new Map<string, Point>(
    (rootResult.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]),
  );
  const nodes = ungrouped.map((node) => ({ ...node, ...(rootPositions.get(node.id) ?? { x: 0, y: 0 }) }));
  const groups: ArchitectureGroup[] = [];
  const edges: ArchitectureLayoutEdge[] = [];

  for (const name of groupNames) {
    const layout = groupLayouts.get(name);
    if (!layout) continue;
    const origin = rootPositions.get(groupId(name)) ?? { x: 0, y: 0 };
    groups.push({ id: groupId(name), label: name, ...origin, width: layout.width, height: layout.height });
    for (const member of membersByGroup.get(name) ?? []) {
      const relative = layout.children.get(member.id) ?? { x: 0, y: 0 };
      nodes.push({ ...member, x: origin.x + relative.x, y: origin.y + relative.y });
    }
    for (const edge of layout.edges) {
      const originalIndex = edge.originalIndices[0];
      if (originalIndex === undefined) continue;
      const original = document.data.edges[originalIndex];
      if (!original) continue;
      const points = edge.points.map((point) => ({ x: point.x + origin.x, y: point.y + origin.y }));
      edges.push({
        ...original,
        originalIndices: edge.originalIndices,
        highlightIds: [original.source, original.target],
        points,
        labelPosition: edge.labelPosition
          ? { ...edge.labelPosition, x: edge.labelPosition.x + origin.x, y: edge.labelPosition.y + origin.y }
          : null,
        path: roundedOrthogonalPath(points),
      });
    }
  }

  (rootResult.edges ?? []).forEach((placed, index) => {
    const spec = rootEdges[index];
    if (!spec) return;
    const originalIndex = spec.originalIndices[0];
    if (originalIndex === undefined) return;
    const original = document.data.edges[originalIndex];
    if (!original) return;
    const points = pointsFromSection(placed.sections?.[0]);
    edges.push({
      ...original,
      source: spec.source,
      target: spec.target,
      originalIndices: spec.originalIndices,
      highlightIds: [...new Set(spec.originalIndices.flatMap((originalIndex) => {
        const edge = document.data.edges[originalIndex];
        return edge ? [edge.source, edge.target] : [];
      }))],
      points,
      labelPosition: edgeLabelPosition(placed),
      path: roundedOrthogonalPath(points),
    });
  });

  let width = 0;
  let height = 0;
  for (const node of nodes) {
    width = Math.max(width, node.x + node.width);
    height = Math.max(height, node.y + node.height);
  }
  for (const group of groups) {
    width = Math.max(width, group.x + group.width);
    height = Math.max(height, group.y + group.height);
  }

  return {
    width: Math.max(320, Math.ceil(width + 16)),
    height: Math.max(240, Math.ceil(height + 16)),
    nodes,
    groups,
    edges,
  };
}
