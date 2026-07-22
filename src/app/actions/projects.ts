"use server";

import { revalidatePath } from "next/cache";
import {
  createProject as dbCreateProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  getProject,
  type ProjectStatus,
} from "@/lib/db";
import { projectFormSchema } from "@/lib/schema";
import { saveProjectImage, clearProjectImage, ImageValidationError } from "@/lib/images";
import { getRecentCommits, GitAccessError, isGitRepo } from "@/lib/git";
import type { ActionResult, CommitsResult } from "@/lib/action-types";

function parseForm(formData: FormData) {
  return projectFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    status: formData.get("status"),
    repo_url: formData.get("repo_url") ?? "",
    local_path: formData.get("local_path") ?? "",
  });
}

export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const project = dbCreateProject({
    name: parsed.data.name,
    description: parsed.data.description || null,
    status: parsed.data.status as ProjectStatus,
    repo_url: parsed.data.repo_url || null,
    local_path: parsed.data.local_path || null,
  });

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      const imagePath = await saveProjectImage(project.id, image);
      dbUpdateProject(project.id, { image_path: imagePath });
    } catch (err) {
      // Project was created successfully; surface the image problem without rolling back.
      revalidatePath("/");
      return { ok: false, error: err instanceof ImageValidationError ? err.message : "Image upload failed" };
    }
  }

  revalidatePath("/");
  return { ok: true };
}

export async function updateProjectAction(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = getProject(id);
  if (!existing) return { ok: false, error: "Project not found" };

  dbUpdateProject(id, {
    name: parsed.data.name,
    description: parsed.data.description || null,
    status: parsed.data.status as ProjectStatus,
    repo_url: parsed.data.repo_url || null,
    local_path: parsed.data.local_path || null,
  });

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      const imagePath = await saveProjectImage(id, image);
      dbUpdateProject(id, { image_path: imagePath });
    } catch (err) {
      revalidatePath("/");
      return { ok: false, error: err instanceof ImageValidationError ? err.message : "Image upload failed" };
    }
  }

  revalidatePath("/");
  return { ok: true };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  clearProjectImage(id);
  dbDeleteProject(id);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Used by the add/edit form: when the local_path field is filled in, checks
 * whether it's a valid git repo so the UI can auto-suggest status="in_progress"
 * (still overridable — see §3.5/§3.7 discussion on this being a smart default,
 * not a hard rule).
 */
export async function checkLocalPathAction(localPath: string): Promise<{ isRepo: boolean }> {
  if (!localPath?.trim()) return { isRepo: false };
  return { isRepo: isGitRepo(localPath.trim()) };
}

/** Fetches full recent git log on demand, when the detail modal opens (§3.7). */
export async function fetchRecentCommitsAction(id: string): Promise<CommitsResult> {
  const project = getProject(id);
  if (!project?.local_path) {
    return { ok: false, commits: [], error: "No local path set for this project." };
  }
  try {
    const commits = getRecentCommits(project.local_path, 10);
    return { ok: true, commits };
  } catch (err) {
    return {
      ok: false,
      commits: [],
      error: err instanceof GitAccessError ? err.message : "Could not read git history.",
    };
  }
}
