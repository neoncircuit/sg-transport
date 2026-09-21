/**
 * Load repo-root `.env` into the environment, then spawn the remaining argv.
 * Ensures `NODE_EXTRA_CA_CERTS` is visible before Node initializes TLS.
 *
 * Usage: node scripts/with-repo-env.mjs tsx watch src/index.ts
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function findRepoRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

function loadEnvFile(file, env) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined || env[key] === "") env[key] = value;
  }
}

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
const env = { ...process.env };
loadEnvFile(path.join(repoRoot, ".env"), env);

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error("usage: node scripts/with-repo-env.mjs <command> [args…]");
  process.exit(1);
}

const child = spawn(argv[0], argv.slice(1), {
  env,
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
