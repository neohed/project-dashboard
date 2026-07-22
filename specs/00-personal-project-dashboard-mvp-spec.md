# Personal Project Dashboard — MVP Specification

**Version:** 0.1 (MVP)  
**Date:** July 20, 2026  
**Status:** Draft for implementation  
**Goal:** A lightweight, local-first tool to track personal coding projects and ideas with clear visibility into recent development activity.

---

## 1. Executive Summary

A simple web-based dashboard that displays projects as cards in two stages: **Ideas** and **In Progress**. 

- **Ideas**: Early concepts, no code repo yet (or repo not cloned locally).
- **In Progress**: Projects that have a code repository (remote link + optionally a local clone path).

Each card shows the essentials at a glance. A detail modal provides full information including the most recent git commit messages pulled live from the local clone. Projects are ordered by recency of development activity (git commit date for In Progress projects; last updated for Ideas).

The tool is **personal-only**, runs locally, requires zero cloud accounts, and prioritizes speed and simplicity (KISS principle).

**Key value prop**: See at a glance which projects are actively being worked on and jump straight into them (repo link + local path copy/paste).

---

## 2. Goals & Non-Goals

### Goals (MVP)
- Visual overview of all active + idea-stage projects.
- Automatic "last activity" signal derived from real git history (no manual status updates needed for In Progress).
- One-click access to repo (web) and local clone (via copy commands).
- Fast to add/edit projects.
- Easy to run and maintain (Docker Compose or direct `npm run dev`).
- Works offline after initial setup.

### Non-Goals (explicitly out of MVP)
- Multi-user / sharing / collaboration
- Cloud sync or remote hosting (local only)
- Git operations beyond read-only `git log` (no commit, push, clone from UI)
- Rich text / Markdown editor for descriptions (plain textarea + optional preview is fine)
- More than two stages (no "Done", "Archived", "Review" yet)
- Notifications, reminders, or analytics dashboards
- GitHub/GitLab API integration (stars, open issues, PRs)
- Theming beyond a clean dark/light mode (Tailwind makes it trivial to add later)

---

## 3. Core Features (MVP Scope)

### 3.1 Project Data
Every project has:
- `id` (UUID)
- `name` (required, unique-ish)
- `description` (plain text or light Markdown; shown truncated in card, full in modal)
- `status`: `"idea"` | `"in_progress"`
- `repo_url`: string (optional for ideas, recommended for in_progress)
- `local_path`: absolute filesystem path to local clone (optional but powerful for In Progress)
- `image_path`: relative path to an uploaded project image, stored on disk (optional; see §3.6)
- `created_at`, `updated_at` (auto-managed)

### 3.2 Dashboard View
- Header: App name + "Add Project" button + optional global search/filter.
- Two-column Kanban-style layout (or responsive grid + tabs on mobile):
  - **Ideas** (left or top)
  - **In Progress** (right or bottom)
- Cards are sortable within each column by last activity (descending).
- Drag-and-drop between columns to change status (nice-to-have; buttons in edit form also work).

### 3.3 Project Card (compact)
- Cover image (if `image_path` set) as a thumbnail/banner; a neutral placeholder graphic otherwise
- Project name (bold)
- Truncated description (2–3 lines)
- Status badge (color-coded)
- Last activity teaser:
  - In Progress: `"2d ago — 'refactor auth middleware'"`
  - Idea: `"Updated 5d ago"` or `"Created today"`
- Small icons indicating presence of `repo_url` and `local_path`
- Subtle hover state; entire card clickable → opens detail modal

### 3.4 Detail Modal
Opened by clicking a card. Contains:
- Full name + editable status toggle
- Full description (scrollable if long)
- **Links section**:
  - Repo URL (clickable, opens in new tab) + copy button
  - Local path (monospace) + **Copy path** button
  - **Copy terminal command** button: e.g. `cd "/path/to/project" && code .` (customizable in settings later)
- **Recent Commits** section (only shown for In Progress with valid `local_path`):
  - List of last 8–10 commits: short hash | relative date | author | subject
  - "Refresh" button to re-run git log
  - Graceful fallback if path invalid, not a git repo, or git not available
- Edit / Delete actions (with confirmation for delete)

### 3.5 Add / Edit Project Form
Modal or slide-over form with fields:
- Name (text, required)
- Description (textarea)
- Status (select or segmented control)
- Repo URL (url input, optional)
- Local Path (text input — user pastes from file manager; no file picker in browser)
- Cover Image (native `<input type="file" accept="image/*">` + preview thumbnail; optional). Uses a real file picker (unlike Local Path) since browsers can read file bytes for upload but can't resolve arbitrary filesystem paths.
- Validation: warn if status=`in_progress` but neither repo nor local_path provided

Form is used for both create and edit (pre-filled in modal).

