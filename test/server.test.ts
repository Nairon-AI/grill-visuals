import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { serveLocalSession } from "../src/server.js";

function record(value: unknown): Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

test("serves a local session and protects the public-share bridge", async () => {
  const site = await mkdtemp(resolve(tmpdir(), "grill-visuals-server-"));
  await writeFile(resolve(site, "index.html"), "<!doctype html><title>Local proof</title>");
  const calls: Array<string | null> = [];
  const preview = await serveLocalSession({
    site,
    session: "share-proof",
    describe: async () => ({ questions: [{ id: "hosting-choice", title: "Hosting choice" }] }),
    port: 0,
    publish: async ({ question }) => {
      calls.push(question);
      return {
        stableUrl: `https://stable.pages.dev#${question}`,
        immutableUrl: `https://exact.stable.pages.dev#${question}`,
      };
    },
    verify: async () => ({ state: "published" }),
    unshare: async () => ({ verified: true }),
  });

  try {
    const page = await fetch(preview.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Local proof/);

    const capabilityResponse = await fetch(`${preview.url}/__grill-visuals/capabilities`);
    const capability = record(await capabilityResponse.json());
    assert.equal(capability.canPublish, true);
    assert.equal(capability.session, "share-proof");
    assert.equal(typeof capability.csrfToken, "string");
    const csrfToken = String(capability.csrfToken);

    const missingOrigin = await fetch(`${preview.url}/__grill-visuals/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Grill-Visuals-Token": csrfToken,
      },
      body: JSON.stringify({ question: "hosting-choice" }),
    });
    assert.equal(missingOrigin.status, 403);

    const invalidQuestion = await fetch(`${preview.url}/__grill-visuals/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": preview.url,
        "X-Grill-Visuals-Token": csrfToken,
      },
      body: JSON.stringify({ question: "not-owned" }),
    });
    assert.equal(invalidQuestion.status, 400);

    const shared = await fetch(`${preview.url}/__grill-visuals/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": preview.url,
        "X-Grill-Visuals-Token": csrfToken,
      },
      body: JSON.stringify({ question: "hosting-choice" }),
    });
    assert.equal(shared.status, 200);
    assert.deepEqual(calls, ["hosting-choice"]);
    const sharedResult = record(await shared.json());
    assert.equal(typeof sharedResult.immutableUrl, "string");
    assert.match(String(sharedResult.immutableUrl), /exact\.stable\.pages\.dev/);
  } finally {
    await preview.close();
    await rm(site, { recursive: true, force: true });
  }
});
