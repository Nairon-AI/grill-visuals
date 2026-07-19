import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { layoutArchitecture, roundedOrthogonalPath } from "../src/layout.js";
import { isDiagramDocument } from "../src/contracts.js";
import type { ArchitectureDocument } from "../src/types.js";

const fixtureValue: unknown = JSON.parse(
  await readFile(new URL("../examples/checkout-migration.json", import.meta.url), "utf8"),
);
if (!isDiagramDocument(fixtureValue) || fixtureValue.family !== "architecture") {
  throw new Error("checkout migration fixture is invalid");
}
const fixture: ArchitectureDocument = fixtureValue;

test("lays out every node and edge deterministically", async () => {
  const first = await layoutArchitecture(fixture);
  const second = await layoutArchitecture(fixture);
  assert.deepEqual(second, first);
  assert.equal(first.nodes.length, fixture.data.nodes.length);
  assert.equal(first.edges.length, fixture.data.edges.length);
  assert.equal(first.groups.length, 1);
  assert(first.width >= 640);
  assert(first.height >= 420);
  assert(first.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert(first.nodes.every((node) => node.width >= 220 && node.width <= 250));
  assert(new Set(first.nodes.map((node) => node.width)).size > 1);
  const customer = first.nodes.find((node) => node.id === "customer");
  assert(customer && customer.height >= 144);
  assert(first.edges.every((edge) => edge.path.startsWith("M ") && !edge.path.includes("NaN")));
  const group = first.groups[0];
  assert(group);
  const members = first.nodes.filter((node) => node.group === group.label);
  assert.equal(members.length, 3);
  assert(members.every((node) => node.x >= group.x && node.x + node.width <= group.x + group.width));
  assert(members.every((node) => node.y >= group.y && node.y + node.height <= group.y + group.height));
});

test("rounds orthogonal corners and ignores duplicate points", () => {
  const path = roundedOrthogonalPath([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 30 },
  ]);
  assert.match(path, /^M 0 0/);
  assert.match(path, /Q 30 0/);
  assert(!path.includes("NaN"));
});

test("grows architecture nodes instead of clipping long copy", async () => {
  const document = structuredClone(fixture);
  const firstNode = document.data.nodes[0];
  assert(firstNode);
  firstNode.label = "W".repeat(36);
  firstNode.description = "W".repeat(90);
  const layout = await layoutArchitecture(document);
  assert((layout.nodes.find((node) => node.id === firstNode.id)?.height ?? 0) > 100);
});
