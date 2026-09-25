/**
 * Shared repo-root discovery, `.env` loading, and path fixes for WSL ↔ Windows.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function findRepoRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

export function scriptsDir() {
  return path.dirname(fileURLToPath(import.meta.url));
}

export function loadEnvFile(file, env) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t
      .slice(0, i)
      .trim()
      .replace(/^\uFEFF/, "");
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

/** `D:\foo` / `D:/foo` → `/mnt/d/foo` when running under WSL/Linux. */
export function windowsPathToWsl(p) {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p.replace(/\\/g, "/"));
  if (!m) return p;
  return `/mnt/${m[1].toLowerCase()}/${m[2]}`;
}

/**
 * Resolve NODE_EXTRA_CA_CERTS so it exists on the current OS.
 * Prefers repo-relative `.local/corp-ca.pem` when present.
 */
export function normalizeExtraCaCerts(env, repoRoot = findRepoRoot()) {
  const preferred = path.join(repoRoot, ".local", "corp-ca.pem");
  const raw = env.NODE_EXTRA_CA_CERTS?.trim();

  const candidates = [];
  if (raw) {
    candidates.push(raw);
    if (process.platform === "linux" && /^[A-Za-z]:[\\/]/.test(raw)) {
      candidates.push(windowsPathToWsl(raw));
    }
    if (!path.isAbsolute(raw)) {
      candidates.push(path.resolve(repoRoot, raw));
    }
  }
  candidates.push(preferred);

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      env.NODE_EXTRA_CA_CERTS = candidate;
      return candidate;
    }
  }

  // Drop a broken absolute path so Node does not warn on every process.
  if (raw && !existsSync(raw)) {
    delete env.NODE_EXTRA_CA_CERTS;
  }
  return null;
}

/** Load `.env` + normalize CA path into a fresh env object. */
export function prepareEnv(repoRoot = findRepoRoot()) {
  const env = { ...process.env };
  loadEnvFile(path.join(repoRoot, ".env"), env);
  normalizeExtraCaCerts(env, repoRoot);
  return env;
}
