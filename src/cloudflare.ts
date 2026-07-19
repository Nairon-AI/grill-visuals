import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import type { SessionSnapshot } from "./privacy.js";

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const PROJECT_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ANSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;

type JsonRecord = Record<string, unknown>;

interface WranglerOptions {
  profile?: string | undefined;
  accountId?: string | null | undefined;
}

interface CloudflareAccount {
  id: string;
  name: string;
}

interface CloudflareProject extends JsonRecord {
  name: string;
  subdomain?: unknown;
}

interface CloudflareDeployment extends JsonRecord {
  id?: unknown;
  url?: unknown;
  aliases?: unknown;
  created_on?: unknown;
}

interface DeploymentRecord {
  id: string;
  url: string;
  aliases: string[];
  createdAt: string;
  snapshot?: SessionSnapshot | null;
}

interface ShareRecord {
  ownership: "session-project";
  project: string;
  branch: "main";
  accountId: string | null;
  accountName: string | null;
  stableUrl: string;
  createdAt: string;
  importedAt?: string;
  updatedAt?: string;
  unsharedAt?: string;
  unshareVerifiedAt?: string;
  deployments: DeploymentRecord[];
}

interface ShareLedger {
  version: 1;
  provider: "cloudflare-pages";
  session: string;
  shares: ShareRecord[];
}

export interface PublicShare {
  project: string;
  accountId: string | null;
  accountName: string | null;
  stableUrl: string;
  immutableUrl: string | null;
  deploymentId: string | null;
  snapshot: SessionSnapshot | null;
  updatedAt: string;
}

export interface SharingReceipt {
  version: 1;
  provider: "cloudflare-pages";
  session: string;
  project: string;
  accountId: string | null;
  accountName: string | null;
  stableUrl: string;
  immutableUrl: string | null;
  deploymentId: string | null;
  updatedAt: string;
}

interface SessionLedgerOptions {
  session: string;
  ledgerPath: string;
}

interface PreflightOptions extends SessionLedgerOptions {
  profile?: string | undefined;
  accountId?: string | undefined;
}

interface ImportReceiptOptions extends SessionLedgerOptions {
  receipt: unknown;
  profile?: string | undefined;
}

interface ShareOptions extends SessionLedgerOptions {
  site: string;
  question?: string | null | undefined;
  profile?: string | undefined;
  accountId?: string | null | undefined;
  accountName?: string | null | undefined;
  snapshot?: SessionSnapshot | null | undefined;
}

