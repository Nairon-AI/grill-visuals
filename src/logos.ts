import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { ArchitectureNode, DiagramDocument, ProductProject } from "./types.js";

const MAX_LOGO_BYTES = 1_000_000;
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
});

export function normalizeLogoDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

export function googleFaviconUrl(domain: string): string {
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(normalizeLogoDomain(domain))}&size=256`;
}

export function logoKeyForProject(project: ProductProject): string | null {
  if (project?.iconDomain) return `domain:${normalizeLogoDomain(project.iconDomain)}`;
  if (project?.iconPath) return `path:${project.iconPath}`;
  return null;
}

export function logoKeyForNode(project: ProductProject, node: ArchitectureNode): string | null {
  return node?.domain
    ? `domain:${normalizeLogoDomain(node.domain)}`
    : logoKeyForProject(project);
}

function dataUrl(contentType: string, bytes: Uint8Array): string {
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function assertSafeSvg(bytes: Uint8Array, label: string): void {
  const source = Buffer.from(bytes).toString("utf8");
  if (!/<svg[\s>]/i.test(source)) throw new Error(`${label} is not an SVG`);
  if (/<script|<foreignObject|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(source)) {
    throw new Error(`${label} contains active or remote SVG content`);
  }
}

async function resolvePathLogo(iconPath: string, baseDirectory: string): Promise<string> {
  const root = resolve(baseDirectory);
  const absolute = resolve(root, iconPath);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error(`${iconPath} escapes the render directory`);
  }
  const contentType = MIME_BY_EXTENSION[extname(absolute).toLowerCase()];
  if (!contentType) throw new Error(`${iconPath} has an unsupported image type`);
  const bytes = await readFile(absolute);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) {
    throw new Error(`${iconPath} must be between 1 byte and ${MAX_LOGO_BYTES} bytes`);
  }
  if (contentType === "image/svg+xml") assertSafeSvg(bytes, iconPath);
  return dataUrl(contentType, bytes);
}

async function resolveDomainLogo(domain: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(googleFaviconUrl(domain), {
    headers: { "user-agent": "grill-visuals/0.0.0" },
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) throw new Error(`favicon service returned ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (!contentType?.startsWith("image/")) throw new Error("favicon service did not return an image");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) {
    throw new Error(`favicon must be between 1 byte and ${MAX_LOGO_BYTES} bytes`);
  }
  return dataUrl(contentType, bytes);
}

export async function resolveLogoSources(
  documents: DiagramDocument[],
  { baseDirectory = process.cwd(), fetchImpl = globalThis.fetch }: {
    baseDirectory?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{ sources: Map<string, string>; warnings: string[] }> {
  const requests = new Map<string, { iconDomain?: string; iconPath?: string }>();
  for (const document of documents) {
    if (document.family !== "architecture") continue;
    const projectKey = logoKeyForProject(document.data.project);
    if (projectKey) requests.set(projectKey, document.data.project);
    for (const node of document.data.nodes) {
      if (!node.domain) continue;
      requests.set(`domain:${normalizeLogoDomain(node.domain)}`, { iconDomain: node.domain });
    }
  }

  const sources = new Map<string, string>();
  const warnings: string[] = [];
  await Promise.all([...requests].map(async ([key, request]) => {
    try {
      const source = request.iconDomain
        ? await resolveDomainLogo(request.iconDomain, fetchImpl)
        : await resolvePathLogo(request.iconPath ?? "", baseDirectory);
      sources.set(key, source);
    } catch (error) {
      warnings.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  warnings.sort();
  return { sources, warnings };
}
