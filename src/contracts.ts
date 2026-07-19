import { FAMILY_IDS } from "./types.js";
import type { DiagramDocument, FamilyId, MindNode, SessionManifest } from "./types.js";

export { FAMILY_IDS };

export const FAMILY_STATUS: Readonly<Record<FamilyId, "ready">> = Object.freeze({
  architecture: "ready",
  sequence: "ready",
  state: "ready",
  "mind-map": "ready",
  timeline: "ready",
  quadrant: "ready",
  comparison: "ready",
});

export const TAB_STATUSES = ["current", "resolved", "blocked"] as const;
export const ARCHITECTURE_NODE_KINDS = [
  "entry",
  "job",
  "agent",
  "service",
  "store",
  "queue",
  "external",
  "user",
] as const;
export const ARCHITECTURE_EDGE_KINDS = [
  "calls",
  "reads",
  "writes",
  "triggers",
  "publishes",
  "subscribes",
] as const;

const ROOT_KEYS = new Set(["version", "id", "family", "title", "summary", "status", "options", "data"]);
const DATA_KEYS = new Set(["project", "nodes", "edges"]);
const PROJECT_KEYS = new Set(["name", "iconDomain", "iconPath"]);
const NODE_KEYS = new Set([
  "id",
  "label",
  "kind",
  "description",
  "detail",
  "group",
  "tags",
  "sourceRef",
  "domain",
]);
const EDGE_KEYS = new Set(["source", "target", "kind", "label"]);
const SEQUENCE_DATA_KEYS = new Set(["participants", "messages"]);
const PARTICIPANT_KEYS = new Set(["id", "label", "description", "kind"]);
const MESSAGE_KEYS = new Set(["id", "source", "target", "label", "description", "kind"]);
const PARTICIPANT_KINDS = ["user", "agent", "service", "store", "external"] as const;
const MESSAGE_KINDS = ["call", "return", "event", "async"] as const;
const STATE_DATA_KEYS = new Set(["states", "transitions"]);
const STATE_KEYS = new Set(["id", "label", "description", "kind", "detail"]);
const TRANSITION_KEYS = new Set(["id", "source", "target", "event", "guard", "description"]);
const STATE_KINDS = ["initial", "normal", "success", "failure", "terminal"] as const;
const MIND_MAP_DATA_KEYS = new Set(["root"]);
const MIND_NODE_KEYS = new Set(["id", "label", "description", "kind", "children"]);
const MIND_NODE_KINDS = ["topic", "decision", "risk", "action", "question"] as const;
const TIMELINE_DATA_KEYS = new Set(["events"]);
const TIMELINE_EVENT_KEYS = new Set(["id", "date", "label", "description", "status", "detail"]);
const TIMELINE_STATUSES = ["past", "current", "future", "risk"] as const;
const QUADRANT_DATA_KEYS = new Set(["axes", "points"]);
const AXES_KEYS = new Set(["x", "y"]);
const AXIS_KEYS = new Set(["label", "low", "high"]);
const QUADRANT_POINT_KEYS = new Set(["id", "label", "x", "y", "group", "description", "detail"]);
const COMPARISON_DATA_KEYS = new Set(["options", "criteria", "ratings"]);
const OPTION_KEYS = new Set(["id", "label", "summary", "recommended"]);
const CRITERION_KEYS = new Set(["id", "label", "description"]);
const RATING_KEYS = new Set(["option", "criterion", "score", "rationale"]);
const QUESTION_OPTION_KEYS = new Set(["id", "label", "description", "recommended", "highlights"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOGO_PATH_PATTERN = /\.(?:avif|ico|jpe?g|png|svg|webp)$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkUnknownKeys(errors: string[], value: unknown, allowed: ReadonlySet<string>, path: string): void {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`);
  }
}

function checkString(errors: string[], value: unknown, path: string, maxLength: number, { optional = false }: { optional?: boolean } = {}): void {
  if (optional && value === undefined) return;
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
    return;
  }
  if (value.length > maxLength) errors.push(`${path} must be at most ${maxLength} characters`);
}

function checkId(errors: string[], value: unknown, path: string): void {
  checkString(errors, value, path, 64);
  if (typeof value === "string" && !ID_PATTERN.test(value)) {
    errors.push(`${path} must be a lowercase kebab-case identifier`);
  }
}

function checkDomain(errors: string[], value: unknown, path: string, { optional = false }: { optional?: boolean } = {}): void {
  if (optional && value === undefined) return;
  checkString(errors, value, path, 120);
  if (typeof value === "string" && (!DOMAIN_PATTERN.test(value) || value !== value.toLowerCase())) {
    errors.push(`${path} must be a lowercase canonical domain such as stripe.com`);
  }
}

function checkLogoPath(errors: string[], value: unknown, path: string, { optional = false }: { optional?: boolean } = {}): void {
  if (optional && value === undefined) return;
  checkString(errors, value, path, 200);
  if (typeof value !== "string") return;
  const segments = value.split("/");
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    segments.includes("..") ||
    !LOGO_PATH_PATTERN.test(value)
  ) {
    errors.push(`${path} must be a safe relative AVIF, ICO, JPEG, PNG, SVG, or WebP path`);
  }
}

function checkEnum(errors: string[], value: unknown, values: readonly unknown[], path: string): void {
  if (!values.some((candidate) => candidate === value)) errors.push(`${path} must be one of: ${values.join(", ")}`);
}

function checkBoolean(errors: string[], value: unknown, path: string, { optional = false }: { optional?: boolean } = {}): void {
  if (optional && value === undefined) return;
  if (typeof value !== "boolean") errors.push(`${path} must be a boolean`);
}

function checkNumber(errors: string[], value: unknown, path: string, minimum: number, maximum: number, { integer = false }: { integer?: boolean } = {}): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number`);
    return;
  }
  if (value < minimum || value > maximum) {
    errors.push(`${path} must be between ${minimum} and ${maximum}`);
  }
  if (integer && !Number.isInteger(value)) errors.push(`${path} must be an integer`);
}

