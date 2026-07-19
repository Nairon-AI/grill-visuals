import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../dist/bin/grill-visuals.js");
const fixtures = [
  "grill-visuals-runtime.json",
  "teammate-ask-sequence.json",
  "question-readiness-state.json",
  "replacement-readiness-mind-map.json",
  "grill-visuals-rollout-timeline.json",
  "diagram-priority-quadrant.json",
  "sharing-options-comparison.json",
].map((name) => resolve(here, `../examples/${name}`));

test("runs init, upsert, render, and printable open end to end", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "grill-visuals-test-"));
  try {
    await exec(process.execPath, [cli, "init", "--session", "checkout-migration", "--root", root]);
    for (const fixture of fixtures) {
      await exec(process.execPath, [
        cli,
        "upsert",
        "--session",
        "checkout-migration",
        "--input",
        fixture,
        "--root",
        root,
      ]);
    }
    await exec(process.execPath, [cli, "render", "--session", "checkout-migration", "--root", root]);
    const { stdout } = await exec(process.execPath, [
      cli,
      "open",
      "--session",
      "checkout-migration",
      "--root",
      root,
      "--print",
    ]);
    assert.match(stdout, /^file:\/\//);
    const html = await readFile(resolve(root, "checkout-migration/site/index.html"), "utf8");
    assert.match(html, /grill-visuals CLI/);
    assert.match(html, /<meta name="grill-visuals-session" content="checkout-migration">/);
    assert.match(html, /data-logo-key="path:assets\/grill-visuals\.svg"/);
    assert.match(html, /data:image\/svg\+xml;base64/);
    const grabRuntime = await readFile(
      resolve(root, "checkout-migration/site/react-grab.js"),
      "utf8",
    );
    assert.match(grabRuntime, /__REACT_GRAB_MODULE__/);
    const motionRuntime = await readFile(
      resolve(root, "checkout-migration/site/motion.js"),
      "utf8",
    );
    assert.match(motionRuntime, /\.Motion=\{\}/);
    const viewerRuntime = await readFile(
      resolve(root, "checkout-migration/site/viewer.js"),
      "utf8",
    );
    assert.match(viewerRuntime, /function initializePanel\(panel\)/);
    assert.match(viewerRuntime, /grill-visuals open --session/);
    assert.doesNotMatch(viewerRuntime, /grill-visuals serve --session/);
    const interRegular = await readFile(
      resolve(root, "checkout-migration/site/InterVariable.woff2"),
    );
    const interItalic = await readFile(
      resolve(root, "checkout-migration/site/InterVariable-Italic.woff2"),
    );
    assert.equal(interRegular.byteLength, 352240);
    assert.equal(interItalic.byteLength, 387976);
    assert.match(
      await readFile(resolve(root, "checkout-migration/site/_headers"), "utf8"),
      /X-Robots-Tag: noindex, nofollow/,
    );
    const manifest = JSON.parse(
      await readFile(resolve(root, "checkout-migration/manifest.json"), "utf8"),
    );
    assert.equal(manifest.diagrams.length, 7);
    assert.equal(manifest.diagrams[0].id, "grill-visuals-runtime");
    assert.equal(manifest.diagrams[6].family, "comparison");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
