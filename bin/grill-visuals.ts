#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  FAMILY_IDS,
  FAMILY_STATUS,
  createInitialManifest,
  isDiagramDocument,
  validateDocument,
} from "../src/contracts.js";
import { resolveLogoSources } from "../src/logos.js";
import { renderSession } from "../src/renderer.js";
import {
  cloudflarePreflight,
  exportSharingReceipt,
  getSharingState,
  importSharingReceipt,
  shareWithCloudflare,
  unshareFromCloudflare,
  verifyActiveShare,
} from "../src/cloudflare.js";
import {
  analyzeSessionPrivacy,
  assertPrivacyGate,
  buildSessionSnapshot,
  diffSessionSnapshots,
} from "../src/privacy.js";
import { serveLocalSession } from "../src/server.js";
import type { DiagramDocument, SessionManifest } from "../src/types.js";

const require = createRequire(import.meta.url);
const reactGrabPackage = require.resolve("react-grab/package.json");
const reactGrabRuntime = resolve(dirname(reactGrabPackage), "dist", "index.global.js");
const motionPackage = require.resolve("motion/package.json");
const motionRuntime = resolve(dirname(motionPackage), "dist", "motion.js");
const interPackage = require.resolve("inter-ui/package.json");
const interDirectory = resolve(dirname(interPackage), "variable");
const interRegular = resolve(interDirectory, "InterVariable.woff2");
const interItalic = resolve(interDirectory, "InterVariable-Italic.woff2");
const viewerRuntime = fileURLToPath(new URL("../browser/viewer.js", import.meta.url));
const DEFAULT_VIEWER_PORT = 8790;

const args = process.argv.slice(2);
const command = args[0];

