import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
});

type JsonObject = Record<string, unknown>;

export interface ShareRequest {
  question: string | null;
  accountId: string | null;
  reviewedWarnings: boolean;
}

export interface LocalSessionServerOptions {
  site: string;
  session: string;
  describe: () => Promise<JsonObject>;
  publish: (request: ShareRequest) => Promise<JsonObject & { state?: string }>;
  verify: () => Promise<JsonObject>;
  unshare: () => Promise<JsonObject>;
  port?: number;
  host?: string;
}

export interface LocalSessionServer {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function tokenMatches(received: string | string[] | undefined, expected: string): boolean {
  if (typeof received !== "string") return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > 4096) throw new Error("request body is too large");
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("request body must be valid JSON");
  }
}

export async function serveLocalSession({
  site,
  session,
  describe,
  publish,
  verify,
  unshare,
  port = 8788,
  host = "127.0.0.1",
}: LocalSessionServerOptions): Promise<LocalSessionServer> {
  const siteRoot = resolve(site);
  const csrfToken = randomBytes(24).toString("base64url");
  let allowedOrigins = new Set<string>();
  let operating = false;

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && requestUrl.pathname === "/__grill-visuals/capabilities") {
        sendJson(response, 200, { canPublish: true, csrfToken, session, ...(await describe()) });
        return;
      }
      if (request.method === "POST" && requestUrl.pathname.startsWith("/__grill-visuals/")) {
        if (!allowedOrigins.has(request.headers.origin ?? "")) {
          sendJson(response, 403, { error: "request origin was rejected" });
          return;
        }
        if (!tokenMatches(request.headers["x-grill-visuals-token"], csrfToken)) {
          sendJson(response, 403, { error: "request token was rejected" });
          return;
        }
        if (operating) {
          sendJson(response, 409, { error: "a public-share operation is already in progress" });
          return;
        }
        operating = true;
        try {
          if (requestUrl.pathname === "/__grill-visuals/share") {
            const body = await readJsonBody(request);
            const description = await describe();
            const questions = Array.isArray(description.questions) ? description.questions : [];
            const allowedQuestions = new Set(questions.flatMap((question) => {
              if (typeof question === "string") return [question];
              if (question && typeof question === "object" && "id" in question && typeof question.id === "string") {
                return [question.id];
              }
              return [];
            }));
            const question = typeof body.question === "string" ? body.question : null;
            if (question && !allowedQuestions.has(question)) {
              sendJson(response, 400, { error: "question is not part of this session" });
              return;
            }
            const result = await publish({
              question,
              accountId: typeof body.accountId === "string" ? body.accountId : null,
              reviewedWarnings: body.reviewedWarnings === true,
            });
            sendJson(response, result.state === "unverified" ? 202 : 200, result);
            return;
          }
          if (requestUrl.pathname === "/__grill-visuals/verify") {
            sendJson(response, 200, await verify());
            return;
          }
          if (requestUrl.pathname === "/__grill-visuals/unshare") {
            sendJson(response, 200, await unshare());
            return;
          }
          sendJson(response, 404, { error: "unknown local operation" });
        } finally {
          operating = false;
        }
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD, POST" });
        response.end();
        return;
      }

      const decodedPath = decodeURIComponent(requestUrl.pathname);
      const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
      const filePath = resolve(siteRoot, relativePath);
      if (filePath !== siteRoot && !filePath.startsWith(`${siteRoot}${sep}`)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw Object.assign(new Error("not found"), { code: "ENOENT" });
      const contents = await readFile(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      if (request.url?.startsWith("/__grill-visuals/")) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : "public share failed" });
        return;
      }
      response.writeHead(500);
      response.end("Local preview failed");
    }
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, host, () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  allowedOrigins = new Set([
    `http://${host}:${actualPort}`,
    `http://localhost:${actualPort}`,
  ]);
  return {
    server,
    url: `http://${host}:${actualPort}`,
    close: () => new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error) => error ? rejectPromise(error) : resolvePromise());
    }),
  };
}