### 3.6 Image Upload Handling
- On form submit, if a new image file is present, it's sent as part of the request (Server Action accepting `FormData`, or a dedicated Route Handler).
- Server writes the file to `data/images/{project_id}.{ext}`, generating a fresh filename server-side (never trusts the client-supplied filename) and overwriting any prior image for that project.
- The DB's `image_path` column is updated to the relative path (e.g. `images/{project_id}.jpg`) after a successful write — path and file stay in sync in one transaction-like step, avoiding the "filename in JSON doesn't match what's on disk" drift that motivated storing this in SQLite rather than a hand-edited JSON array.
- Basic validation: restrict to common image MIME types (jpg/png/webp/gif), cap file size (e.g. 5MB), and re-encode/strip metadata if desired (optional, nice-to-have).
- Images served via a static route (`/data/images/...`) or `next/image` pointed at the same volume already mounted for SQLite persistence in §7 — no separate storage system needed.
- Deleting a project removes its row and, in the same operation, deletes the corresponding image file from disk (avoid orphaned files).

### 3.7 Sorting & Activity Logic
- **In Progress** column: sorted by most recent git commit date (from `local_path` if present and valid). Fallback to `updated_at`.
- **Ideas** column: sorted by `updated_at` descending.
- On dashboard load, backend computes lightweight "last activity" metadata for sorting (only needs latest commit timestamp, not full log).
- Full git log is fetched on-demand when opening the detail modal (keeps initial load fast).

---

## 4. Data Model (SQLite)

```sql
CREATE TABLE projects (
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

-- Optional: lightweight cache for last commit date (refreshed on demand)
CREATE TABLE project_activity (
    project_id TEXT PRIMARY KEY,
    last_commit_date TEXT,
    last_commit_subject TEXT,
    last_fetched_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

For MVP we can skip the `project_activity` cache table specifically and compute git activity on the fly (git is fast) — add caching only if list load feels slow with many projects. The `projects` table itself (including `image_path`) is used from the start: it keeps image references, git paths, and metadata atomic and in sync, which is the main reason SQLite was chosen over a flat JSON file for this app.

---

## 5. Recommended Tech Stack

### Decision: Next.js 15, single app (no separate backend)

For a personal, single-user, local-first tool there's no team boundary or scaling need that justifies decoupling frontend and backend. A single Next.js app removes that overhead entirely:

- **One codebase, one dev server, one deploy target** — no API contract to keep in sync between two services.
- **Server Actions replace most of the API layer.** The add/edit form, status changes, delete, and image upload can all call server actions directly — no route handler, no client-side fetch/loading boilerplate for mutations.
- **Route Handlers still available where useful** — e.g. an on-demand "refresh git activity" endpoint the client can poll, or if a stable JSON API is ever wanted.
- Built-in SQLite support via `better-sqlite3` (sync, simple)
- Easy Dockerization (one service)
- Future-proof: can deploy as Vercel/Cloudflare if a read-only public version is ever wanted

**Runtime note**: anything touching `child_process` (git log), `better-sqlite3`, or file uploads must run on the **Node.js runtime**, not the Edge runtime — Edge can't do any of these. Pin `export const runtime = 'nodejs'` on the relevant Route Handlers/Server Actions to avoid a silent footgun later.

- **UI**: Tailwind CSS + shadcn/ui (beautiful cards, modals, forms with minimal effort) + lucide-react icons
- **State**: React Query / TanStack Query for server state + optimistic updates on edit
- **Git integration**: Node `child_process` in Server Actions / Route Handlers
- **Validation**: Zod

### Why not Electron / Tauri for MVP?
- You correctly identified the complexity tax (packaging, code signing, updater, native menus, security model).
- A localhost web app is perfectly sufficient and far simpler to iterate on.
- If in 3–6 months you decide you *really* want one-click "Open in VS Code" + native feel, migrating the React frontend to Tauri is straightforward (Tauri has excellent React support and Rust `std::process` / `git2` for git).

---

## 6. Git Log Integration (Critical Detail)

### How it works
Backend exposes:
- `GET /api/projects/:id/activity` → returns `{ lastCommitDate, commits: [...] }`
- On dashboard list load: for each In Progress project that has `local_path`, call a lightweight "get latest commit timestamp only" helper (much faster than full log).
- On modal open: fetch full recent commits.

**Safe git command example** (Node):
```ts
import { execSync } from 'child_process';
import path from 'path';

function getRecentCommits(localPath: string, limit = 10) {
  const resolved = path.resolve(localPath);
  // Basic safety (expand with ALLOWED_BASE_PATHS env var in real impl)
  if (!resolved.startsWith('/home/') && !resolved.startsWith('/Users/')) {
    throw new Error('Path outside allowed directories');
  }
  const cmd = `git -C "${resolved}" log --pretty=format:"%h|%ad|%an|%s" --date=iso-strict -n ${limit} --no-merges`;
  const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  return output.trim().split('\n').map(line => {
    const [hash, date, author, ...subjectParts] = line.split('|');
    return { hash, date, author, subject: subjectParts.join('|') };
  });
}
```

### Security & Robustness Notes
- Never trust `local_path` blindly in production (but this is personal localhost tool).
- Always `path.resolve()` + prefix allow-list (configurable via `.env`).
- Handle errors gracefully: "Git not found", "Not a git repository", "Permission denied", "Path does not exist".
- `local_path` is stored as-is; user is responsible for keeping clones up-to-date (`git pull` outside the tool).

---

## 7. Docker Compose (Easy Run)

`docker-compose.yml` (simplified):
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data                 # SQLite persistence + uploaded images (data/images/)
      # === USER-CONFIGURED MOUNTS (edit as needed) ===
      # - /home/yourname/code:/app/host-code:ro
      # - /home/yourname/projects:/app/host-projects:ro
    environment:
      - NODE_ENV=production
      - ALLOWED_BASE_PATHS=/app/host-code:/app/host-projects:/app/data
      - DATABASE_URL=file:/app/data/projects.db
    # Important for file permissions on host git clones:
    # user: "${UID}:${GID}"
```

