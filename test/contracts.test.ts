import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FAMILY_IDS,
  createInitialManifest,
  validateDocument,
  validateDocumentEnvelope,
} from "../src/contracts.js";

const fixture = JSON.parse(
  await readFile(new URL("../examples/checkout-migration.json", import.meta.url), "utf8"),
);
const familyFixtures = await Promise.all([
  "checkout-migration.json",
  "teammate-ask-sequence.json",
  "question-readiness-state.json",
  "replacement-readiness-mind-map.json",
  "grill-visuals-rollout-timeline.json",
  "diagram-priority-quadrant.json",
  "sharing-options-comparison.json",
].map(async (name) => JSON.parse(await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8"))));

test("accepts the common envelope for all seven families", () => {
  for (const family of FAMILY_IDS) {
    const document = { ...fixture, id: `${family}-question`, family };
    assert.deepEqual(validateDocumentEnvelope(document), []);
  }
});

test("accepts strict documents for all seven families", () => {
  assert.deepEqual(familyFixtures.map((document) => document.family), FAMILY_IDS);
  familyFixtures.forEach((document) => assert.deepEqual(validateDocument(document), []));
});

test("rejects unknown fields and dangling edges", () => {
  const document = structuredClone(fixture);
  document.data.nodes[0].html = "<script />";
  document.data.edges[0].target = "missing-node";
  const errors = validateDocument(document);
  assert(errors.some((error) => error.includes(".html is not allowed")));
  assert(errors.some((error) => error.includes("must reference an existing node")));
});

test("requires one product logo and canonical provider domains", () => {
  const document = structuredClone(fixture);
  delete document.data.project;
  assert(validateDocument(document).some((error) => error.includes("project must be an object")));

  document.data.project = {
    name: "Storefront",
    iconDomain: "Shopify.com",
    iconPath: "../logo.svg",
  };
  document.data.nodes[0].domain = "https://stripe.com";
  const errors = validateDocument(document);
  assert(errors.some((error) => error.includes("exactly one of iconDomain or iconPath")));
  assert(errors.some((error) => error.includes("lowercase canonical domain")));
  assert(errors.some((error) => error.includes("safe relative")));
});

test("rejects ambiguous recommendations and dangling option highlights", () => {
  const document = structuredClone(fixture);
  document.options[0].recommended = false;
  document.options[1].recommended = true;
  document.options[2].recommended = true;
  document.options[0].highlights = ["missing-item"];
  const errors = validateDocument(document);
  assert(errors.some((error) => error.includes("exactly one recommended option")));
  assert(errors.some((error) => error.includes("must reference an item in this diagram")));
});

test("creates a deterministic empty session manifest", () => {
  const manifest = createInitialManifest("checkout-migration", new Date("2026-07-18T00:00:00.000Z"));
  assert.deepEqual(manifest, {
    version: 1,
    session: "checkout-migration",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    diagrams: [],
  });
});

test("rejects unsafe session identifiers", () => {
  assert.throws(() => createInitialManifest("../production"), /kebab-case/);
});