interface SessionPaths {
  root: string;
  directory: string;
  manifest: string;
  specs: string;
  site: string;
  html: string;
  viewerRuntime: string;
  grabRuntime: string;
  motionRuntime: string;
  interRegular: string;
  interItalic: string;
  headers: string;
  robots: string;
  sharing: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileSystemError(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}

function usage(): void {
  console.log(`Grill Visuals (experimental)

Usage:
  grill-visuals families
  grill-visuals init --session <id> [--root <directory>]
  grill-visuals validate --input <file>
  grill-visuals upsert --session <id> --input <file> [--root <directory>]
  grill-visuals render --session <id> [--root <directory>] [--open] [--port <number>]
  grill-visuals open --session <id> [--root <directory>] [--port <number>] [--print]
  grill-visuals serve --session <id> [--port <number>] [--root <directory>] [--open]
  grill-visuals share --session <id> --public [--question <id>] [--account <id>] [--review-warnings] [--root <directory>]
  grill-visuals unshare --session <id> --yes [--root <directory>]
  grill-visuals handoff --session <id> [--root <directory>] [--json]
  grill-visuals pickup --session <id> --receipt <file> --yes [--root <directory>]

Share creates one owned Cloudflare Pages project. Treat every shared URL as public.`);
}

function option(name: string): string | undefined;
function option(name: string, fallback: string): string;
function option(name: string, fallback: null): string | null;
function option(name: string, fallback?: string | null): string | null | undefined {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function flag(name: string): boolean {
  return args.includes(name);
}

function sessionPaths(session: string): SessionPaths {
  createInitialManifest(session);
  const root = resolve(option("--root", ".context/grill-visuals"));
  const directory = resolve(root, session);
  return {
    root,
    directory,
    manifest: resolve(directory, "manifest.json"),
    specs: resolve(directory, "specs"),
    site: resolve(directory, "site"),
    html: resolve(directory, "site", "index.html"),
    viewerRuntime: resolve(directory, "site", "viewer.js"),
    grabRuntime: resolve(directory, "site", "react-grab.js"),
    motionRuntime: resolve(directory, "site", "motion.js"),
    interRegular: resolve(directory, "site", "InterVariable.woff2"),
    interItalic: resolve(directory, "site", "InterVariable-Italic.woff2"),
    headers: resolve(directory, "site", "_headers"),
    robots: resolve(directory, "site", "robots.txt"),
    sharing: resolve(directory, "sharing.json"),
  };
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${path} contains invalid JSON: ${error.message}`);
    throw error;
  }
}

async function writeAtomic(path: string, contents: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, path);
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadManifest(paths: SessionPaths, expectedSession: string): Promise<SessionManifest> {
  let manifest: unknown;
  try {
    manifest = await readJson(paths.manifest);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      throw new Error(`session ${expectedSession} does not exist; run init first`);
    }
    throw error;
  }
  if (
    !isRecord(manifest) ||
    manifest.version !== 1 ||
    manifest.session !== expectedSession ||
    !Array.isArray(manifest.diagrams)
  ) {
    throw new Error(`${paths.manifest} is not a valid v1 session manifest`);
  }
  return manifest as unknown as SessionManifest;
}

async function init(): Promise<void> {
  const session = option("--session");
  if (!session) throw new Error("--session is required");
  const paths = sessionPaths(session);
  const manifest = createInitialManifest(session);
  await mkdir(paths.directory, { recursive: true });
  await writeFile(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(paths.manifest);
}

async function validate(): Promise<void> {
  const input = option("--input");
  if (!input) throw new Error("--input is required");
  const inputPath = resolve(input);
  const document = await readJson(inputPath);
  const errors = validateDocument(document);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  if (!isDiagramDocument(document)) throw new Error("document failed validation unexpectedly");
  console.log(`valid v1 ${document.family} document`);
}

async function upsert(): Promise<void> {
  const session = option("--session");
  const input = option("--input");
  if (!session) throw new Error("--session is required");
  if (!input) throw new Error("--input is required");
  const paths = sessionPaths(session);
  const manifest = await loadManifest(paths, session);
  const document = await readJson(resolve(input));
  const errors = validateDocument(document);
  if (errors.length > 0) throw new Error(`document is invalid:\n${errors.join("\n")}`);
  if (!isDiagramDocument(document)) throw new Error("document failed validation unexpectedly");

  const timestamp = new Date().toISOString();
  const relativePath = `specs/${document.id}.json`;
  await writeJsonAtomic(resolve(paths.directory, relativePath), document);
  const entry = {
    id: document.id,
    family: document.family,
    title: document.title,
    summary: document.summary,
    status: document.status,
    path: relativePath,
    updatedAt: timestamp,
  };
  const existingIndex = manifest.diagrams.findIndex((item) => item.id === document.id);
  if (existingIndex === -1) manifest.diagrams.push(entry);
  else manifest.diagrams[existingIndex] = entry;
  manifest.updatedAt = timestamp;
  await writeJsonAtomic(paths.manifest, manifest);
  console.log(`${existingIndex === -1 ? "added" : "updated"} ${document.id}`);
}

async function loadDocuments(paths: SessionPaths, manifest: SessionManifest): Promise<DiagramDocument[]> {
  if (manifest.diagrams.length === 0) throw new Error("session contains no diagrams; run upsert first");
  return Promise.all(
    manifest.diagrams.map(async (entry) => {
      if (typeof entry.path !== "string" || !entry.path.startsWith("specs/")) {
        throw new Error(`manifest entry ${entry.id ?? "(unknown)"} has an unsafe path`);
      }
      const documentPath = resolve(paths.directory, entry.path);
      if (!documentPath.startsWith(`${paths.specs}${sep}`)) {
        throw new Error(`manifest entry ${entry.id ?? "(unknown)"} escapes the specs directory`);
      }
      const document = await readJson(documentPath);
      const errors = validateDocument(document);
      if (errors.length > 0) throw new Error(`${entry.path} is invalid:\n${errors.join("\n")}`);
      if (!isDiagramDocument(document)) throw new Error(`${entry.path} failed validation unexpectedly`);
      if (document.id !== entry.id) throw new Error(`${entry.path} id does not match its manifest entry`);
      return document;
    }),
  );
}

async function printSiteUrl(paths: SessionPaths): Promise<void> {
  try {
    await readFile(paths.html, "utf8");
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) throw new Error("rendered site not found; run render first");
    throw error;
  }
  const url = pathToFileURL(paths.html).href;
  console.log(url);
}

function openUrl(url: string): void {
  const launcher =
    process.platform === "darwin"
      ? { command: "open", args: [url] }
      : process.platform === "win32"
        ? { command: "cmd", args: ["/c", "start", "", url] }
        : { command: "xdg-open", args: [url] };
  const child = spawn(launcher.command, launcher.args, { detached: true, stdio: "ignore" });
  child.unref();
}

async function renderToSite(
  session: string,
  { quiet = false }: { quiet?: boolean } = {},
): Promise<{ paths: SessionPaths; manifest: SessionManifest; documents: DiagramDocument[] }> {
  const paths = sessionPaths(session);
  const manifest = await loadManifest(paths, session);
  const documents = await loadDocuments(paths, manifest);
  const { sources: logoSources, warnings: logoWarnings } = await resolveLogoSources(documents);
  logoWarnings.forEach((warning) => console.warn(`logo fallback: ${warning}`));
  const [html, viewerRuntimeSource, grabRuntime, motionRuntimeSource, interRegularSource, interItalicSource] = await Promise.all([
    renderSession(manifest, documents, { logoSources }),
    readFile(viewerRuntime, "utf8"),
    readFile(reactGrabRuntime, "utf8"),
    readFile(motionRuntime, "utf8"),
    readFile(interRegular),
    readFile(interItalic),
  ]);
  await Promise.all([
    writeAtomic(paths.html, html),
    writeAtomic(paths.viewerRuntime, viewerRuntimeSource),
    writeAtomic(paths.grabRuntime, grabRuntime),
    writeAtomic(paths.motionRuntime, motionRuntimeSource),
    writeAtomic(paths.interRegular, interRegularSource),
    writeAtomic(paths.interItalic, interItalicSource),
    writeAtomic(
      paths.headers,
      "/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n",
    ),
    writeAtomic(paths.robots, "User-agent: *\nDisallow: /\n"),
  ]);
  if (!quiet) console.log(paths.html);
  return { paths, manifest, documents };
}

async function render(): Promise<void> {
  const session = option("--session");
  if (!session) throw new Error("--session is required");
  if (flag("--open")) {
    await serveSession(session, { openAfter: true });
    return;
  }
  await renderToSite(session);
}

async function open(): Promise<void> {
  const session = option("--session");
  if (!session) throw new Error("--session is required");
  if (flag("--print")) {
    await printSiteUrl(sessionPaths(session));
    return;
  }
  await serveSession(session, { openAfter: true });
}

const MAX_PAGES_ASSET_BYTES = 25 * 1024 * 1024;

type CloudflareState = Awaited<ReturnType<typeof cloudflarePreflight>> | {
  authenticated: false;
  error: string;
  recoveryCommand: string;
  accounts: [];
  selectedAccountId: null;
  activeShare: Awaited<ReturnType<typeof getSharingState>>["activeShare"];
};

async function describeShare(
  session: string,
  paths: SessionPaths,
  { profile, accountId, cloudflareOverride }: {
    profile?: string | undefined;
    accountId?: string | undefined;
    cloudflareOverride?: CloudflareState | null | undefined;
  } = {},
) {
  const manifest = await loadManifest(paths, session);
  const documents = await loadDocuments(paths, manifest);
  const privacy = analyzeSessionPrivacy(documents);
  const snapshot = buildSessionSnapshot(documents);
  const sharing = await getSharingState({ session, ledgerPath: paths.sharing });
  const previous = sharing.activeShare?.snapshot ?? null;
  let cloudflare: CloudflareState | null | undefined = cloudflareOverride;
  if (!cloudflare) {
    try {
      cloudflare = await cloudflarePreflight({
        session,
        ledgerPath: paths.sharing,
        profile,
        accountId,
      });
    } catch (error) {
      cloudflare = {
        authenticated: false as const,
        error: error instanceof Error ? error.message : "Cloudflare login required",
        recoveryCommand: "npx wrangler login",
        accounts: [],
        selectedAccountId: null,
        activeShare: sharing.activeShare,
      };
    }
  }
  let siteBytes = 0;
  try { siteBytes = (await stat(paths.html)).size; } catch {}
  return {
    questions: documents.map((document, index) => ({ id: document.id, title: document.title, position: index + 1 })),
    privacy,
    snapshot,
    changes: previous ? diffSessionSnapshots(snapshot, previous) : null,
    siteBytes,
    siteTooLarge: siteBytes > MAX_PAGES_ASSET_BYTES,
    cloudflare,
    openCommand: `grill-visuals open --session ${session}`,
  };
}

function selectedCloudflareAccount(
  description: Awaited<ReturnType<typeof describeShare>>,
  requestedId?: string | null,
): { id: string; name: string } {
  if (!description.cloudflare.authenticated) throw new Error(description.cloudflare.error);
  const selectedId = description.cloudflare.activeShare?.accountId
    ?? requestedId
    ?? description.cloudflare.selectedAccountId;
  const account = description.cloudflare.accounts.find((item) => item.id === selectedId);
  if (!account) throw new Error("choose the Cloudflare account that will own this public page");
  return account;
}

async function serveSession(session: string, { openAfter }: { openAfter: boolean }): Promise<void> {
  const port = Number(option("--port", String(DEFAULT_VIEWER_PORT)));
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("--port must be an integer from 0 to 65535");
  }
  const profile = option("--profile");
  const { paths } = await renderToSite(session, { quiet: true });
  const initial = await describeShare(session, paths, { profile });
  if (!initial.cloudflare.authenticated) console.warn(initial.cloudflare.error);
  let cloudflareCache = initial.cloudflare.authenticated
    ? { value: initial.cloudflare, expiresAt: Date.now() + 30_000 }
    : null;
  const describeViewer = async () => {
    const cloudflareOverride = cloudflareCache && cloudflareCache.expiresAt > Date.now()
      ? cloudflareCache.value
      : null;
    const description = await describeShare(session, paths, { profile, cloudflareOverride });
    if (description.cloudflare.authenticated) {
      cloudflareCache = { value: description.cloudflare, expiresAt: Date.now() + 30_000 };
    }
    return description;
  };
  const preview = await serveLocalSession({
    site: paths.site,
    session,
    describe: describeViewer,
    port,
    publish: async ({ question, accountId, reviewedWarnings }) => {
      await renderToSite(session, { quiet: true });
      const description = await describeShare(session, paths, { profile, accountId: accountId ?? undefined });
      if (description.siteTooLarge) throw new Error("rendered page exceeds Cloudflare's 25 MiB asset limit");
      assertPrivacyGate(description.privacy, { reviewedWarnings });
      const account = selectedCloudflareAccount(description, accountId);
      const result = await shareWithCloudflare({
        session,
        site: paths.site,
        ledgerPath: paths.sharing,
        question,
        profile,
        accountId: account.id,
        accountName: account.name,
        snapshot: description.snapshot,
      });
      cloudflareCache = null;
      return result;
    },
    verify: () => verifyActiveShare({ session, ledgerPath: paths.sharing }),
    unshare: async () => {
      const result = await unshareFromCloudflare({ session, ledgerPath: paths.sharing, profile });
      cloudflareCache = null;
      return result;
    },
  });
  console.log(preview.url);
  if (openAfter) openUrl(preview.url);
  const shutdown = async () => {
    await preview.close();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function serve(): Promise<void> {
  const session = option("--session");
  if (!session) throw new Error("--session is required");
  await serveSession(session, { openAfter: flag("--open") });
}

function printResult(result: Record<string, unknown>): void {
  if (flag("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.immutableUrl) {
    if (result.state === "unverified") console.log("Status: may already be public; verification is incomplete");
    console.log(`Stable: ${result.stableUrl}`);
    console.log(`Immutable: ${result.immutableUrl}`);
    console.log(`Deployment: ${result.deploymentId}`);
    return;
  }
  if (result.imported) {
    console.log(`Imported: ${result.project}`);
    console.log(`Account: ${result.accountName}`);
    console.log(`Verified: ${result.verified}`);
    return;
  }
  console.log(`Unshared: ${result.stableUrl}`);
  console.log(`Verified: ${result.verified}`);
}

async function share(): Promise<void> {
  const session = option("--session");
  if (!session) throw new Error("--session is required");
  if (!flag("--public")) {
    throw new Error("share publishes session content to a public URL; rerun with --public to confirm");
  }
  const question = option("--question", null);
  const profile = option("--profile");
  const accountId = option("--account");
  const { paths, manifest } = await renderToSite(session, { quiet: flag("--json") });
  if (question && !manifest.diagrams.some((diagram) => diagram.id === question)) {
    throw new Error(`question ${question} is not part of session ${session}`);
  }
  const description = await describeShare(session, paths, { profile, accountId });
  if (description.siteTooLarge) throw new Error("rendered page exceeds Cloudflare's 25 MiB asset limit");
  assertPrivacyGate(description.privacy, { reviewedWarnings: flag("--review-warnings") });
  const account = selectedCloudflareAccount(description, accountId);
  printResult(await shareWithCloudflare({
    session,
    site: paths.site,
    ledgerPath: paths.sharing,
    question,
    profile,
    accountId: account.id,
    accountName: account.name,
    snapshot: description.snapshot,
  }));
}

async function unshare(): Promise<void> {
  const session = option("--session");
  if (!session) throw new Error("--session is required");
  if (!flag("--yes")) {
    throw new Error("unshare deletes the recorded owned Cloudflare Pages project; rerun with --yes to confirm");
  }
  const paths = sessionPaths(session);
  printResult(
    await unshareFromCloudflare({
      session,
      ledgerPath: paths.sharing,
      profile: option("--profile"),
    }),
  );
}

async function handoff(): Promise<void> {
  const session = option("--session");
  if (!session) throw new Error("--session is required");
  const receipt = await exportSharingReceipt({ session, ledgerPath: sessionPaths(session).sharing });
  console.log(JSON.stringify(receipt, null, 2));
}

async function pickup(): Promise<void> {
  const session = option("--session");
  const receiptPath = option("--receipt");
  if (!session) throw new Error("--session is required");
  if (!receiptPath) throw new Error("--receipt is required");
  if (!flag("--yes")) {
    throw new Error("pickup imports management rights for the exact public project; rerun with --yes to confirm");
  }
  const paths = sessionPaths(session);
  const receipt = await readJson(resolve(receiptPath));
  printResult(await importSharingReceipt({
    session,
    ledgerPath: paths.sharing,
    receipt,
    profile: option("--profile"),
  }));
}

async function main(): Promise<void> {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }
  if (command === "families") {
    console.log(FAMILY_IDS.map((family) => `${family}\t${FAMILY_STATUS[family]}`).join("\n"));
    return;
  }
  if (command === "init") return init();
  if (command === "validate") return validate();
  if (command === "upsert") return upsert();
  if (command === "render") return render();
  if (command === "open") return open();
  if (command === "serve") return serve();
  if (command === "share") return share();
  if (command === "unshare") return unshare();
  if (command === "handoff") return handoff();
  if (command === "pickup") return pickup();
  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
