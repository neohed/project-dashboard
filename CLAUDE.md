# CLAUDE.md

Personal, single-user, local-first dashboard for tracking coding projects (Ideas / In Progress), sorted by real git activity. The spec is `specs/00-personal-project-dashboard-mvp-spec.md` — it's the source of intent, but the code has deliberately diverged in places (see below). Keep things KISS: this is meant to be quick to run, not a product.

## Commands

```bash
pnpm install
pnpm dev                # http://localhost:3000 — DB + data/images/ auto-created
pnpm build
pnpm mcp                # run the stdio MCP server by hand
pnpm lint               # ESLint flat config (eslint-config-next)
npx tsc --noEmit -p .   # typecheck
docker compose up --build
```

There are no tests — lint + typecheck are the checks to run before committing.

## Architecture

Single Next.js 16 app (App Router), no separate backend and no API routes for data — mutations are **Server Actions** in `src/app/actions/projects.ts`; the dashboard is a server component (`src/app/page.tsx`, `force-dynamic`) that renders the client `Dashboard`.

- `src/lib/db.ts` — `better-sqlite3`, one shared synchronous connection. Schema is created on module load (`CREATE TABLE IF NOT EXISTS`); there are no migrations. Rows pass through `toProject()` which converts SQLite's zone-less UTC timestamps to ISO `...Z` — always read projects via `listProjects`/`getProject`, never raw queries, or dates get parsed as local time.
- `src/lib/git.ts` — git is run via `execFileSync` (no shell) and only for paths under `ALLOWED_BASE_PATHS` (colon-separated, default `/home:/Users`). `getLastCommitTimestamp` swallows all errors and returns null by design; `getRecentCommits` throws `GitAccessError` with user-facing messages.
- `src/lib/activity.ts` — runs `git log -1` per in-progress project on every page load to compute sort order + card label; falls back to `updated_at`.
- `src/lib/images.ts` — `processProjectImage` validates and re-encodes to an 800×400 letterboxed webp **without touching disk**; `writeProjectImage` writes `data/images/{id}.webp`. Actions process the image *before* any DB write so a bad image fails the whole action cleanly — keep that ordering.
- `src/app/images/[filename]/route.ts` — serves uploaded images (DB stores `images/{id}.webp`, rendered as `/${image_path}`).
- `src/components/project-dialog.tsx` — one native `<dialog>` handling create / view / edit / delete.
- `src/lib/schema.ts` — Zod schema for the project form (also used by the MCP tools).
- `src/mcp/` — stdio MCP server (`@modelcontextprotocol/sdk`) so Claude can list/find/create/update projects; runs outside Next via `tsx` and shares `src/lib`. `index.ts` must set `DATABASE_DIR` *before* `server.ts` (and so `db.ts`) loads — keep the dynamic import. Never write to stdout there (it's the transport); log with `console.error`. No delete tool, on purpose.

UI uses Tailwind v4 with theme tokens in `src/app/globals.css` (`@theme`); components in `src/components/ui/` are hand-rolled (no shadcn, no TanStack Query despite the spec). Dark theme only.

## Gotchas

- Anything using `better-sqlite3`, `sharp`, `child_process` or `fs` must stay on the Node.js runtime (never Edge).
- `pnpm-workspace.yaml` `allowBuilds` is what lets pnpm build the native modules — the Dockerfile must copy it before `pnpm install`.
- Docker: project `local_path`s must be *container* paths of bind mounts listed in `ALLOWED_BASE_PATHS`; the Dockerfile sets `safe.directory '*'` so git accepts host-owned repos.
- `data/` (SQLite DB + images) is gitignored and dockerignored — it's personal data.
- `project_activity` table and its `upsertActivity`/`getActivity` helpers exist but are unused (spec's optional cache).
- Server Action body limit is raised to 6mb in `next.config.ts` to fit the 5MB image cap.
