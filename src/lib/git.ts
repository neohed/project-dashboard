import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export interface Commit {
  hash: string;
  date: string;
  author: string;
  subject: string;
}

export class GitAccessError extends Error {}

/**
 * ALLOWED_BASE_PATHS is a colon-separated list of directory prefixes that
 * local_path is allowed to resolve into. Configure it in .env for your
 * machine (see .env.example). Defaults to common home directories so the
 * app works out of the box in native (non-Docker) dev.
 */
function getAllowedBasePaths(): string[] {
  const raw = process.env.ALLOWED_BASE_PATHS;
  if (raw && raw.trim().length > 0) {
    return raw.split(":").map((p) => p.trim()).filter(Boolean);
  }
  return ["/home", "/Users"];
}

function assertAllowedPath(localPath: string): string {
  const resolved = path.resolve(localPath);
  const allowed = getAllowedBasePaths();
  const ok = allowed.some((base) => resolved === base || resolved.startsWith(base.endsWith("/") ? base : base + "/"));
  if (!ok) {
    throw new GitAccessError(`Path "${resolved}" is outside the allowed directories (${allowed.join(", ")}).`);
  }
  if (!fs.existsSync(resolved)) {
    throw new GitAccessError(`Path "${resolved}" does not exist.`);
  }
  if (!fs.existsSync(path.join(resolved, ".git"))) {
    throw new GitAccessError(`"${resolved}" is not a git repository.`);
  }
  return resolved;
}

/** Non-throwing check used to auto-suggest status="in_progress" when a local_path is entered. */
export function isGitRepo(localPath: string): boolean {
  try {
    assertAllowedPath(localPath);
    return true;
  } catch {
    return false;
  }
}

/** Lightweight check used on dashboard list load — timestamp of HEAD only. */
export function getLastCommitTimestamp(localPath: string): { date: string; subject: string } | null {
  try {
    const resolved = assertAllowedPath(localPath);
    const out = execFileSync(
      "git",
      ["-C", resolved, "log", "-1", "--pretty=format:%aI|%s", "--no-merges"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    if (!out) return null;
    const [date, ...rest] = out.split("|");
    return { date, subject: rest.join("|") };
  } catch {
    // Missing git binary, invalid path, no commits yet, etc. — caller falls back to updated_at.
    return null;
  }
}

/** Full recent history — fetched on demand when the detail modal opens. */
export function getRecentCommits(localPath: string, limit = 10): Commit[] {
  const resolved = assertAllowedPath(localPath);
  const out = execFileSync(
    "git",
    ["-C", resolved, "log", `-${limit}`, "--pretty=format:%h|%aI|%an|%s", "--no-merges"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  ).trim();
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [hash, date, author, ...subjectParts] = line.split("|");
    return { hash, date, author, subject: subjectParts.join("|") };
  });
}
