// MCP server exposing the project dashboard to Claude over stdio. It talks to
// the same SQLite DB as the web app (WAL mode handles both processes), so the
// web app doesn't need to be running.
//
// stdout is the MCP transport — never console.log here; use console.error.
import path from "node:path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createProject, getProject, listProjects, updateProject, type Project } from "@/lib/db";
import { withActivity } from "@/lib/activity";
import { getRecentCommits, GitAccessError } from "@/lib/git";
import { needsActivitySourceWarning, projectFormSchema, type ProjectFormValues } from "@/lib/schema";

const server = new McpServer({ name: "project-dashboard", version: "0.1.0" });

const statusSchema = z.enum(["idea", "in_progress"]);

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function normalizePath(p: string) {
  return path.resolve(p.trim()).replace(/\/+$/, "") || "/";
}

/** The project whose local_path is `dir` or the closest ancestor of it. */
function findByPath(dir: string): Project | undefined {
  const target = normalizePath(dir);
  let best: { project: Project; length: number } | undefined;
  for (const project of listProjects()) {
    if (!project.local_path) continue;
    const base = normalizePath(project.local_path);
    const matches = target === base || target.startsWith(base === "/" ? "/" : base + "/");
    if (matches && (!best || base.length > best.length)) best = { project, length: base.length };
  }
  return best?.project;
}

/** Validates with the same Zod schema as the web form; empty strings mean "unset". */
function validate(values: ProjectFormValues) {
  const parsed = projectFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;
  return {
    data: {
      name: d.name,
      description: d.description || null,
      status: d.status,
      repo_url: d.repo_url || null,
      local_path: d.local_path ? normalizePath(d.local_path) : null,
    },
    warning: needsActivitySourceWarning(d)
      ? "Status is in_progress but neither repo_url nor local_path is set, so there is no git activity to sort by."
      : undefined,
  };
}

server.registerTool(
  "list_projects",
  {
    title: "List projects",
    description:
      "List projects on the user's personal project dashboard, most recently active first. Activity is the latest git commit for in_progress projects with a local_path, otherwise the last update.",
    inputSchema: { status: statusSchema.optional().describe("Only return projects with this status") },
    annotations: { readOnlyHint: true },
  },
  async ({ status }) => {
    const projects = withActivity(listProjects()).filter((p) => !status || p.status === status);
    return json(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        description: p.description,
        repo_url: p.repo_url,
        local_path: p.local_path,
        last_activity: p.activityDate,
        last_commit_subject: p.commitSubject,
      }))
    );
  }
);

server.registerTool(
  "get_project",
  {
    title: "Get project",
    description: "Get one project's full details, including its 10 most recent git commits when it has a valid local_path.",
    inputSchema: { id: z.string().describe("Project id") },
    annotations: { readOnlyHint: true },
  },
  async ({ id }) => {
    const project = getProject(id);
    if (!project) return fail(`No project with id "${id}".`);
    let commits: unknown = null;
    let commits_error: string | undefined;
    if (project.local_path) {
      try {
        commits = getRecentCommits(project.local_path, 10);
      } catch (err) {
        commits_error = err instanceof GitAccessError ? err.message : "Could not read git history.";
      }
    }
    return json({ ...project, commits, commits_error });
  }
);

server.registerTool(
  "find_project_by_path",
  {
    title: "Find project by path",
    description:
      "Find the dashboard project for a directory — pass the current working directory to check whether the repo you're in is tracked. Matches the project whose local_path is that directory or its closest parent.",
    inputSchema: { path: z.string().describe("Absolute directory path, e.g. the current working directory") },
    annotations: { readOnlyHint: true },
  },
  async ({ path: dir }) => {
    const project = findByPath(dir);
    return project ? json(project) : json({ found: false, message: `No project is tracked at or above ${normalizePath(dir)}.` });
  }
);

server.registerTool(
  "create_project",
  {
    title: "Create project",
    description:
      "Add a project to the dashboard. Use status 'idea' for concepts without code yet, 'in_progress' for projects with a repo. For the repo you're working in, set local_path to its root directory so the dashboard can read its git activity. Refuses if a project already tracks the same local_path.",
    inputSchema: {
      name: z.string().describe("Project name"),
      status: statusSchema.default("idea"),
      description: z.string().optional().describe("Plain-text description"),
      repo_url: z.string().optional().describe("Web URL of the repo (http/https)"),
      local_path: z.string().optional().describe("Absolute path to the local clone's root"),
    },
  },
  async (input) => {
    const result = validate({
      name: input.name,
      status: input.status,
      description: input.description ?? "",
      repo_url: input.repo_url ?? "",
      local_path: input.local_path ?? "",
    });
    if ("error" in result) return fail(`Invalid project: ${result.error}`);

    if (result.data.local_path) {
      const existing = listProjects().find(
        (p) => p.local_path && normalizePath(p.local_path) === result.data.local_path
      );
      if (existing) return fail(`"${existing.name}" (id ${existing.id}) already tracks ${result.data.local_path}.`);
    }

    const project = createProject(result.data);
    return json({ project, warning: result.warning });
  }
);

server.registerTool(
  "update_project",
  {
    title: "Update project",
    description:
      "Update fields of an existing project. Omitted fields are left unchanged; pass an empty string to clear description, repo_url or local_path.",
    inputSchema: {
      id: z.string().describe("Project id"),
      name: z.string().optional(),
      status: statusSchema.optional(),
      description: z.string().optional(),
      repo_url: z.string().optional(),
      local_path: z.string().optional(),
    },
  },
  async ({ id, ...changes }) => {
    const existing = getProject(id);
    if (!existing) return fail(`No project with id "${id}".`);

    const result = validate({
      name: changes.name ?? existing.name,
      status: changes.status ?? existing.status,
      description: changes.description ?? existing.description ?? "",
      repo_url: changes.repo_url ?? existing.repo_url ?? "",
      local_path: changes.local_path ?? existing.local_path ?? "",
    });
    if ("error" in result) return fail(`Invalid update: ${result.error}`);

    const project = updateProject(id, result.data);
    return json({ project, warning: result.warning });
  }
);

server
  .connect(new StdioServerTransport())
  .then(() => console.error("project-dashboard MCP server running on stdio"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
