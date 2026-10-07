import { type Project } from "./db";
import { getLastCommitTimestamp } from "./git";

export type ActivityLevel = "fresh" | "recent" | "stale";

export interface ProjectWithActivity extends Project {
  activityDate: string; // ISO date used for sorting
  activityLabel: string; // human-readable teaser for the card
  activityLevel: ActivityLevel; // traffic-light colour for the card footer
  commitSubject: string | null;
}

/**
 * Attaches a sortable "last activity" to each project:
 * - in_progress + valid local_path → latest git commit date/subject
 * - otherwise → falls back to updated_at
 *
 * This only reads the HEAD commit per repo (fast) — full log is fetched
 * on demand when a detail modal opens, per §3.7.
 */
export function withActivity(projects: Project[]): ProjectWithActivity[] {
  const enriched = projects.map((p) => {
    let activityDate = p.updated_at;
    let commitSubject: string | null = null;

    if (p.status === "in_progress" && p.local_path) {
      const commit = getLastCommitTimestamp(p.local_path);
      if (commit) {
        activityDate = commit.date;
        commitSubject = commit.subject;
      }
    }

    const activityLabel =
      p.status === "in_progress" && commitSubject
        ? `${timeAgoShort(activityDate)} — "${truncate(commitSubject, 48)}"`
        : p.status === "in_progress"
          ? `Updated ${timeAgoShort(activityDate)} (no git data)`
          : `Updated ${timeAgoShort(activityDate)}`;

    return { ...p, activityDate, activityLabel, activityLevel: activityLevel(activityDate), commitSubject };
  });

  return enriched.sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime());
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function daysAgo(iso: string): number {
  return Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Uses the same whole-day count as the label, so "5d ago" is always fresh and "6d ago" recent. */
function activityLevel(iso: string): ActivityLevel {
  const days = daysAgo(iso);
  if (days <= 5) return "fresh";
  if (days <= 10) return "recent";
  return "stale";
}

function timeAgoShort(iso: string): string {
  const days = daysAgo(iso);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