function checkArray(errors: string[], value: unknown, path: string, minimum: number, maximum: number): value is unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return false;
  }
  if (value.length < minimum) errors.push(`${path} must contain at least ${minimum} item${minimum === 1 ? "" : "s"}`);
  if (value.length > maximum) errors.push(`${path} must contain at most ${maximum} items`);
  return true;
}

export function validateDocumentEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ["$ must be an object"];

  checkUnknownKeys(errors, value, ROOT_KEYS, "$");
  if (value.version !== 1) errors.push("$.version must equal 1");
  checkId(errors, value.id, "$.id");
  checkEnum(errors, value.family, FAMILY_IDS, "$.family");
  checkString(errors, value.title, "$.title", 120);
  checkString(errors, value.summary, "$.summary", 500);
  checkEnum(errors, value.status, TAB_STATUSES, "$.status");
  if (!Array.isArray(value.options)) errors.push("$.options must be an array");
  if (!isObject(value.data)) errors.push("$.data must be an object");
  return errors;
}

function validateQuestionOptions(value: unknown, knownIds: ReadonlySet<string>, path = "$.options"): string[] {
  const errors: string[] = [];
  if (!checkArray(errors, value, path, 2, 4)) return errors;
  const ids = new Set<string>();
  let recommendedCount = 0;
  value.forEach((option, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(option)) {
      errors.push(`${itemPath} must be an object`);
      return;
    }
    checkUnknownKeys(errors, option, QUESTION_OPTION_KEYS, itemPath);
    checkId(errors, option.id, `${itemPath}.id`);
    checkString(errors, option.label, `${itemPath}.label`, 44);
    checkString(errors, option.description, `${itemPath}.description`, 180);
    checkBoolean(errors, option.recommended, `${itemPath}.recommended`, { optional: true });
    if (option.recommended === true) recommendedCount += 1;
    if (typeof option.id === "string") {
      if (ids.has(option.id)) errors.push(`${itemPath}.id must be unique`);
      ids.add(option.id);
    }
    if (!checkArray(errors, option.highlights, `${itemPath}.highlights`, 1, 20)) return;
    option.highlights.forEach((highlight, highlightIndex) => {
      checkId(errors, highlight, `${itemPath}.highlights[${highlightIndex}]`);
      if (typeof highlight === "string" && !knownIds.has(highlight)) {
        errors.push(`${itemPath}.highlights[${highlightIndex}] must reference an item in this diagram`);
      }
    });
  });
  if (recommendedCount !== 1) errors.push(`${path} must contain exactly one recommended option`);
  return errors;
}

