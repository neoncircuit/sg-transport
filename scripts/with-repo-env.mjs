/**
 * Load repo-root `.env` into the environment, then spawn the remaining argv.
 * Ensures `NODE_EXTRA_CA_CERTS` is visible before Node initializes TLS, and
 * remaps Windows paths when running under WSL.
 *
 * Usage: node scripts/with-repo-env.mjs tsx watch src/index.ts
 */
import { spawn } from "node:child_process";
import { findRepoRoot, prepareEnv, scriptsDir } from "./repo-env.mjs";

const repoRoot = findRepoRoot(scriptsDir());
const env = prepareEnv(repoRoot);

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error("usage: node scripts/with-repo-env.mjs <command> [args…]");
  process.exit(1);
}

// `shell: true` on Linux often leaves `tsx watch` without a running child.
// Only use a shell on Windows (where .cmd shims need it).
const child = spawn(argv[0], argv.slice(1), {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
  cwd: process.cwd(),
});

child.on("error", (err) => {
  console.error(`[with-repo-env] failed to start ${argv[0]}:`, err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
