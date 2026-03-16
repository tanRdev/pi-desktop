"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ShellProjectSnapshot } from "@pidesk/shared";
import {
  Folder,
  FolderGit,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import * as React from "react";

interface ProjectListProps {
  projects: ShellProjectSnapshot[];
  activeProjectId?: string | null;
  onAddProject: () => void;
  onRemoveProject: (id: string) => void;
  onSelectProject: (id: string) => void;
}

function getPathTail(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

function isGitRepo(path: string): boolean {
  // Simple check - in real implementation this would come from shell snapshot
  return path.includes(".git") || path.toLowerCase().includes("repo");
}

export function ProjectList({
  projects,
  activeProjectId,
  onAddProject,
  onRemoveProject,
  onSelectProject,
}: ProjectListProps) {
  const hasProjects = projects.length > 0;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Directories
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddProject}
          className="size-6 rounded text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          aria-label="Add project"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {!hasProjects ? (
        <div className="rounded border border-border bg-surface-2 p-3">
          <p className="text-sm text-muted-foreground">
            No projects yet. Click + to add a folder or Git repository.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const Icon = isGitRepo(project.path) ? FolderGit : Folder;

            return (
              <div
                key={project.id}
                className={cn(
                  "group flex items-center gap-2 rounded border px-2.5 py-2 transition",
                  isActive
                    ? "border-border-hover bg-surface-3 text-foreground"
                    : "border-transparent hover:border-border-hover hover:bg-surface-2",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-foreground/70" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        isActive ? "text-foreground" : "text-foreground/80",
                      )}
                    >
                      {project.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {getPathTail(project.path)}
                    </p>
                  </div>
                </button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 rounded opacity-0 transition hover:bg-surface-3 group-hover:opacity-100"
                      aria-label="Project options"
                    >
                      <MoreHorizontal className="size-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    side="bottom"
                    className="w-40 rounded border border-border bg-popover p-2"
                  >
                    <button
                      type="button"
                      onClick={() => onRemoveProject(project.id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