export function validateArchitectureData(value: unknown, path = "$.data"): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return [`${path} must be an object`];
  checkUnknownKeys(errors, value, DATA_KEYS, path);

  if (!isObject(value.project)) {
    errors.push(`${path}.project must be an object`);
  } else {
    checkUnknownKeys(errors, value.project, PROJECT_KEYS, `${path}.project`);
    checkString(errors, value.project.name, `${path}.project.name`, 48);
    checkDomain(errors, value.project.iconDomain, `${path}.project.iconDomain`, { optional: true });
    checkLogoPath(errors, value.project.iconPath, `${path}.project.iconPath`, { optional: true });
    const logoCount = Number(value.project.iconDomain !== undefined) + Number(value.project.iconPath !== undefined);
    if (logoCount !== 1) {
      errors.push(`${path}.project must contain exactly one of iconDomain or iconPath`);
    }
  }

  if (!Array.isArray(value.nodes)) {
    errors.push(`${path}.nodes must be an array`);
  } else {
    if (value.nodes.length < 1) errors.push(`${path}.nodes must contain at least 1 node`);
    if (value.nodes.length > 40) errors.push(`${path}.nodes must contain at most 40 nodes`);
  }

  if (!Array.isArray(value.edges)) {
    errors.push(`${path}.edges must be an array`);
  } else if (value.edges.length > 80) {
    errors.push(`${path}.edges must contain at most 80 edges`);
  }

  const ids = new Set<string>();
  for (const [index, node] of (Array.isArray(value.nodes) ? value.nodes : []).entries()) {
    const nodePath = `${path}.nodes[${index}]`;
    if (!isObject(node)) {
      errors.push(`${nodePath} must be an object`);
      continue;
    }
    checkUnknownKeys(errors, node, NODE_KEYS, nodePath);
    checkId(errors, node.id, `${nodePath}.id`);
    checkString(errors, node.label, `${nodePath}.label`, 36);
    checkEnum(errors, node.kind, ARCHITECTURE_NODE_KINDS, `${nodePath}.kind`);
    checkString(errors, node.description, `${nodePath}.description`, 90);
    checkString(errors, node.detail, `${nodePath}.detail`, 320, { optional: true });
    checkString(errors, node.group, `${nodePath}.group`, 36, { optional: true });
    checkString(errors, node.sourceRef, `${nodePath}.sourceRef`, 160, { optional: true });
    checkDomain(errors, node.domain, `${nodePath}.domain`, { optional: true });

    if (node.tags !== undefined) {
      if (!Array.isArray(node.tags)) {
        errors.push(`${nodePath}.tags must be an array`);
      } else {
        if (node.tags.length > 4) errors.push(`${nodePath}.tags must contain at most 4 tags`);
        node.tags.forEach((tag, tagIndex) =>
          checkString(errors, tag, `${nodePath}.tags[${tagIndex}]`, 24),
        );
      }
    }

    if (typeof node.id === "string") {
      if (ids.has(node.id)) errors.push(`${nodePath}.id must be unique`);
      ids.add(node.id);
    }
  }

  const edgeKeys = new Set<string>();
  for (const [index, edge] of (Array.isArray(value.edges) ? value.edges : []).entries()) {
    const edgePath = `${path}.edges[${index}]`;
    if (!isObject(edge)) {
      errors.push(`${edgePath} must be an object`);
      continue;
    }
    checkUnknownKeys(errors, edge, EDGE_KEYS, edgePath);
    checkId(errors, edge.source, `${edgePath}.source`);
    checkId(errors, edge.target, `${edgePath}.target`);
    checkEnum(errors, edge.kind, ARCHITECTURE_EDGE_KINDS, `${edgePath}.kind`);
    checkString(errors, edge.label, `${edgePath}.label`, 30, { optional: true });

    if (typeof edge.source === "string" && !ids.has(edge.source)) {
      errors.push(`${edgePath}.source must reference an existing node`);
    }
    if (typeof edge.target === "string" && !ids.has(edge.target)) {
      errors.push(`${edgePath}.target must reference an existing node`);
    }
    if (edge.source === edge.target) errors.push(`${edgePath} cannot connect a node to itself`);

    const key = `${edge.source}\u0000${edge.target}\u0000${edge.kind}\u0000${edge.label ?? ""}`;
    if (edgeKeys.has(key)) errors.push(`${edgePath} duplicates an earlier edge`);
    edgeKeys.add(key);
  }

  return errors;
}

