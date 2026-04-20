import {
  BUILT_IN_TEMPLATES,
  type WorkspaceTemplate,
} from "./workspace-template";

export interface TemplateRegistry {
  readonly registerTemplate: (template: WorkspaceTemplate) => void;
  readonly listTemplates: () => readonly WorkspaceTemplate[];
  readonly getTemplate: (id: string) => WorkspaceTemplate | null;
}

export function createTemplateRegistry(
  initial?: readonly WorkspaceTemplate[],
): TemplateRegistry {
  const templates = new Map<string, WorkspaceTemplate>();

  for (const t of initial ?? BUILT_IN_TEMPLATES) {
    templates.set(t.id, t);
  }

  return {
    registerTemplate(template: WorkspaceTemplate): void {
      templates.set(template.id, template);
    },

    listTemplates(): readonly WorkspaceTemplate[] {
      return Array.from(templates.values());
    },

    getTemplate(id: string): WorkspaceTemplate | null {
      return templates.get(id) ?? null;
    },
  };
}

export const globalTemplateRegistry: TemplateRegistry =
  createTemplateRegistry();
