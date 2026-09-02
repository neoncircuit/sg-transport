import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Walk up until `pnpm-workspace.yaml` is found. */
export function findRepoRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

function git(args, cwd) {
  return execSync(`git ${args}`, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/**
 * App version for UI / health / Docker.
 * Prefer `APP_VERSION` (CI/images), else `git describe --tags --always --dirty`
 * against phase tags from tasks/TODO.md (`v0.0.1`, `v0.1.0`, …).
 */
export function resolveAppVersion(cwd = findRepoRoot()) {
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  try {
    return git("describe --tags --always --dirty", cwd);
  } catch {
    return "0.0.0-dev";
  }
}

export function resolveGitSha(cwd = findRepoRoot()) {
  const fromEnv = process.env.GIT_SHA?.trim();
  if (fromEnv) return fromEnv;
  try {
    return git("rev-parse --short HEAD", cwd);
  } catch {
    return "unknown";
  }
}

/** Compact badge: `v0.1.0` or `v0.1.0+7` (commits since tag). */
export function formatVersionBadge(describe) {
  const dirty = describe.endsWith("-dirty") ? "-dirty" : "";
  const base = dirty ? describe.slice(0, -"-dirty".length) : describe;
  const m = base.match(/^v?(\d+\.\d+\.\d+)(?:-(\d+)-g[0-9a-f]+)?$/i);
  if (!m) return describe;
  const [, semver, n] = m;
  if (!n) return `v${semver}${dirty}`;
  return `v${semver}+${n}${dirty}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = resolveAppVersion();
  const sha = resolveGitSha();
  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify({
        version,
        sha,
        badge: formatVersionBadge(version),
      }),
    );
  } else {
    console.log(version);
  }
}