export function validateSequenceData(value: unknown, path = "$.data"): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return [`${path} must be an object`];
  checkUnknownKeys(errors, value, SEQUENCE_DATA_KEYS, path);
  const participants = value.participants;
  const messages = value.messages;
  const hasParticipants = checkArray(errors, participants, `${path}.participants`, 2, 8);
  const hasMessages = checkArray(errors, messages, `${path}.messages`, 1, 24);
  const ids = new Set<string>();

  if (hasParticipants) {
    participants.forEach((participant, index) => {
      const itemPath = `${path}.participants[${index}]`;
      if (!isObject(participant)) {
        errors.push(`${itemPath} must be an object`);
        return;
      }
      checkUnknownKeys(errors, participant, PARTICIPANT_KEYS, itemPath);
      checkId(errors, participant.id, `${itemPath}.id`);
      checkString(errors, participant.label, `${itemPath}.label`, 32);
      checkString(errors, participant.description, `${itemPath}.description`, 80);
      checkEnum(errors, participant.kind, PARTICIPANT_KINDS, `${itemPath}.kind`);
      if (typeof participant.id === "string") {
        if (ids.has(participant.id)) errors.push(`${itemPath}.id must be unique`);
        ids.add(participant.id);
      }
    });
  }

  if (hasMessages) {
    const messageIds = new Set<string>();
    messages.forEach((message, index) => {
      const itemPath = `${path}.messages[${index}]`;
      if (!isObject(message)) {
        errors.push(`${itemPath} must be an object`);
        return;
      }
      checkUnknownKeys(errors, message, MESSAGE_KEYS, itemPath);
      checkId(errors, message.id, `${itemPath}.id`);
      checkId(errors, message.source, `${itemPath}.source`);
      checkId(errors, message.target, `${itemPath}.target`);
      checkString(errors, message.label, `${itemPath}.label`, 44);
      checkString(errors, message.description, `${itemPath}.description`, 160, { optional: true });
      checkEnum(errors, message.kind, MESSAGE_KINDS, `${itemPath}.kind`);
      if (typeof message.source === "string" && !ids.has(message.source)) {
        errors.push(`${itemPath}.source must reference an existing participant`);
      }
      if (typeof message.target === "string" && !ids.has(message.target)) {
        errors.push(`${itemPath}.target must reference an existing participant`);
      }
      if (typeof message.id === "string") {
        if (messageIds.has(message.id)) errors.push(`${itemPath}.id must be unique`);
        messageIds.add(message.id);
      }
    });
  }
  return errors;
}

