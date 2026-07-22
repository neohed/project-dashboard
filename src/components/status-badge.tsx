import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/db";

const config: Record<ProjectStatus, { label: string; className: string }> = {
  idea: { label: "idea", className: "bg-accent-idea-dim text-accent-idea" },
  in_progress: { label: "in progress", className: "bg-accent-progress-dim text-accent-progress" },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const c = config[status];
  return (
    <span className={cn("font-display rounded px-2 py-0.5 text-[11px] tracking-wide", c.className)}>{c.label}</span>
  );
}
