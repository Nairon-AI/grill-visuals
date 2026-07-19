import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSessionPrivacy,
  assertPrivacyGate,
  buildSessionSnapshot,
  diffSessionSnapshots,
} from "../src/privacy.js";
import type { ComparisonDocument } from "../src/types.js";

function document(id: string, summary: string): ComparisonDocument {
  return {
    version: 1,
    id,
    family: "comparison",
    title: `Question ${id}`,
    summary,
    status: "current",
    options: [],
    data: { options: [], criteria: [], ratings: [] },
  };
}

test("blocks likely credentials without copying their values into findings", () => {
  const report = analyzeSessionPrivacy([document("checkout", "Use sk_live_1234567890abcdefgh for this example")]);
  assert.deepEqual(report.blocked, [{ rule: "stripe-live-secret", question: "checkout" }]);
  assert.throws(() => assertPrivacyGate(report), /publishing blocked/);
  assert(!JSON.stringify(report).includes("1234567890abcdefgh"));
});

test("requires explicit review for lower-confidence privacy warnings", () => {
  const report = analyzeSessionPrivacy([document("api", "api_key=possibly-not-real-but-long")]);
  assert.equal(report.warnings.length, 1);
  assert.throws(() => assertPrivacyGate(report), /explicit review/);
  assert.doesNotThrow(() => assertPrivacyGate(report, { reviewedWarnings: true }));
});

test("summarizes added, changed, and removed questions", () => {
  const before = buildSessionSnapshot([document("one", "old"), document("gone", "remove")]);
  const after = buildSessionSnapshot([document("one", "new"), document("two", "add")]);
  const changes = diffSessionSnapshots(after, before);
  assert.deepEqual(changes.added.map((item) => item.id), ["two"]);
  assert.deepEqual(changes.changed.map((item) => item.id), ["one"]);
  assert.deepEqual(changes.removed.map((item) => item.id), ["gone"]);
});
