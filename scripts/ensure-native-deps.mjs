/**
 * Detect Windows↔WSL/Linux native dependency skew (esbuild, rollup) and
 * reinstall when the current platform does not match what node_modules has.
 *
 * Stamp: `.local/node-platform` (gitignored via `.local/`).
 * Skip with SKIP_NATIVE_ENSURE=1.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot, scriptsDir } from "./repo-env.mjs";

export function currentPlatformId() {
  return `${process.platform}-${process.arch}`;
}

/** esbuild optional package name for this Node process. */
export function expectedEsbuildPackage() {
  return `@esbuild/${process.platform}-${process.arch}`;
}

function stampPath(repoRoot) {
  return path.join(repoRoot, ".local", "node-platform");
}

function readStamp(repoRoot) {
  const file = stampPath(repoRoot);
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function writeStamp(repoRoot, id) {
  const dir = path.join(repoRoot, ".local");
  mkdirSync(dir, { recursive: true });
  writeFileSync(stampPath(repoRoot), `${id}\n`, "utf8");
}

/** pnpm stores optionals as `node_modules/.pnpm/@esbuild+win32-x64@version`. */
export function pnpmHasEsbuildFor(repoRoot, platformId = currentPlatformId()) {
  const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) return false;
  const prefix = `@esbuild+${platformId}@`;
  try {
    return readdirSync(pnpmDir).some((name) => name.startsWith(prefix));
  } catch {
    return false;
  }
}

/**
 * True when node_modules looks wrong for this OS (typical after Windows→WSL).
 */
export function needsNativeReinstall(repoRoot = findRepoRoot()) {
  if (process.env.SKIP_NATIVE_ENSURE === "1") return false;

  const current = currentPlatformId();
  const stamp = readStamp(repoRoot);
  const hasBinary = pnpmHasEsbuildFor(repoRoot, current);

  if (!existsSync(path.join(repoRoot, "node_modules"))) return true;
  if (stamp && stamp !== current) return true;
  if (!hasBinary) return true;

  return false;
}

export function reinstallNativeDeps(repoRoot = findRepoRoot(), env = process.env) {
  console.warn(
    `[ensure-native-deps] node_modules looks built for another OS ` +
      `(need ${currentPlatformId()} / ${expectedEsbuildPackage()}). ` +
      `Running pnpm install --force…`,
  );
  const result = spawnSync("pnpm", ["install", "--force"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `pnpm install --force failed with exit ${result.status ?? "unknown"}`,
    );
  }
  writeStamp(repoRoot, currentPlatformId());
  console.warn("[ensure-native-deps] reinstall finished — retrying.");
}

/**
 * @returns {boolean} true if a reinstall ran
 */
export function ensureNativeDeps(options = {}) {
  const repoRoot = options.repoRoot ?? findRepoRoot(scriptsDir());
  const env = options.env ?? process.env;
  if (!needsNativeReinstall(repoRoot)) {
    writeStamp(repoRoot, currentPlatformId());
    return false;
  }
  reinstallNativeDeps(repoRoot, env);
  return true;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    ensureNativeDeps();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
