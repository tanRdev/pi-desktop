import type { ModelSnapshot, ProviderSnapshot } from "@pi-desktop/shared";

type ProviderModelLike = {
  id: string;
  name?: string;
  provider: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
};

function toModelSnapshot(model: ProviderModelLike): ModelSnapshot {
  return {
    id: model.id,
    name: model.name ?? model.id,
    providerId: model.provider,
    supportsThinking: model.reasoning,
    supportsVision: model.input?.includes("image") ?? false,
    contextWindow: model.contextWindow,
  };
}

export function mapSdkProviders(
  models: readonly ProviderModelLike[],
): ProviderSnapshot[] {
  const providerMap = new Map<string, ModelSnapshot[]>();

  for (const model of models) {
    const providerModels = providerMap.get(model.provider);

    if (providerModels) {
      providerModels.push(toModelSnapshot(model));
      continue;
    }

    providerMap.set(model.provider, [toModelSnapshot(model)]);
  }

  const result: ProviderSnapshot[] = [];

  for (const [providerId, providerModels] of providerMap) {
    result.push({
      id: providerId,
      name: providerId,
      models: providerModels,
      isConfigured: true,
    });
  }

  return result;
}

export type { ProviderModelLike };
