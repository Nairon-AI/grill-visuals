import { spawn } from "node:child_process";
import { chmod, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

function runTypeScript(project: string): Promise<void> {
  const tsc = resolve(dirname(require.resolve("typescript")), "tsc.js");
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, [tsc, "--project", project], {
      cwd: root,
      stdio: "inherit",
    });
    child.once("error", rejectBuild);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`TypeScript build failed (${signal ?? code ?? "unknown"})`));
    });
  });
}

await runTypeScript("tsconfig.browser.json");
await rm(dist, { recursive: true, force: true });
await runTypeScript("tsconfig.build.json");
await build({
  entryPoints: [resolve(root, "src/browser/viewer.ts")],
  outfile: resolve(dist, "browser/viewer.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  minify: false,
  legalComments: "none",
});
await chmod(resolve(dist, "bin/grill-visuals.js"), 0o755);
