#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  FAMILY_IDS,
  createInitialManifest,
  validateDocumentEnvelope,
} from "../src/contracts.mjs";

const args = process.argv.slice(2);
const command = args[0];

function usage() {
  console.log(`Grill Visuals (experimental)

Usage:
  grill-visuals families
  grill-visuals init --session <id> [--root <directory>]
  grill-visuals validate --input <file>
  grill-visuals upsert|render|open|share|unshare

Only families, init, and validate are implemented in this scaffold.`);
}

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

async function init() {
  const session = option("--session");
  if (!session) throw new Error("--session is required");

  const root = resolve(option("--root", ".context/grill-visuals"));
  const directory = resolve(root, session);
  const manifestPath = resolve(directory, "manifest.json");
  const manifest = createInitialManifest(session);

  await mkdir(directory, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(manifestPath);
}

async function validate() {
  const input = option("--input");
  if (!input) throw new Error("--input is required");

  const inputPath = resolve(input);
  const document = JSON.parse(await readFile(inputPath, "utf8"));
  const errors = validateDocumentEnvelope(document);

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }

  console.log(`valid v1 ${document.family} document`);
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "families") {
    console.log(FAMILY_IDS.join("\n"));
    return;
  }

  if (command === "init") return init();
  if (command === "validate") return validate();

  if (["upsert", "render", "open", "share", "unshare"].includes(command)) {
    console.error(`${command} is specified but not implemented in the experimental scaffold`);
    process.exitCode = 2;
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