**Docker reality check**:
- Great for reproducibility and "it just works" for non-git features.
- Host filesystem access for arbitrary project paths requires bind mounts + matching UID/GID. This is the main gotcha.
- **Recommended dev workflow**: Use Docker for the final packaged version. During active development and when adding many new projects, run `npm run dev` directly on the host (zero permission friction).

Provide both instructions in the README.

---

## 8. API / Data Access Layer (Next.js example)

### Route Handlers (or Server Actions)
- `GET /api/projects` — list all + lightweight activity metadata for sorting
- `GET /api/projects/[id]` — full project + recent commits (if applicable)
- `POST /api/projects` — create
- `PUT /api/projects/[id]` — update (including status change)
- `DELETE /api/projects/[id]`
- `POST /api/projects/[id]/refresh-activity` — force re-fetch git info
- `POST /api/projects/[id]/image` — upload/replace cover image (multipart `FormData`); writes to `data/images/`, updates `image_path`

All responses JSON (except the image upload, which returns the updated project record). Use Zod for validation on mutations. Create/update/image-upload can equally be implemented as Server Actions instead of Route Handlers — see §5.

---

## 9. UI/UX Polish (MVP but delightful)
- Clean, modern card design with subtle shadows and hover lift
- Skeleton loaders while fetching git data
- Toast notifications on create/update/delete/refresh (sonner)
- Keyboard shortcuts: `n` = new project, `esc` = close modal, `/` = focus search
- Responsive: works on tablet; desktop-optimized
- Empty states with helpful copy ("No ideas yet — add your first wild thought!")
- Confirm delete modal

---

## 10. Out of Scope / Future Roadmap (Post-MVP)
1. Third stage ("Done" or "Parked") + archive
2. Rich description with MD editor + preview
3. Per-project tags/labels + filtering
4. GitHub integration (public repo metadata without local clone)
5. Simple stats page (projects created this year, most active month, etc.)
6. Export single project or all to Markdown report
7. Dark mode toggle + custom accent color
8. Tauri/Electron desktop wrapper with native "Open in editor" buttons
9. Watcher that auto-refreshes activity when you `git commit` elsewhere (nice but non-trivial)

---

## 11. Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|------------|----------|
| Docker volume permission issues with host git clones | High | Document both Docker + native run paths clearly; provide `docker-compose.override.yml` example |
| `local_path` becomes invalid (moved/deleted clone) | Medium | Graceful error handling + "Clear local path" action in UI |
| Git binary not in PATH inside container | Low | Health check + clear error message; fallback to native run recommendation |
| Too many projects makes list slow | Low (personal use) | Add simple pagination or virtualized list if >100 projects |
| User pastes wrong path | Medium | Validation on save + test button in form ("Verify git repo") |
| Orphaned image files after project delete, or unbounded image sizes | Low | Delete file alongside DB row on project delete; enforce MIME type + size cap on upload (see §3.7) |

---

## 12. Implementation Phases (Suggested)
1. **Phase 0** (setup): Next.js + Tailwind + shadcn + SQLite schema + basic CRUD
2. **Phase 1** (core): Dashboard with two columns, cards, modal, add/edit form, sorting by `updated_at`
3. **Phase 2** (git magic): Backend git log integration + activity computation + copy buttons
4. **Phase 3** (polish): Drag-drop (optional), toasts, empty states, Docker setup, README with screenshots
5. **Phase 4** (validation): Test with 8–10 real projects, fix edge cases (bad paths, large commit messages, etc.)

---

## 13. Open Questions for You
1. Do you want drag-and-drop between Idea ↔ In Progress in MVP, or is status select in the form enough?
2. Preferred editor command template? (`code .`, `idea .`, `nvim .`, or make it configurable?)
3. Any existing projects you want to seed the first version with (we can add a seed script)?
4. Name of the app? (current working title: **ProjectCards** / **DevPulse** / **Sideboard** — your call)

---

**This spec is intentionally detailed enough to start coding immediately while remaining focused on the 80/20 of value.** 

It directly addresses your constraints (simple web page, KISS local path, Docker, React + BE, git logs, ordering by real dev activity) and highlights the practical trade-offs around filesystem access.

Ready to start implementation? I can help generate the initial Next.js boilerplate, Docker files, or specific components next. Just say the word!