export function validateStateData(value: unknown, path = "$.data"): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return [`${path} must be an object`];
  checkUnknownKeys(errors, value, STATE_DATA_KEYS, path);
  const states = value.states;
  const transitions = value.transitions;
  const hasStates = checkArray(errors, states, `${path}.states`, 2, 20);
  const hasTransitions = checkArray(errors, transitions, `${path}.transitions`, 1, 40);
  const ids = new Set<string>();
  let initialCount = 0;

  if (hasStates) {
    states.forEach((state, index) => {
      const itemPath = `${path}.states[${index}]`;
      if (!isObject(state)) {
        errors.push(`${itemPath} must be an object`);
        return;
      }
      checkUnknownKeys(errors, state, STATE_KEYS, itemPath);
      checkId(errors, state.id, `${itemPath}.id`);
      checkString(errors, state.label, `${itemPath}.label`, 36);
      checkString(errors, state.description, `${itemPath}.description`, 100);
      checkEnum(errors, state.kind, STATE_KINDS, `${itemPath}.kind`);
      checkString(errors, state.detail, `${itemPath}.detail`, 280, { optional: true });
      if (state.kind === "initial") initialCount += 1;
      if (typeof state.id === "string") {
        if (ids.has(state.id)) errors.push(`${itemPath}.id must be unique`);
        ids.add(state.id);
      }
    });
    if (initialCount !== 1) errors.push(`${path}.states must contain exactly one initial state`);
  }

  if (hasTransitions) {
    const keys = new Set<unknown>();
    transitions.forEach((transition, index) => {
      const itemPath = `${path}.transitions[${index}]`;
      if (!isObject(transition)) {
        errors.push(`${itemPath} must be an object`);
        return;
      }
      checkUnknownKeys(errors, transition, TRANSITION_KEYS, itemPath);
      checkId(errors, transition.id, `${itemPath}.id`);
      checkId(errors, transition.source, `${itemPath}.source`);
      checkId(errors, transition.target, `${itemPath}.target`);
      checkString(errors, transition.event, `${itemPath}.event`, 40);
      checkString(errors, transition.guard, `${itemPath}.guard`, 60, { optional: true });
      checkString(errors, transition.description, `${itemPath}.description`, 180, { optional: true });
      if (typeof transition.source === "string" && !ids.has(transition.source)) {
        errors.push(`${itemPath}.source must reference an existing state`);
      }
      if (typeof transition.target === "string" && !ids.has(transition.target)) {
        errors.push(`${itemPath}.target must reference an existing state`);
      }
      const key = transition.id;
      if (keys.has(key)) errors.push(`${itemPath} duplicates an earlier transition`);
      keys.add(key);
    });
  }
  return errors;
}

export function validateMindMapData(value: unknown, path = "$.data"): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return [`${path} must be an object`];
  checkUnknownKeys(errors, value, MIND_MAP_DATA_KEYS, path);
  if (!isObject(value.root)) return [...errors, `${path}.root must be an object`];
  const ids = new Set<string>();
  let count = 0;

  function visit(node: unknown, nodePath: string, depth: number): void {
    if (!isObject(node)) {
      errors.push(`${nodePath} must be an object`);
      return;
    }
    count += 1;
    if (depth > 4) errors.push(`${nodePath} exceeds the maximum depth of 4`);
    checkUnknownKeys(errors, node, MIND_NODE_KEYS, nodePath);
    checkId(errors, node.id, `${nodePath}.id`);
    checkString(errors, node.label, `${nodePath}.label`, 40);
    checkString(errors, node.description, `${nodePath}.description`, 100);
    checkEnum(errors, node.kind, MIND_NODE_KINDS, `${nodePath}.kind`);
    if (typeof node.id === "string") {
      if (ids.has(node.id)) errors.push(`${nodePath}.id must be unique`);
      ids.add(node.id);
    }
    if (node.children !== undefined) {
      if (!checkArray(errors, node.children, `${nodePath}.children`, 1, 8)) return;
      node.children.forEach((child, index) => visit(child, `${nodePath}.children[${index}]`, depth + 1));
    }
  }

  visit(value.root, `${path}.root`, 0);
  if (count < 2) errors.push(`${path}.root must contain at least one child`);
  if (count > 40) errors.push(`${path}.root tree must contain at most 40 nodes`);
  return errors;
}

export function validateTimelineData(value: unknown, path = "$.data"): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return [`${path} must be an object`];
  checkUnknownKeys(errors, value, TIMELINE_DATA_KEYS, path);
  if (!checkArray(errors, value.events, `${path}.events`, 2, 20)) return errors;
  const ids = new Set<string>();
  value.events.forEach((event, index) => {
    const itemPath = `${path}.events[${index}]`;
    if (!isObject(event)) {
      errors.push(`${itemPath} must be an object`);
      return;
    }
    checkUnknownKeys(errors, event, TIMELINE_EVENT_KEYS, itemPath);
    checkId(errors, event.id, `${itemPath}.id`);
    checkString(errors, event.date, `${itemPath}.date`, 32);
    checkString(errors, event.label, `${itemPath}.label`, 44);
    checkString(errors, event.description, `${itemPath}.description`, 120);
    checkEnum(errors, event.status, TIMELINE_STATUSES, `${itemPath}.status`);
    checkString(errors, event.detail, `${itemPath}.detail`, 280, { optional: true });
    if (typeof event.id === "string") {
      if (ids.has(event.id)) errors.push(`${itemPath}.id must be unique`);
      ids.add(event.id);
    }
  });
  return errors;
}

