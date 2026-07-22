import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATABASE_DIR
  ? path.resolve(process.env.DATABASE_DIR)
  : path.resolve(process.cwd(), "data");

const DB_PATH = path.join(DATA_DIR, "projects.db");
export const IMAGES_DIR = path.join(DATA_DIR, "images");

fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Single shared connection — fine for a single-user, localhost tool.
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('idea','in_progress')) NOT NULL DEFAULT 'idea',
    repo_url TEXT,
    local_path TEXT,
    image_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_activity (
    project_id TEXT PRIMARY KEY,
    last_commit_date TEXT,
    last_commit_subject TEXT,
    last_fetched_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

export type ProjectStatus = "idea" | "in_progress";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  repo_url: string | null;
  local_path: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewProjectInput {
  name: string;
  description?: string | null;
  status: ProjectStatus;
  repo_url?: string | null;
  local_path?: string | null;
}

export interface UpdateProjectInput extends Partial<NewProjectInput> {
  image_path?: string | null;
}

export function listProjects(): Project[] {
  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Project[];
}

export function getProject(id: string): Project | undefined {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
}

export function createProject(input: NewProjectInput): Project {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO projects (id, name, description, status, repo_url, local_path)
     VALUES (@id, @name, @description, @status, @repo_url, @local_path)`
  ).run({
    id,
    name: input.name,
    description: input.description ?? null,
    status: input.status,
    repo_url: input.repo_url ?? null,
    local_path: input.local_path ?? null,
  });
  return getProject(id)!;
}

export function updateProject(id: string, input: UpdateProjectInput): Project | undefined {
  const existing = getProject(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...input };
  db.prepare(
    `UPDATE projects
     SET name = @name, description = @description, status = @status,
         repo_url = @repo_url, local_path = @local_path, image_path = @image_path,
         updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    name: merged.name,
    description: merged.description ?? null,
    status: merged.status,
    repo_url: merged.repo_url ?? null,
    local_path: merged.local_path ?? null,
    image_path: merged.image_path ?? null,
  });
  return getProject(id);
}

export function deleteProject(id: string): void {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

export function upsertActivity(projectId: string, lastCommitDate: string | null, lastCommitSubject: string | null) {
  db.prepare(
    `INSERT INTO project_activity (project_id, last_commit_date, last_commit_subject, last_fetched_at)
     VALUES (@projectId, @lastCommitDate, @lastCommitSubject, datetime('now'))
     ON CONFLICT(project_id) DO UPDATE SET
       last_commit_date = excluded.last_commit_date,
       last_commit_subject = excluded.last_commit_subject,
       last_fetched_at = excluded.last_fetched_at`
  ).run({ projectId, lastCommitDate, lastCommitSubject });
}

export function getActivity(projectId: string) {
  return db
    .prepare("SELECT * FROM project_activity WHERE project_id = ?")
    .get(projectId) as { last_commit_date: string | null; last_commit_subject: string | null } | undefined;
}

export default db;