interface UnshareOptions extends SessionLedgerOptions {
  profile?: string | undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanOutput(value: unknown): string {
  return String(value ?? "").replace(ANSI_PATTERN, "").trim();
}

function wranglerRuntime(): string {
  if (process.env.GRILL_VISUALS_WRANGLER_RUNTIME) {
    return resolve(process.env.GRILL_VISUALS_WRANGLER_RUNTIME);
  }
  const packagePath = require.resolve("wrangler/package.json");
  const packageJson: unknown = require(packagePath);
  if (!isRecord(packageJson) || !(typeof packageJson.bin === "string" || isRecord(packageJson.bin))) {
    throw new Error("Wrangler package does not expose a CLI runtime");
  }
  const relativeBin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin.wrangler;
  if (typeof relativeBin !== "string") throw new Error("Wrangler package does not expose a CLI runtime");
  return resolve(dirname(packagePath), relativeBin);
}

async function runWrangler(
  args: string[],
  { profile, accountId }: WranglerOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const commandArgs = profile ? [...args, "--profile", profile] : args;
  try {
    return await exec(process.execPath, [wranglerRuntime(), ...commandArgs], {
      env: {
        ...process.env,
        CI: "1",
        ...(accountId ? { CLOUDFLARE_ACCOUNT_ID: accountId } : {}),
      },
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const failure = isRecord(error) ? error : {};
    const detail = cleanOutput(failure.stderr || failure.stdout || failure.message);
    if (/not logged in|auth token has expired|authentication/i.test(detail)) {
      throw new Error("Cloudflare login required. Run npx wrangler login, then retry.");
    }
    throw new Error(`Cloudflare command failed${detail ? `: ${detail.slice(0, 1800)}` : ""}`);
  }
}

function parseWranglerJson(stdout: string, label: string): unknown {
  const output = cleanOutput(stdout);
  try {
    return JSON.parse(output);
  } catch {
    const starts = [output.indexOf("["), output.indexOf("{")].filter((index) => index >= 0);
    const start = starts.length > 0 ? Math.min(...starts) : -1;
    const end = Math.max(output.lastIndexOf("]"), output.lastIndexOf("}"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(output.slice(start, end + 1));
      } catch {}
    }
    throw new Error(`Cloudflare returned invalid JSON while listing ${label}`);
  }
}

function resultArray(value: unknown, label: string): JsonRecord[] {
  const result = Array.isArray(value) ? value : isRecord(value) ? value.result : undefined;
  if (!Array.isArray(result)) throw new Error(`Cloudflare returned an invalid ${label} list`);
  if (!result.every(isRecord)) throw new Error(`Cloudflare returned invalid ${label} entries`);
  return result;
}

function pagesDomain(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(/[\s,]+/).find((domain) => domain.endsWith(".pages.dev"));
}

async function listProjects(options: WranglerOptions): Promise<CloudflareProject[]> {
  const { stdout } = await runWrangler(["pages", "project", "list", "--json"], options);
  return resultArray(parseWranglerJson(stdout, "projects"), "project").map((project) => {
    const name = project.name ?? project["Project Name"];
    if (typeof name !== "string") throw new Error("Cloudflare returned a project without a name");
    return {
      ...project,
      name,
      subdomain: project.subdomain ?? pagesDomain(project["Project Domains"]),
    };
  });
}

async function listDeployments(project: string, options: WranglerOptions): Promise<CloudflareDeployment[]> {
  const { stdout } = await runWrangler(
    ["pages", "deployment", "list", "--project-name", project, "--environment", "production", "--json"],
    options,
  );
  return resultArray(parseWranglerJson(stdout, "deployments"), "deployment").map((deployment) => ({
    ...deployment,
    id: deployment.id ?? deployment.Id,
    url: deployment.url ?? deployment.Deployment,
    aliases: deployment.aliases ?? deployment.Aliases,
    created_on: deployment.created_on ?? deployment.Created,
  }));
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const candidate = /^https?:\/\//.test(value) ? value : `https://${value}`;
  try {
    return new URL(candidate).href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isOwnedPagesUrl(project: string, value: unknown): boolean {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const url = new URL(normalized);
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.hostname.endsWith(".pages.dev") &&
    (url.hostname === `${project}.pages.dev` || url.hostname.startsWith(`${project}-`))
  );
}

function stableUrlForProject(project: CloudflareProject | undefined, fallbackName: string): string {
  return normalizeUrl(project?.subdomain) ?? `https://${fallbackName}.pages.dev`;
}

function deploymentRecord(deployment: CloudflareDeployment, fallbackUrl: string | null): DeploymentRecord {
  const url = normalizeUrl(deployment?.url) ?? fallbackUrl;
  if (typeof deployment?.id !== "string" || !url) {
    throw new Error("Cloudflare did not return a deployment ID and URL");
  }
  return {
    id: deployment.id,
    url,
    aliases: Array.isArray(deployment.aliases)
      ? deployment.aliases.map(normalizeUrl).filter((alias): alias is string => alias !== null)
      : [],
    createdAt: typeof deployment.created_on === "string" ? deployment.created_on : new Date().toISOString(),
  };
}

function projectNameForSession(session: string, occupied: Set<string>): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = randomBytes(4).toString("hex");
    const prefix = `grill-visuals-${session}`.slice(0, 54).replace(/-+$/, "");
    const candidate = `${prefix}-${suffix}`;
    if (!occupied.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate a unique Cloudflare Pages project name");
}

function initialLedger(session: string): ShareLedger {
  return { version: 1, provider: "cloudflare-pages", session, shares: [] };
}

function validateLedger(value: unknown, session: string): ShareLedger {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.provider !== "cloudflare-pages" ||
    value.session !== session ||
    !Array.isArray(value.shares)
  ) {
    throw new Error("sharing.json is not a valid Grill Visuals Cloudflare ledger");
  }
  for (const share of value.shares) {
    if (
      !isRecord(share) ||
      share.ownership !== "session-project" ||
      typeof share.project !== "string" ||
      !PROJECT_PATTERN.test(share.project) ||
      !share.project.startsWith("grill-visuals-") ||
      share.branch !== "main" ||
      !isOwnedPagesUrl(share.project, share.stableUrl) ||
      !Array.isArray(share.deployments)
    ) {
      throw new Error("sharing.json contains an unsafe or invalid share record");
    }
  }
  return value as unknown as ShareLedger;
}

async function readLedger(path: string, session: string): Promise<ShareLedger> {
  try {
    return validateLedger(JSON.parse(await readFile(path, "utf8")), session);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return initialLedger(session);
    if (error instanceof SyntaxError) throw new Error("sharing.json contains invalid JSON");
    throw error;
  }
}

async function writeLedger(path: string, ledger: ShareLedger): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function activeShare(ledger: ShareLedger): ShareRecord | null {
  return [...ledger.shares].reverse().find((share) => !share.unsharedAt) ?? null;
}

function publicShare(share: ShareRecord | null): PublicShare | null {
  if (!share) return null;
  const latest = share.deployments.at(-1) ?? null;
  return {
    project: share.project,
    accountId: share.accountId ?? null,
    accountName: share.accountName ?? null,
    stableUrl: share.stableUrl,
    immutableUrl: latest?.url ?? null,
    deploymentId: latest?.id ?? null,
    snapshot: latest?.snapshot ?? null,
    updatedAt: share.updatedAt ?? share.createdAt,
  };
}

function safeAccounts(value: unknown): CloudflareAccount[] {
  const accounts = isRecord(value) && Array.isArray(value.accounts) ? value.accounts : [];
  return accounts
    .filter((account): account is JsonRecord => isRecord(account) && typeof account.id === "string" && typeof account.name === "string")
    .map((account) => ({ id: account.id as string, name: account.name as string }));
}

export async function getSharingState({ session, ledgerPath }: SessionLedgerOptions): Promise<{ activeShare: PublicShare | null }> {
  const ledger = await readLedger(ledgerPath, session);
  return { activeShare: publicShare(activeShare(ledger)) };
}

export async function cloudflarePreflight({ session, ledgerPath, profile, accountId }: PreflightOptions) {
  if (profile) {
    throw new Error("Activate the desired Wrangler auth profile first, then rerun without --profile so Grill Visuals can verify its account identity.");
  }
  const { stdout } = await runWrangler(["whoami", "--json"]);
  const identity = parseWranglerJson(stdout, "identity");
  if (!isRecord(identity) || identity.loggedIn !== true) throw new Error("Cloudflare login required. Run npx wrangler login, then retry.");
  const accounts = safeAccounts(identity);
  const { activeShare: share } = await getSharingState({ session, ledgerPath });
  const selectedAccountId = share?.accountId ?? accountId ?? (accounts.length === 1 ? accounts[0]?.id ?? null : null);
  const selected = accounts.find((account) => account.id === selectedAccountId) ?? null;
  let usage = null;
  if (selected) {
    const projects = await listProjects({ profile, accountId: selected.id });
    usage = {
      totalProjects: projects.length,
      grillVisualsProjects: projects.filter((project) => project.name.startsWith("grill-visuals-")).length,
      limit: 100,
      nearLimit: projects.length >= 90,
    };
  }
  return {
    authenticated: true as const,
    email: typeof identity.email === "string" ? identity.email : null,
    accounts,
    selectedAccountId,
    accountLocked: Boolean(share),
    usage,
    activeShare: share,
  };
}

export async function verifyActiveShare({ session, ledgerPath }: SessionLedgerOptions) {
  const { activeShare: share } = await getSharingState({ session, ledgerPath });
  if (!share?.stableUrl || !share?.immutableUrl) {
    throw new Error(`session ${session} has no deployment to verify`);
  }
  const [stableReady, immutableReady] = await Promise.all([
    verifySessionPresent(share.stableUrl, session),
    verifySessionPresent(share.immutableUrl, session),
  ]);
  return {
    ...share,
    stableUrl: share.stableUrl,
    immutableUrl: share.immutableUrl,
    state: stableReady && immutableReady ? "published" : "unverified",
    mayBePublic: !(stableReady && immutableReady),
  };
}

export async function exportSharingReceipt({ session, ledgerPath }: SessionLedgerOptions): Promise<SharingReceipt> {
  const { activeShare: share } = await getSharingState({ session, ledgerPath });
  if (!share) throw new Error(`session ${session} has no active public share`);
  return {
    version: 1,
    provider: "cloudflare-pages",
    session,
    project: share.project,
    accountId: share.accountId,
    accountName: share.accountName,
    stableUrl: share.stableUrl,
    immutableUrl: share.immutableUrl,
    deploymentId: share.deploymentId,
    updatedAt: share.updatedAt,
  };
}

function validateReceipt(receipt: unknown, session: string): SharingReceipt {
  if (
    !isRecord(receipt) ||
    receipt.version !== 1 ||
    receipt.provider !== "cloudflare-pages" ||
    receipt.session !== session ||
    typeof receipt.project !== "string" ||
    !PROJECT_PATTERN.test(receipt.project) ||
    !receipt.project.startsWith("grill-visuals-") ||
    typeof receipt.stableUrl !== "string" ||
    !isOwnedPagesUrl(receipt.project, receipt.stableUrl)
  ) {
    throw new Error("sharing receipt is invalid or belongs to another session");
  }
  return receipt as unknown as SharingReceipt;
}

export async function importSharingReceipt({ session, ledgerPath, receipt, profile }: ImportReceiptOptions) {
  const safeReceipt = validateReceipt(receipt, session);
  const preflight = await cloudflarePreflight({
    session,
    ledgerPath,
    profile,
    accountId: safeReceipt.accountId ?? undefined,
  });
  const account = preflight.accounts.find((item) => item.id === (safeReceipt.accountId ?? preflight.selectedAccountId));
  if (!account) throw new Error("the receipt's Cloudflare account is not available to this developer");
  const projects = await listProjects({ profile, accountId: account.id });
  if (!projects.some((project) => project.name === safeReceipt.project)) {
    throw new Error(`Pages project ${safeReceipt.project} is not available in ${account.name}`);
  }
  if (!(await verifySessionPresent(safeReceipt.stableUrl, session))) {
    throw new Error("the receipt URL does not contain the expected Grill Visuals session");
  }
  const ledger = await readLedger(ledgerPath, session);
  const existing = activeShare(ledger);
  if (existing && existing.project !== safeReceipt.project) {
    throw new Error(`session ${session} already owns public project ${existing.project}`);
  }
  if (!existing) {
    ledger.shares.push({
      ownership: "session-project",
      project: safeReceipt.project,
      branch: "main",
      accountId: account.id,
      accountName: account.name,
      stableUrl: normalizeUrl(safeReceipt.stableUrl) ?? safeReceipt.stableUrl,
      createdAt: safeReceipt.updatedAt ?? new Date().toISOString(),
      importedAt: new Date().toISOString(),
      deployments: [],
    });
    await writeLedger(ledgerPath, ledger);
  }
  return { project: safeReceipt.project, accountId: account.id, accountName: account.name, stableUrl: safeReceipt.stableUrl, verified: true, imported: true };
}

function linkToQuestion(url: string, question?: string | null): string {
  return question ? `${url}#${encodeURIComponent(question)}` : url;
}

export async function shareWithCloudflare({
  session,
  site,
  ledgerPath,
  question,
  profile,
  accountId,
  accountName,
  snapshot,
}: ShareOptions) {
  const options = { profile, accountId };
  const ledger = await readLedger(ledgerPath, session);
  const projects = await listProjects(options);
  let share = activeShare(ledger);

  if (share) {
    if (share.accountId && accountId && share.accountId !== accountId) {
      throw new Error(`this session is owned by Cloudflare account ${share.accountName ?? share.accountId}; unshare it before changing accounts`);
    }
    const activeProject = share.project;
    if (!projects.some((project) => project.name === activeProject)) {
      throw new Error(
        `recorded Pages project ${share.project} no longer exists; run unshare --session ${session} --yes before sharing again`,
      );
    }
    if (!share.accountId && accountId) {
      share.accountId = accountId;
      share.accountName = accountName ?? null;
      await writeLedger(ledgerPath, ledger);
    }
  } else {
    const project = projectNameForSession(session, new Set(projects.map((item) => item.name)));
    await runWrangler(
      ["pages", "project", "create", project, "--production-branch", "main"],
      options,
    );
    const createdProject = (await listProjects(options)).find((item) => item.name === project);
    share = {
      ownership: "session-project",
      project,
      branch: "main",
      accountId: accountId ?? null,
      accountName: accountName ?? null,
      stableUrl: stableUrlForProject(createdProject, project),
      createdAt: new Date().toISOString(),
      deployments: [],
    };
    ledger.shares.push(share);
    await writeLedger(ledgerPath, ledger);
  }

  const beforeDeployments = await listDeployments(share.project, options);
  const recordedIds = new Set(share.deployments.map((item) => item.id));
  for (const deployment of beforeDeployments) {
    if (typeof deployment.id !== "string" || !recordedIds.has(deployment.id)) {
      share.deployments.push(deploymentRecord(deployment, normalizeUrl(deployment.url)));
    }
  }
  if (share.deployments.length > recordedIds.size) await writeLedger(ledgerPath, ledger);
  const beforeIds = new Set(beforeDeployments.map((item) => item.id));
  const { stdout } = await runWrangler(
    [
      "pages",
      "deploy",
      site,
      "--project-name",
      share.project,
      "--branch",
      share.branch,
      "--commit-message",
      `Share Grill Visuals session ${session}`,
      "--commit-dirty=true",
    ],
    options,
  );
  const deployedUrl = cleanOutput(stdout).match(/https:\/\/[^\s]+\.pages\.dev/)?.[0] ?? null;
  const deployments = await listDeployments(share.project, options);
  const deployed =
    deployments.find((item) => !beforeIds.has(item.id)) ??
    deployments.find((item) => normalizeUrl(item.url) === normalizeUrl(deployedUrl));
  if (!deployed) throw new Error("Cloudflare deployed the site but its immutable deployment record was not found");

  const record = deploymentRecord(deployed, normalizeUrl(deployedUrl));
  record.snapshot = snapshot ?? null;
  share.deployments.push(record);
  share.updatedAt = new Date().toISOString();
  await writeLedger(ledgerPath, ledger);

  const result = {
    project: share.project,
    stableUrl: linkToQuestion(share.stableUrl, question),
    immutableUrl: linkToQuestion(record.url, question),
    deploymentId: record.id,
    ledgerPath,
  };
  const [stableReady, immutableReady] = await Promise.all([
    verifySessionPresent(share.stableUrl, session),
    verifySessionPresent(record.url, session),
  ]);
  return {
    ...result,
    state: stableReady && immutableReady ? "published" : "unverified",
    mayBePublic: !(stableReady && immutableReady),
  };
}

export async function verifySessionPresent(
  url: string,
  session: string,
  { attempts = 6 }: { attempts?: number } = {},
): Promise<boolean> {
  const marker = `<meta name="grill-visuals-session" content="${session}">`;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "cache-control": "no-cache" }, redirect: "follow" });
      if (response.ok && (await response.text()).includes(marker)) return true;
    } catch {}
    if (attempt + 1 < attempts) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(4000, 500 * (attempt + 1))));
    }
  }
  return false;
}

