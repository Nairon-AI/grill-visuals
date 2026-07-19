import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../dist/bin/grill-visuals.js");
const fixture = resolve(here, "../examples/sharing-options-comparison.json");

const fakeWranglerSource = `
import { readFile, writeFile } from "node:fs/promises";
const statePath = process.env.GRILL_VISUALS_FAKE_CLOUDFLARE;
const args = process.argv.slice(2);
let state = { project: null, deployments: [] };
try { state = JSON.parse(await readFile(statePath, "utf8")); } catch {}
const save = () => writeFile(statePath, JSON.stringify(state));
if (args.join(" ") === "whoami --json") {
  console.log(JSON.stringify({ loggedIn: true, email: "developer@example.com", accounts: [{ id: "account-1", name: "Example Team" }] }));
} else if (args.join(" ").startsWith("pages project list")) {
  console.log(JSON.stringify(state.project ? [{ name: state.project, subdomain: state.project + ".pages.dev" }] : []));
} else if (args.join(" ").startsWith("pages project create")) {
  state.project = args[3]; await save(); console.log("created");
} else if (args.join(" ").startsWith("pages deployment list")) {
  console.log(JSON.stringify(state.deployments));
} else if (args.join(" ").startsWith("pages deploy")) {
  const id = "deployment-" + (state.deployments.length + 1);
  const url = "https://" + id + "." + state.project + ".pages.dev";
  state.deployments.unshift({ id, url, aliases: ["https://" + state.project + ".pages.dev"], created_on: new Date().toISOString() });
  await save(); console.log("Deployment complete: " + url);
} else if (args.join(" ").startsWith("pages project delete")) {
  state.project = null; state.deployments = []; await save(); console.log("deleted");
} else {
  console.error("unexpected fake Wrangler args: " + args.join(" ")); process.exitCode = 1;
}
`;

test("shares, updates, records, and safely unshares one owned Pages project", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "grill-visuals-cloudflare-"));
  const runtime = resolve(root, "fake-wrangler.mjs");
  const cloudflareState = resolve(root, "cloudflare.json");
  const preload = resolve(root, "fetch-gone.mjs");
  await writeFile(runtime, fakeWranglerSource);
  await writeFile(preload, `
import { readFile } from "node:fs/promises";
globalThis.fetch = async () => {
  try {
    const state = JSON.parse(await readFile(process.env.GRILL_VISUALS_FAKE_CLOUDFLARE, "utf8"));
    if (state.project) return new Response('<meta name="grill-visuals-session" content="share-proof">', { status: 200 });
  } catch {}
  return new Response("gone", { status: 404 });
};
`);
  const env = {
    ...process.env,
    GRILL_VISUALS_WRANGLER_RUNTIME: runtime,
    GRILL_VISUALS_FAKE_CLOUDFLARE: cloudflareState,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${preload}`.trim(),
  };

  await exec(process.execPath, [cli, "init", "--session", "share-proof", "--root", root], { env });
  await exec(
    process.execPath,
    [cli, "upsert", "--session", "share-proof", "--input", fixture, "--root", root],
    { env },
  );

  await assert.rejects(
    exec(process.execPath, [cli, "share", "--session", "share-proof", "--root", root], { env }),
    /rerun with --public/,
  );
  const first = await exec(
    process.execPath,
    [
      cli,
      "share",
      "--session",
      "share-proof",
      "--question",
      "sharing-options-comparison",
      "--root",
      root,
      "--public",
      "--json",
    ],
    { env },
  );
  const firstResult = JSON.parse(first.stdout);
  assert.match(firstResult.project, /^grill-visuals-share-proof-[a-f0-9]{8}$/);
  assert.match(firstResult.stableUrl, /\.pages\.dev#sharing-options-comparison$/);
  assert.match(firstResult.immutableUrl, /^https:\/\/deployment-1\..+\.pages\.dev#sharing-options-comparison$/);

  const second = await exec(
    process.execPath,
    [cli, "share", "--session", "share-proof", "--root", root, "--public", "--json"],
    { env },
  );
  const secondResult = JSON.parse(second.stdout);
  assert.equal(secondResult.project, firstResult.project);
  assert.notEqual(secondResult.immutableUrl, firstResult.immutableUrl);

  const ledgerPath = resolve(root, "share-proof/sharing.json");
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  assert.equal(ledger.shares.length, 1);
  assert.equal(ledger.shares[0].deployments.length, 2);
  assert.equal(ledger.shares[0].accountName, "Example Team");

  const handoff = await exec(
    process.execPath,
    [cli, "handoff", "--session", "share-proof", "--root", root, "--json"],
    { env },
  );
  const receipt = JSON.parse(handoff.stdout);
  assert.equal(receipt.project, firstResult.project);
  assert(!handoff.stdout.includes("developer@example.com"));

  const pickupRoot = await mkdtemp(resolve(tmpdir(), "grill-visuals-pickup-"));
  const receiptPath = resolve(pickupRoot, "receipt.json");
  await writeFile(receiptPath, handoff.stdout);
  await exec(process.execPath, [cli, "init", "--session", "share-proof", "--root", pickupRoot], { env });
  await exec(process.execPath, [cli, "upsert", "--session", "share-proof", "--input", fixture, "--root", pickupRoot], { env });
  const imported = await exec(
    process.execPath,
    [cli, "pickup", "--session", "share-proof", "--receipt", receiptPath, "--root", pickupRoot, "--yes", "--json"],
    { env },
  );
  assert.equal(JSON.parse(imported.stdout).verified, true);

  await assert.rejects(
    exec(process.execPath, [cli, "unshare", "--session", "share-proof", "--root", root], { env }),
    /rerun with --yes/,
  );
  const removed = await exec(
    process.execPath,
    [cli, "unshare", "--session", "share-proof", "--root", root, "--yes", "--json"],
    { env },
  );
  assert.equal(JSON.parse(removed.stdout).verified, true);
  const finalLedger = JSON.parse(await readFile(ledgerPath, "utf8"));
  assert.equal(typeof finalLedger.shares[0].unsharedAt, "string");
  assert.equal(JSON.parse(await readFile(cloudflareState, "utf8")).project, null);
});
