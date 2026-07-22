"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "./ui/button";
import { ProjectColumn } from "./project-column";
import { ProjectDialog } from "./project-dialog";
import type { ProjectWithActivity } from "@/lib/activity";

export function Dashboard({ projects }: { projects: ProjectWithActivity[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProjectWithActivity | null>(null);
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "n" && !typing) {
        e.preventDefault();
        setCreating(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    );
  }, [query, projects]);

  const ideas = filtered.filter((p) => p.status === "idea");
  const inProgress = filtered.filter((p) => p.status === "in_progress");

  const dialogOpen = creating || selected !== null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between gap-4 mb-10">
        <div>
          <p className="font-display text-xs text-accent-progress">
            $ project-dashboard<span className="caret" aria-hidden />
          </p>
          <h1 className="text-2xl font-medium text-text mt-1">Your projects</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search  /"
              className="w-48 rounded-md border border-border bg-surface pl-8 pr-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent-progress outline-none"
            />
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} /> Add project
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-12">
        <ProjectColumn
          title="ideas"
          emptyHint="No ideas yet — add your first wild thought."
          projects={ideas}
          onSelect={setSelected}
        />
        <ProjectColumn
          title="in_progress"
          emptyHint="Nothing in progress — pick an idea and get building."
          projects={inProgress}
          onSelect={setSelected}
        />
      </div>

      {dialogOpen && (
        <ProjectDialog
          project={selected}
          onClose={() => {
            setSelected(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
