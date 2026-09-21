/**
 * `pnpm dev` entry: fix env paths, heal native deps after Windows↔WSL switches,
 * then start turbo. Retries once if turbo/tsx still die on a platform mismatch.
 */
import { spawn } from "node:child_process";
import { ensureNativeDeps } from "./ensure-native-deps.mjs";
import { findRepoRoot, prepareEnv, scriptsDir } from "./repo-env.mjs";

const repoRoot = findRepoRoot(scriptsDir());
const env = prepareEnv(repoRoot);

function runTurbo() {
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", "turbo", "run", "dev"], {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code, signal) => {
      resolve({ code: code ?? 1, signal });
    });
  });
}

function looksLikeNativeSkew(code) {
  // turbo surfaces package failures as non-zero; we always retry once after ensure.
  return code !== 0;
}

try {
  ensureNativeDeps({ repoRoot, env });
} catch (err) {
  console.error(
    "[dev]",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}

const first = await runTurbo();
if (first.signal) {
  process.kill(process.pid, first.signal);
}
if (first.code === 0) process.exit(0);

if (
  process.env.SKIP_NATIVE_ENSURE !== "1" &&
  looksLikeNativeSkew(first.code)
) {
  console.warn(
    "[dev] stack failed — forcing native dependency heal and retrying once…",
  );
  try {
    // Force path even if stamp looked fine (partial / corrupted installs).
    const { reinstallNativeDeps } = await import("./ensure-native-deps.mjs");
    reinstallNativeDeps(repoRoot, env);
  } catch (err) {
    console.error(
      "[dev]",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }
  const second = await runTurbo();
  if (second.signal) process.kill(process.pid, second.signal);
  process.exit(second.code ?? 1);
}

process.exit(first.code ?? 1);
