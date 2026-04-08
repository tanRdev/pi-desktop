import { cn } from "@/lib/utils";
import { useShellModel } from "../../../hooks/use-shell-model";
import { getRuntimeProviders, getRuntimeSelection } from "../ai-runtime";
import {
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from "../form-components";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

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
        title="Provider and model"
        description="These controls are live. Changing them updates the active runtime immediately."
      >
        <div
          className={cn("transition-all duration-200", "stagger-item")}
          style={{
            animationDelay: "0ms",
            animationFillMode: "forwards",
            transitionTimingFunction: EASE_OUT,
          }}
        >
          <SettingsRow
            label="Provider"
            description="Available providers detected from the current thread runtime"
          >
            <SettingsSelect
              testId="settings-provider-select"
              ariaLabel="Provider"
              value={currentProvider?.id ?? ""}
              onChange={(value) => {
                void handleProviderChange(value);
              }}
              options={providerOptions}
              disabled={isSwitchingModel || providerOptions.length === 0}
            />
          </SettingsRow>
        </div>

        <div
          className={cn("transition-all duration-200", "stagger-item")}
          style={{
            animationDelay: "40ms",
            animationFillMode: "forwards",
            transitionTimingFunction: EASE_OUT,
          }}
        >
          <SettingsRow
            label="Model"
            description="Model list scoped to the selected provider"
          >
            <SettingsSelect
              testId="settings-model-select"
              ariaLabel="Model"
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
        </div>
      </SettingsSection>

      {runtimeProviders.length === 0 ? (
        <div
          className={cn(
            "stagger-item rounded-md border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-sm text-white/40",
          )}
          style={{
            animationDelay: "80ms",
            animationFillMode: "forwards",
          }}
        >
          No configured providers are available in the current runtime.
        </div>
      ) : null}
    </div>
  );
}
