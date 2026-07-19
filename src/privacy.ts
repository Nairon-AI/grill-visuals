import { createHash } from "node:crypto";
import type { DiagramDocument } from "./types.js";

type PrivacyRule = readonly [name: string, pattern: RegExp];

export interface PrivacyFinding {
  rule: string;
  question: string;
}

export interface PrivacyReport {
  blocked: PrivacyFinding[];
  warnings: PrivacyFinding[];
}

export interface SnapshotQuestion {
  id: string;
  title: string;
  digest: string;
}

export interface SessionSnapshot {
  version: 1;
  questions: SnapshotQuestion[];
}

export interface SnapshotDiff {
  added: Array<Pick<SnapshotQuestion, "id" | "title">>;
  changed: Array<Pick<SnapshotQuestion, "id" | "title">>;
  removed: Array<Pick<SnapshotQuestion, "id" | "title">>;
}

const BLOCK_RULES: readonly PrivacyRule[] = Object.freeze([
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["github-token", /\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{30,255}\b/],
  ["slack-token", /\bxox(?:a|b|p|r|s)-[A-Za-z0-9-]{20,}\b/],
  ["stripe-live-secret", /\bsk_live_[A-Za-z0-9]{16,}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
]);

const WARNING_RULES: readonly PrivacyRule[] = Object.freeze([
  ["jwt-like-token", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
  ["credential-in-url", /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
  ["generic-secret", /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\b[\s"']*[:=][\s"']*[A-Za-z0-9_./+=-]{12,}/i],
  ["bearer-token", /\bBearer\s+[A-Za-z0-9_./+=-]{16,}\b/i],
]);

function matches(rules: readonly PrivacyRule[], text: string, question: string): PrivacyFinding[] {
  return rules.flatMap(([rule, pattern]) => pattern.test(text) ? [{ rule, question }] : []);
}

export function analyzeSessionPrivacy(documents: DiagramDocument[]): PrivacyReport {
  const blocked: PrivacyFinding[] = [];
  const warnings: PrivacyFinding[] = [];
  for (const document of documents) {
    const text = JSON.stringify(document);
    blocked.push(...matches(BLOCK_RULES, text, document.id));
    warnings.push(...matches(WARNING_RULES, text, document.id));
  }
  return { blocked, warnings };
}

export function buildSessionSnapshot(documents: DiagramDocument[]): SessionSnapshot {
  return {
    version: 1,
    questions: documents.map((document) => ({
      id: document.id,
      title: document.title,
      digest: createHash("sha256").update(JSON.stringify(document)).digest("hex").slice(0, 24),
    })),
  };
}

export function diffSessionSnapshots(current: SessionSnapshot, previous?: SessionSnapshot | null): SnapshotDiff {
  const before = new Map((previous?.questions ?? []).map((item) => [item.id, item]));
  const after = new Map((current?.questions ?? []).map((item) => [item.id, item]));
  const added: SnapshotDiff["added"] = [];
  const changed: SnapshotDiff["changed"] = [];
  const removed: SnapshotDiff["removed"] = [];
  for (const item of current?.questions ?? []) {
    const prior = before.get(item.id);
    if (!prior) added.push({ id: item.id, title: item.title });
    else if (prior.digest !== item.digest || prior.title !== item.title) changed.push({ id: item.id, title: item.title });
  }
  for (const item of previous?.questions ?? []) {
    if (!after.has(item.id)) removed.push({ id: item.id, title: item.title });
  }
  return { added, changed, removed };
}

export function assertPrivacyGate(
  report: PrivacyReport,
  { reviewedWarnings = false }: { reviewedWarnings?: boolean } = {},
): void {
  if (report.blocked.length > 0) {
    const questions = [...new Set(report.blocked.map((item) => item.question))].join(", ");
    throw new Error(`publishing blocked: likely credentials found in ${questions}`);
  }
  if (report.warnings.length > 0 && !reviewedWarnings) {
    throw new Error("publishing requires explicit review of the privacy warnings");
  }
}
