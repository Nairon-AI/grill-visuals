import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { googleFaviconUrl, resolveLogoSources } from "../src/logos.js";
import { isDiagramDocument } from "../src/contracts.js";
import type { DiagramDocument } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));
function parseFixture(source: string): DiagramDocument {
  const value: unknown = JSON.parse(source);
  if (!isDiagramDocument(value)) throw new Error("invalid logo fixture");
  return value;
}
const checkout = parseFixture(await readFile(resolve(here, "../examples/checkout-migration.json"), "utf8"));
const runtime = parseFixture(await readFile(resolve(here, "../examples/grill-visuals-runtime.json"), "utf8"));

test("builds the canonical Google favicon request", () => {
  assert.equal(
    googleFaviconUrl("Stripe.com"),
    "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://stripe.com&size=256",
  );
});

test("deduplicates provider domains and returns embedded image data", async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (url) => {
    requested.push(String(url));
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "content-type": "image/png" },
    });
  };
  const { sources, warnings } = await resolveLogoSources([checkout], { fetchImpl });
  assert.deepEqual(warnings, []);
  assert.equal(sources.size, 4);
  assert.equal(requested.length, 4);
  assert.match(sources.get("domain:stripe.com") ?? "", /^data:image\/png;base64,/);
});

test("embeds a safe repo-relative product logo without fetching", async () => {
  const { sources, warnings } = await resolveLogoSources([runtime], {
    baseDirectory: resolve(here, ".."),
    fetchImpl: async () => assert.fail("local logos must not fetch"),
  });
  assert.deepEqual(warnings, []);
  assert.match(sources.get("path:assets/grill-visuals.svg") ?? "", /^data:image\/svg\+xml;base64,/);
});
