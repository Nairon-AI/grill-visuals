export const FAMILY_IDS = [
  "architecture",
  "sequence",
  "state",
  "mind-map",
  "timeline",
  "quadrant",
  "comparison",
] as const;

export type FamilyId = (typeof FAMILY_IDS)[number];
export type TabStatus = "current" | "resolved" | "blocked";

export interface QuestionOption {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
  highlights: string[];
}

interface DocumentBase<F extends FamilyId, D> {
  version: 1;
  id: string;
  family: F;
  title: string;
  summary: string;
  status: TabStatus;
  options: QuestionOption[];
  data: D;
}

export type ProductProject =
  | { name: string; iconDomain: string; iconPath?: never }
  | { name: string; iconPath: string; iconDomain?: never };

export type ArchitectureNodeKind = "entry" | "job" | "agent" | "service" | "store" | "queue" | "external" | "user";
export type ArchitectureEdgeKind = "calls" | "reads" | "writes" | "triggers" | "publishes" | "subscribes";

export interface ArchitectureNode {
  id: string;
  label: string;
  kind: ArchitectureNodeKind;
  description: string;
  detail?: string;
  group?: string;
  tags?: string[];
  sourceRef?: string;
  domain?: string;
}

export interface ArchitectureEdge {
  source: string;
  target: string;
  kind: ArchitectureEdgeKind;
  label?: string;
}

export interface ArchitectureData {
  project: ProductProject;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export type ArchitectureDocument = DocumentBase<"architecture", ArchitectureData>;

export type ParticipantKind = "user" | "agent" | "service" | "store" | "external";
export type MessageKind = "call" | "return" | "event" | "async";

export interface SequenceParticipant {
  id: string;
  label: string;
  description: string;
  kind: ParticipantKind;
}

export interface SequenceMessage {
  id: string;
  source: string;
  target: string;
  label: string;
  description?: string;
  kind: MessageKind;
}

export interface SequenceData {
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
}

export type SequenceDocument = DocumentBase<"sequence", SequenceData>;

export type StateKind = "initial" | "normal" | "success" | "failure" | "terminal";

export interface StateNode {
  id: string;
  label: string;
  description: string;
  kind: StateKind;
  detail?: string;
}

export interface StateTransition {
  id: string;
  source: string;
  target: string;
  event: string;
  guard?: string;
  description?: string;
}

export interface StateData {
  states: StateNode[];
  transitions: StateTransition[];
}

export type StateDocument = DocumentBase<"state", StateData>;

export type MindNodeKind = "topic" | "decision" | "risk" | "action" | "question";

export interface MindNode {
  id: string;
  label: string;
  description: string;
  kind: MindNodeKind;
  children?: MindNode[];
}

export interface MindMapData {
  root: MindNode;
}

export type MindMapDocument = DocumentBase<"mind-map", MindMapData>;

export type TimelineStatus = "past" | "current" | "future" | "risk";

export interface TimelineEvent {
  id: string;
  date: string;
  label: string;
  description: string;
  status: TimelineStatus;
  detail?: string;
}

export interface TimelineData {
  events: TimelineEvent[];
}

export type TimelineDocument = DocumentBase<"timeline", TimelineData>;

export interface Axis {
  label: string;
  low: string;
  high: string;
}

export interface QuadrantPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  group: string;
  description: string;
  detail?: string;
}

export interface QuadrantData {
  axes: { x: Axis; y: Axis };
  points: QuadrantPoint[];
}

export type QuadrantDocument = DocumentBase<"quadrant", QuadrantData>;

export interface ComparisonChoice {
  id: string;
  label: string;
  summary: string;
  recommended?: boolean;
}

export interface ComparisonCriterion {
  id: string;
  label: string;
  description: string;
}

export interface ComparisonRating {
  option: string;
  criterion: string;
  score: number;
  rationale: string;
}

export interface ComparisonData {
  options: ComparisonChoice[];
  criteria: ComparisonCriterion[];
  ratings: ComparisonRating[];
}

export type ComparisonDocument = DocumentBase<"comparison", ComparisonData>;

export type FamilyDocument = SequenceDocument | StateDocument | MindMapDocument | TimelineDocument | QuadrantDocument | ComparisonDocument;
export type DiagramDocument = ArchitectureDocument | FamilyDocument;

export interface ManifestDiagram {
  id: string;
  family: FamilyId;
  title: string;
  summary: string;
  status: TabStatus;
  path: string;
  updatedAt: string;
}

export interface SessionManifest {
  version: 1;
  session: string;
  createdAt: string;
  updatedAt: string;
  diagrams: ManifestDiagram[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}
