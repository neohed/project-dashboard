import { ProjectCard } from "./project-card";
import type { ProjectWithActivity } from "@/lib/activity";

export function ProjectColumn({
  title,
  emptyHint,
  projects,
  onSelect,
}: {
  title: string;
  emptyHint: string;
  projects: ProjectWithActivity[];
  onSelect: (p: ProjectWithActivity) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-xs uppercase tracking-widest text-text-muted mb-4">
        # {title} <span className="text-text-muted/50">({projects.length})</span>
      </h2>

      {projects.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border p-8 text-center text-sm text-text-muted">
          {emptyHint}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => onSelect(p)} />
          ))}
        </div>
      )}
    </div>
  );
}
