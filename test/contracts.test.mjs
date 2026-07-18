import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_IDS,
  createInitialManifest,
  validateDocumentEnvelope,
} from "../src/contracts.mjs";

function validDocument(family) {
  return {
    version: 1,
    id: `${family}-question`,
    family,
    title: "Which path should we take?",
    summary: "Compare the safe rollout paths.",
    status: "current",
    data: {},
  };
}

test("accepts the common envelope for all seven families", () => {
  for (const family of FAMILY_IDS) {
    assert.deepEqual(validateDocumentEnvelope(validDocument(family)), []);
  }
});

test("rejects unknown families and fields", () => {
  const document = { ...validDocument("architecture"), family: "custom", html: "<script />" };
  const errors = validateDocumentEnvelope(document);

  assert(errors.some((error) => error.includes("$.family")));
  assert(errors.some((error) => error.includes("$.html")));
});

test("creates a deterministic empty session manifest", () => {
  const manifest = createInitialManifest("checkout-migration", new Date("2026-07-18T00:00:00.000Z"));

  assert.deepEqual(manifest, {
    version: 1,
    session: "checkout-migration",
    createdAt: "2026-07-18T00:00:00.000Z",
    diagrams: [],
  });
});

test("rejects unsafe session identifiers", () => {
  assert.throws(() => createInitialManifest("../production"), /kebab-case/);
});
