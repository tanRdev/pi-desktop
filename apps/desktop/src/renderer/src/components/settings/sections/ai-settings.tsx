import { useShellModel } from "../../../hooks/use-shell-model";
import { getRuntimeProviders, getRuntimeSelection } from "../ai-runtime";
import {
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from "../form-components";

export function AISettingsSection() {
  const { isSwitchingModel, providerSnapshots, settingsSnapshot, switchModel } =
    useShellModel();
  const runtimeProviders = getRuntimeProviders(providerSnapshots);
  const { currentProvider, currentModelId } = getRuntimeSelection(
    runtimeProviders,
    settingsSnapshot,
  );
  const providerOptions = runtimeProviders.map((provider) => ({
    value: provider.id,
    label: provider.name,
  }));
  const modelOptions = (currentProvider?.models ?? []).map((model) => ({
    value: model.id,
    label: model.name,
  }));

  const handleProviderChange = async (providerId: string) => {
    const provider = runtimeProviders.find((entry) => entry.id === providerId);
    const modelId = provider?.models[0]?.id;

    if (!modelId) {
      return;
    }

    try {
      await switchModel({ providerId, modelId });
    } catch (error) {
      console.error("Failed to switch model:", error);
    }
  };

  const handleModelChange = async (modelId: string) => {
    if (!currentProvider) {
      return;
    }

    try {
      await switchModel({ providerId: currentProvider.id, modelId });
    } catch (error) {
      console.error("Failed to switch model:", error);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Provider & Model"
        description="Choose from providers and models available in the current runtime"
      >
        <SettingsRow
          label="Provider"
          description="Runtime-backed provider selection"
        >
          <SettingsSelect
            value={currentProvider?.id ?? ""}
            onChange={(value) => {
              void handleProviderChange(value);
            }}
            options={providerOptions}
            disabled={isSwitchingModel || providerOptions.length === 0}
          />
        </SettingsRow>

        <SettingsRow
          label="Model"
          description="Model currently available for that provider"
        >
          <SettingsSelect
            value={currentModelId}
            onChange={(value) => {
              void handleModelChange(value);
            }}
            options={modelOptions}
            disabled={
              isSwitchingModel ||
              currentProvider === null ||
              modelOptions.length === 0
            }
          />
        </SettingsRow>
      </SettingsSection>

      {runtimeProviders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No configured providers are available in the current runtime.
        </p>
      ) : null}
    </div>
  );
}
