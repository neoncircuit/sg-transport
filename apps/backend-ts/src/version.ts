import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function findRepoRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** Prefer `APP_VERSION`, else `git describe` (phase tags in tasks/TODO.md). */
export function resolveAppVersion(): string {
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  try {
    return git("describe --tags --always --dirty", findRepoRoot());
  } catch {
    return "0.0.0-dev";
  }
}

export function resolveGitSha(): string {
  const fromEnv = process.env.GIT_SHA?.trim();
  if (fromEnv) return fromEnv;
  try {
    return git("rev-parse --short HEAD", findRepoRoot());
  } catch {
    return "unknown";
  }
}
