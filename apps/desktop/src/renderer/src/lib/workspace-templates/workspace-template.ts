export interface WorkspaceTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly layout: WorkspaceLayout;
  readonly defaultCommands: readonly string[];
}

export interface WorkspaceLayout {
  readonly panes: readonly WorkspacePane[];
}

export interface WorkspacePane {
  readonly id: string;
  readonly type: string;
  readonly width?: number;
  readonly height?: number;
}

export const BLANK_TEMPLATE: WorkspaceTemplate = {
  id: "blank",
  name: "Blank",
  description: "Empty workspace with no pre-configured panes or commands.",
  icon: "Square",
  layout: { panes: [] },
  defaultCommands: [],
};

export const CODE_REVIEW_TEMPLATE: WorkspaceTemplate = {
  id: "code-review",
  name: "Code Review",
  description:
    "Optimized layout for reviewing code changes with diff and discussion panes.",
  icon: "Code",
  layout: {
    panes: [
      { id: "diff", type: "diff", width: 60 },
      { id: "discussion", type: "thread", width: 40 },
    ],
  },
  defaultCommands: ["git diff", "git log --oneline -20"],
};

export const DEBUGGING_TEMPLATE: WorkspaceTemplate = {
  id: "debugging",
  name: "Debugging",
  description:
    "Layout for debugging with terminal, logs, and variable inspection panes.",
  icon: "Bug",
  layout: {
    panes: [
      { id: "terminal", type: "terminal", width: 50, height: 50 },
      { id: "logs", type: "log-viewer", width: 50, height: 50 },
      { id: "variables", type: "inspector", width: 50, height: 50 },
    ],
  },
  defaultCommands: ["npm test", "npm run build"],
};

export const DOCUMENTATION_TEMPLATE: WorkspaceTemplate = {
  id: "documentation",
  name: "Documentation",
  description:
    "Side-by-side editor and preview for writing and reviewing documentation.",
  icon: "Notebook",
  layout: {
    panes: [
      { id: "editor", type: "editor", width: 50 },
      { id: "preview", type: "preview", width: 50 },
    ],
  },
  defaultCommands: ["npm run docs:build", "npm run docs:preview"],
};

export const BUILT_IN_TEMPLATES: readonly WorkspaceTemplate[] = [
  BLANK_TEMPLATE,
  CODE_REVIEW_TEMPLATE,
  DEBUGGING_TEMPLATE,
  DOCUMENTATION_TEMPLATE,
];
