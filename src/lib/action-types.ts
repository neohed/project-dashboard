import type { Commit } from "./git";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CommitsResult {
  ok: boolean;
  commits: Commit[];
  error?: string;
}
