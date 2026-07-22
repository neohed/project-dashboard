"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Copy, Loader2, Trash2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Input, Textarea, Select, Label } from "./ui/field";
import { StatusBadge } from "./status-badge";
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  fetchRecentCommitsAction,
  checkLocalPathAction,
} from "@/app/actions/projects";
import type { ProjectWithActivity } from "@/lib/activity";
import type { ProjectStatus } from "@/lib/db";
import type { Commit } from "@/lib/git";
import { formatCommitDate } from "@/lib/utils";

type Mode = "create" | "view" | "edit";

export function ProjectDialog({
  project,
  onClose,
}: {
  /** null → create mode. */
  project: ProjectWithActivity | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(project ? "view" : "create");
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(
    project?.image_path ? `/${project.image_path}` : null
  );
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "idea");
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (mode === "view" && project?.status === "in_progress" && project.local_path) {
      loadCommits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, project?.id]);

  function loadCommits() {
    if (!project) return;
    setCommitsLoading(true);
    setCommitsError(null);
    fetchRecentCommitsAction(project.id).then((res) => {
      setCommitsLoading(false);
      if (res.ok) setCommits(res.commits);
      else setCommitsError(res.error ?? "Could not load commits.");
    });
  }

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    // A click that lands on the <dialog> element itself (not bubbled up from
    // the content div inside it) means it hit the backdrop area.
    if (e.target === dialogRef.current) {
      close();
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result =
        mode === "edit" && project
          ? await updateProjectAction(project.id, formData)
          : await createProjectAction(formData);

      if (result.ok) {
        toast.success(mode === "edit" ? "Project updated" : "Project created");
        router.refresh();
        close();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  function handleDelete() {
    if (!project) return;
    startTransition(async () => {
      const result = await deleteProjectAction(project.id);
      if (result.ok) {
        toast.success("Project deleted");
        router.refresh();
        close();
      } else {
        toast.error(result.error ?? "Could not delete project");
      }
    });
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  async function handleLocalPathBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.target.value.trim();
    if (!val) return;
    const res = await checkLocalPathAction(val);
    if (res.isRepo && status !== "in_progress") {
      setStatus("in_progress");
      toast.info("That looks like a git repo — status set to In Progress (change it below if that's not right).");
    }
  }

  const isFormMode = mode === "create" || mode === "edit";

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      onClick={handleBackdropClick}
      className="backdrop:bg-black/60 bg-transparent p-0 m-auto max-w-2xl w-[90vw] rounded-[var(--radius-card)]"
    >
      <div className="bg-surface border border-border rounded-[var(--radius-card)] max-h-[85vh] overflow-y-auto">
        {isFormMode ? (
          <form ref={formRef} onSubmit={handleSubmit} className="p-5 space-y-4">
            <h2 className="font-display text-sm uppercase tracking-wide text-text-muted">
              {mode === "edit" ? "Edit project" : "New project"}
            </h2>

            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={project?.name} autoFocus />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={project?.description ?? ""} />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                <option value="idea">Idea</option>
                <option value="in_progress">In Progress</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="repo_url">Repo URL</Label>
              <Input
                id="repo_url"
                name="repo_url"
                type="url"
                placeholder="https://github.com/you/project"
                defaultValue={project?.repo_url ?? ""}
              />
            </div>

            <div>
              <Label htmlFor="local_path">Local path</Label>
              <Input
                id="local_path"
                name="local_path"
                placeholder="/home/you/workspace/project"
                defaultValue={project?.local_path ?? ""}
                onBlur={handleLocalPathBlur}
                className="font-mono"
              />
            </div>

            <div>
              <Label htmlFor="image">Cover image</Label>
              <input
                id="image"
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setImagePreview(URL.createObjectURL(file));
                }}
                className="w-full text-sm text-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-text file:text-sm"
              />
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="" className="mt-2 h-20 w-full object-cover rounded-md border border-border" />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => (mode === "edit" ? setMode("view") : close())}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 size={14} className="animate-spin" />}
                {mode === "edit" ? "Save changes" : "Create project"}
              </Button>
            </div>
          </form>
        ) : project ? (
          <div className="p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-text">{project.name}</h2>
                <div className="mt-1.5">
                  <StatusBadge status={project.status} />
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button variant="ghost" onClick={() => setMode("edit")} aria-label="Edit">
                  <Pencil size={15} />
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(true)} aria-label="Delete">
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>

            {project.description && <p className="text-sm text-text-muted whitespace-pre-wrap">{project.description}</p>}

            <div className="space-y-2.5">
              {project.repo_url && (
                <div className="flex items-center gap-2 text-sm">
                  <a
                    href={project.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-accent-progress hover:underline truncate"
                  >
                    <ExternalLink size={13} /> {project.repo_url}
                  </a>
                  <Button variant="ghost" className="p-1.5" onClick={() => copy(project.repo_url!, "Repo URL")}>
                    <Copy size={13} />
                  </Button>
                </div>
              )}

              {project.local_path && (
                <div className="flex items-center gap-2 text-sm">
                  <code className="font-mono text-text-muted truncate flex-1">{project.local_path}</code>
                  <Button variant="ghost" className="p-1.5" onClick={() => copy(project.local_path!, "Path")}>
                    <Copy size={13} />
                  </Button>
                  <Button
                    variant="secondary"
                    className="text-xs px-2 py-1"
                    onClick={() => copy(`cd "${project.local_path}" && code .`, "Command")}
                  >
                    Copy `code .` cmd
                  </Button>
                </div>
              )}
            </div>

            {project.status === "in_progress" && project.local_path && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display text-xs uppercase tracking-wide text-text-muted">Recent commits</h3>
                  <Button variant="ghost" className="p-1.5" onClick={loadCommits} aria-label="Refresh commits">
                    <RefreshCw size={13} className={commitsLoading ? "animate-spin" : ""} />
                  </Button>
                </div>

                {commitsLoading && <p className="text-sm text-text-muted">Loading…</p>}
                {commitsError && <p className="text-sm text-danger">{commitsError}</p>}
                {commits && commits.length === 0 && !commitsLoading && (
                  <p className="text-sm text-text-muted">No commits found.</p>
                )}
                {commits && commits.length > 0 && (
                  <ul className="divide-y divide-border/60">
                    {commits.map((c) => (
                      <li key={c.hash} className="py-2 first:pt-0 last:pb-0">
                        <p className="text-sm text-text">{c.subject}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono text-xs text-text-muted">{c.hash}</span>
                          <span className="text-xs text-text-muted">{formatCommitDate(c.date)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {confirmingDelete && (
              <div className="rounded-md border border-danger/30 bg-danger/10 p-3 space-y-2">
                <p className="text-sm text-text">Delete "{project.name}" permanently?</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={handleDelete} disabled={pending}>
                    {pending && <Loader2 size={14} className="animate-spin" />}
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
