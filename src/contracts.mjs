export const FAMILY_IDS = Object.freeze([
  "architecture",
  "sequence",
  "state",
  "mind-map",
  "timeline",
  "quadrant",
  "comparison",
]);

export const TAB_STATUSES = Object.freeze(["current", "resolved", "blocked"]);

const ROOT_KEYS = new Set(["version", "id", "family", "title", "summary", "status", "data"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function checkString(errors, value, path, maxLength) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
    return;
  }

  if (value.length > maxLength) {
    errors.push(`${path} must be at most ${maxLength} characters`);
  }
}

export function validateDocumentEnvelope(value) {
  const errors = [];

  if (!isObject(value)) {
    return ["$ must be an object"];
  }

  for (const key of Object.keys(value)) {
    if (!ROOT_KEYS.has(key)) errors.push(`$.${key} is not allowed`);
  }

  if (value.version !== 1) errors.push("$.version must equal 1");

  checkString(errors, value.id, "$.id", 64);
  if (typeof value.id === "string" && !ID_PATTERN.test(value.id)) {
    errors.push("$.id must be a lowercase kebab-case identifier");
  }

  if (!FAMILY_IDS.includes(value.family)) {
    errors.push(`$.family must be one of: ${FAMILY_IDS.join(", ")}`);
  }

  checkString(errors, value.title, "$.title", 120);
  checkString(errors, value.summary, "$.summary", 500);

  if (!TAB_STATUSES.includes(value.status)) {
    errors.push(`$.status must be one of: ${TAB_STATUSES.join(", ")}`);
  }

  if (!isObject(value.data)) errors.push("$.data must be an object");

  return errors;
}

export function createInitialManifest(session, now = new Date()) {
  if (!ID_PATTERN.test(session)) {
    throw new Error("session must be a lowercase kebab-case identifier");
  }

  return {
    version: 1,
    session,
    createdAt: now.toISOString(),
    diagrams: [],
  };
}