export function validateQuadrantData(value: unknown, path = "$.data"): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return [`${path} must be an object`];
  checkUnknownKeys(errors, value, QUADRANT_DATA_KEYS, path);
  if (!isObject(value.axes)) {
    errors.push(`${path}.axes must be an object`);
  } else {
    checkUnknownKeys(errors, value.axes, AXES_KEYS, `${path}.axes`);
    for (const name of ["x", "y"]) {
      const axisPath = `${path}.axes.${name}`;
      const axis = value.axes[name];
      if (!isObject(axis)) {
        errors.push(`${axisPath} must be an object`);
        continue;
      }
      checkUnknownKeys(errors, axis, AXIS_KEYS, axisPath);
      checkString(errors, axis.label, `${axisPath}.label`, 36);
      checkString(errors, axis.low, `${axisPath}.low`, 28);
      checkString(errors, axis.high, `${axisPath}.high`, 28);
    }
  }
  if (!checkArray(errors, value.points, `${path}.points`, 2, 30)) return errors;
  const ids = new Set<string>();
  value.points.forEach((point, index) => {
    const itemPath = `${path}.points[${index}]`;
    if (!isObject(point)) {
      errors.push(`${itemPath} must be an object`);
      return;
    }
    checkUnknownKeys(errors, point, QUADRANT_POINT_KEYS, itemPath);
    checkId(errors, point.id, `${itemPath}.id`);
    checkString(errors, point.label, `${itemPath}.label`, 36);
    checkNumber(errors, point.x, `${itemPath}.x`, 0, 100);
    checkNumber(errors, point.y, `${itemPath}.y`, 0, 100);
    checkString(errors, point.group, `${itemPath}.group`, 24);
    checkString(errors, point.description, `${itemPath}.description`, 120);
    checkString(errors, point.detail, `${itemPath}.detail`, 280, { optional: true });
    if (typeof point.id === "string") {
      if (ids.has(point.id)) errors.push(`${itemPath}.id must be unique`);
      ids.add(point.id);
    }
  });
  return errors;
}

export function validateComparisonData(value: unknown, path = "$.data"): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return [`${path} must be an object`];
  checkUnknownKeys(errors, value, COMPARISON_DATA_KEYS, path);
  const options = value.options;
  const criteria = value.criteria;
  const ratings = value.ratings;
  const hasOptions = checkArray(errors, options, `${path}.options`, 2, 5);
  const hasCriteria = checkArray(errors, criteria, `${path}.criteria`, 2, 8);
  const hasRatings = checkArray(errors, ratings, `${path}.ratings`, 1, 40);
  const optionIds = new Set<string>();
  const criterionIds = new Set<string>();
  let recommendedCount = 0;

  if (hasOptions) {
    options.forEach((option, index) => {
      const itemPath = `${path}.options[${index}]`;
      if (!isObject(option)) {
        errors.push(`${itemPath} must be an object`);
        return;
      }
      checkUnknownKeys(errors, option, OPTION_KEYS, itemPath);
      checkId(errors, option.id, `${itemPath}.id`);
      checkString(errors, option.label, `${itemPath}.label`, 36);
      checkString(errors, option.summary, `${itemPath}.summary`, 120);
      checkBoolean(errors, option.recommended, `${itemPath}.recommended`, { optional: true });
      if (option.recommended === true) recommendedCount += 1;
      if (typeof option.id === "string") {
        if (optionIds.has(option.id)) errors.push(`${itemPath}.id must be unique`);
        optionIds.add(option.id);
      }
    });
    if (recommendedCount > 1) errors.push(`${path}.options may contain at most one recommended option`);
  }

  if (hasCriteria) {
    criteria.forEach((criterion, index) => {
      const itemPath = `${path}.criteria[${index}]`;
      if (!isObject(criterion)) {
        errors.push(`${itemPath} must be an object`);
        return;
      }
      checkUnknownKeys(errors, criterion, CRITERION_KEYS, itemPath);
      checkId(errors, criterion.id, `${itemPath}.id`);
      checkString(errors, criterion.label, `${itemPath}.label`, 32);
      checkString(errors, criterion.description, `${itemPath}.description`, 120);
      if (typeof criterion.id === "string") {
        if (criterionIds.has(criterion.id)) errors.push(`${itemPath}.id must be unique`);
        criterionIds.add(criterion.id);
      }
    });
  }

  const ratingKeys = new Set<string>();
  if (hasRatings) {
    ratings.forEach((rating, index) => {
      const itemPath = `${path}.ratings[${index}]`;
      if (!isObject(rating)) {
        errors.push(`${itemPath} must be an object`);
        return;
      }
      checkUnknownKeys(errors, rating, RATING_KEYS, itemPath);
      checkId(errors, rating.option, `${itemPath}.option`);
      checkId(errors, rating.criterion, `${itemPath}.criterion`);
      checkNumber(errors, rating.score, `${itemPath}.score`, 1, 5, { integer: true });
      checkString(errors, rating.rationale, `${itemPath}.rationale`, 220);
      if (typeof rating.option === "string" && !optionIds.has(rating.option)) {
        errors.push(`${itemPath}.option must reference an existing option`);
      }
      if (typeof rating.criterion === "string" && !criterionIds.has(rating.criterion)) {
        errors.push(`${itemPath}.criterion must reference an existing criterion`);
      }
      const key = `${rating.option}\u0000${rating.criterion}`;
      if (ratingKeys.has(key)) errors.push(`${itemPath} duplicates an earlier rating`);
      ratingKeys.add(key);
    });
  }
  if (hasOptions && hasCriteria && hasRatings && ratings.length !== options.length * criteria.length) {
    errors.push(`${path}.ratings must contain exactly one rating for every option and criterion`);
  }
  return errors;
}