async function verifySessionGone(url: string, session: string): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await verifySessionPresent(url, session, { attempts: 1 }))) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750 * (attempt + 1)));
  }
  return false;
}

export async function unshareFromCloudflare({ session, ledgerPath, profile }: UnshareOptions) {
  const ledger = await readLedger(ledgerPath, session);
  const share = activeShare(ledger);
  if (!share) throw new Error(`session ${session} has no active public share`);
  const options = { profile, accountId: share.accountId };

  const projects = await listProjects(options);
  if (projects.some((project) => project.name === share.project)) {
    await runWrangler(["pages", "project", "delete", share.project, "--yes"], options);
  }
  const remainingProjects = await listProjects(options);
  if (remainingProjects.some((project) => project.name === share.project)) {
    throw new Error(`Cloudflare still reports Pages project ${share.project}; public content may remain`);
  }
  if (!(await verifySessionGone(share.stableUrl, session))) {
    throw new Error(`Cloudflare removed ${share.project}, but ${share.stableUrl} still exposes this session`);
  }

  share.unsharedAt = new Date().toISOString();
  share.unshareVerifiedAt = share.unsharedAt;
  await writeLedger(ledgerPath, ledger);
  return { project: share.project, stableUrl: share.stableUrl, verified: true, ledgerPath };
}
