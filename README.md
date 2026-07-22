# project-dashboard

A local-first dashboard for tracking personal coding projects — Ideas and In Progress, sorted by real git activity. See `specs/00-personal-project-dashboard-mvp-spec.md` for the full spec this was built from.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind v4 · SQLite (`better-sqlite3`) · Zod

Single app, no separate backend — see §5 of the spec for why.

## Quick start (native — recommended for day-to-day dev)

```bash
pnpm install
cp .env.example .env      # adjust ALLOWED_BASE_PATHS if your projects live outside /home or /Users
pnpm dev
```

Open http://localhost:3000. The SQLite DB and `data/images/` are created automatically on first run (in `./data`).

## Quick start (Docker — for the packaged/"it just works" version)

```bash
docker compose up --build
```

Docker's main gotcha is host filesystem access for git repos: `local_path` values only resolve inside the container if you bind-mount the real host directories. Edit the `volumes:` and `ALLOWED_BASE_PATHS` env var in `docker-compose.yml`:

```yaml
volumes:
  - ./data:/app/data
  - /home/yourname/code:/app/host-code:ro
environment:
  - ALLOWED_BASE_PATHS=/app/host-code:/app/data
```

Then set each project's `local_path` to the *container* path (e.g. `/app/host-code/my-project`), not the host path.

**Recommended workflow**: use `pnpm dev` natively while actively adding projects (zero permission friction), and Docker for a stable long-running instance.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `ALLOWED_BASE_PATHS` | `/home:/Users` | Colon-separated allow-list of directory prefixes `local_path` may resolve into (§6 safety check) |
| `DATABASE_DIR` | `./data` | Where the SQLite file and `images/` subfolder live |

## Editor command

The detail modal's "Copy `code .` cmd" button is currently hardcoded to `cd "<path>" && code .` in `src/components/project-dialog.tsx`. If you use a different editor, change that one string (`idea .`, `nvim .`, etc.) — see open question #2 in the spec for making this configurable per-user later.

## Project structure

```
src/
  app/
    actions/projects.ts   # Server Actions: create/update/delete, fetch commits
    images/[filename]/    # Route handler serving uploaded cover images
    page.tsx              # Server component: loads projects + activity, renders Dashboard
    layout.tsx
  components/
    dashboard.tsx          # Client: layout, search, keyboard shortcuts, dialog state
    project-dialog.tsx      # Combined create / view / edit / delete modal
    project-card.tsx / project-column.tsx
    ui/                     # button, input, textarea, select — hand-rolled, no component lib dep
  lib/
    db.ts        # SQLite schema + typed CRUD
    git.ts       # Allow-listed, execFile-based git log reads
    images.ts    # Cover image upload/validation/cleanup
    activity.ts  # Combines DB + git into the sortable "last activity" used by the dashboard
    schema.ts    # Zod validation for the project form
```

## What's implemented vs. still open

Implemented: schema + CRUD, two-column dashboard, add/edit/delete, cover image upload, git-based activity sorting, on-demand recent-commit fetch, search, keyboard shortcuts (`n` new, `/` search), toasts, empty states.

Still open (see §10 and §13 of the spec): drag-and-drop between columns, `esc`-to-close wiring beyond the native `<dialog>` default, seed script, configurable editor command, third stage / tags / stats page roadmap items.