function collectKnownIds(document: DiagramDocument): Set<string> {
  const knownIds = new Set<string>();
  if (document.family === "architecture") document.data.nodes.forEach((item) => knownIds.add(item.id));
  if (document.family === "sequence") {
    document.data.participants.forEach((item) => knownIds.add(item.id));
    document.data.messages.forEach((item) => knownIds.add(item.id));
  }
  if (document.family === "state") {
    document.data.states.forEach((item) => knownIds.add(item.id));
    document.data.transitions.forEach((item) => knownIds.add(item.id));
  }
  if (document.family === "mind-map") {
    const visitMindNode = (node: MindNode): void => {
      knownIds.add(node.id);
      node.children?.forEach(visitMindNode);
    };
    visitMindNode(document.data.root);
  }
  if (document.family === "timeline") document.data.events.forEach((item) => knownIds.add(item.id));
  if (document.family === "quadrant") document.data.points.forEach((item) => knownIds.add(item.id));
  if (document.family === "comparison") {
    document.data.options.forEach((item) => knownIds.add(item.id));
    document.data.criteria.forEach((item) => knownIds.add(item.id));
  }
  return knownIds;
}

export function validateDocument(value: unknown): string[] {
  const errors = validateDocumentEnvelope(value);
  if (!isObject(value) || errors.some((error) => error.startsWith("$.family"))) return errors;
  const family = value.family as FamilyId;
  const validators: Record<FamilyId, (data: unknown) => string[]> = {
    architecture: validateArchitectureData,
    sequence: validateSequenceData,
    state: validateStateData,
    "mind-map": validateMindMapData,
    timeline: validateTimelineData,
    quadrant: validateQuadrantData,
    comparison: validateComparisonData,
  };
  const familyErrors = validators[family](value.data);
  const knownIds = familyErrors.length === 0 ? collectKnownIds(value as unknown as DiagramDocument) : new Set<string>();
  return [...errors, ...familyErrors, ...validateQuestionOptions(value.options, knownIds)];
}

export function isDiagramDocument(value: unknown): value is DiagramDocument {
  return validateDocument(value).length === 0;
}

export function createInitialManifest(session: string, now = new Date()): SessionManifest {
  if (!ID_PATTERN.test(session)) throw new Error("session must be a lowercase kebab-case identifier");
  const timestamp = now.toISOString();
  return {
    version: 1,
    session,
    createdAt: timestamp,
    updatedAt: timestamp,
    diagrams: [],
  };
}
