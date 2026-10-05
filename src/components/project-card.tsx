"use client";

import { Link, FolderGit2 } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { ProjectWithActivity } from "@/lib/activity";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function ProjectCard({
  project,
  onClick,
}: {
  project: ProjectWithActivity;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-[var(--radius-card)] border border-border bg-surface overflow-hidden transition-all hover:border-accent-progress/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30"
    >
      <div className="h-36 w-full overflow-hidden bg-gradient-to-br from-surface-hover to-bg flex items-center justify-center">
        {project.image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/${project.image_path}`}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <span className="font-display text-3xl text-text-muted/60">{initials(project.name)}</span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-medium text-text leading-snug">{project.name}</h3>
          <StatusBadge status={project.status} />
        </div>

        {project.description && (
          <p className="text-sm text-text-muted line-clamp-2 mb-3">{project.description}</p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-activity font-display truncate">{project.activityLabel}</span>
          <span className="flex items-center gap-1.5 text-text-muted shrink-0">
            {project.repo_url && <Link size={14} aria-label="Has repo link" />}
            {project.local_path && <FolderGit2 size={14} aria-label="Has local path" />}
          </span>
        </div>
      </div>
    </button>
  );
}
