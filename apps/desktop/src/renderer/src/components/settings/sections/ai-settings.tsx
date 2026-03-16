import {
  AI_PROVIDERS,
  ANTHROPIC_MODELS,
  GOOGLE_MODELS,
  OPENAI_MODELS,
} from "../defaults";
import {
  ResetButton,
  SettingsDivider,
  SettingsInput,
  SettingsNumberInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSlider,
  SettingsTextarea,
} from "../form-components";
import { useSettings } from "../settings-context";

export function AISettingsSection() {
  const { settings, updateSettings, resetSection } = useSettings();
  const ai = settings.ai;

  const getModelOptions = () => {
    switch (ai.provider) {
      case "google":
        return GOOGLE_MODELS;
      case "anthropic":
        return ANTHROPIC_MODELS;
      case "openai":
        return OPENAI_MODELS;
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Provider & Model"
        description="Configure your AI provider and model selection"
      >
        <SettingsRow label="Provider" description="AI service provider">
          <SettingsSelect
            value={ai.provider}
            onChange={(value) => {
              updateSettings("ai", {
                provider: value as typeof ai.provider,
                model:
                  value === "google"
                    ? "gemini-2.0-flash"
                    : value === "anthropic"
                      ? "claude-sonnet-4-20250514"
                      : value === "openai"
                        ? "gpt-4o"
                        : "",
              });
            }}
            options={AI_PROVIDERS}
          />
        </SettingsRow>

        {ai.provider !== "custom" && (
          <SettingsRow label="Model" description="AI model to use">
            <SettingsSelect
              value={ai.model}
              onChange={(value) => updateSettings("ai", { model: value })}
              options={getModelOptions()}
            />
          </SettingsRow>
        )}

        {ai.provider === "custom" && (
          <SettingsRow label="Base URL" description="API endpoint URL">
            <SettingsInput
              value={ai.baseUrl}
              onChange={(value) => updateSettings("ai", { baseUrl: value })}
              placeholder="https://api.example.com/v1"
              className="w-[280px]"
            />
          </SettingsRow>
        )}
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="API Configuration"
        description="Authentication and connection settings"
      >
        <SettingsRow
          label="API Key"
          description="Your API key (stored locally)"
        >
          <SettingsInput
            value={ai.apiKey}
            onChange={(value) => updateSettings("ai", { apiKey: value })}
            type="password"
            placeholder="Enter your API key"
            className="w-[280px]"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Model Parameters"
        description="Fine-tune model behavior"
      >
        <SettingsRow
          label="Temperature"
          description="Randomness of output (0-2)"
        >
          <SettingsSlider
            value={ai.temperature}
            onChange={(value) => updateSettings("ai", { temperature: value })}
            min={0}
            max={2}
            step={0.1}
          />
        </SettingsRow>

        <SettingsRow label="Max Tokens" description="Maximum response length">
          <SettingsNumberInput
            value={ai.maxTokens}
            onChange={(value) => updateSettings("ai", { maxTokens: value })}
            min={1}
            max={100000}
            step={256}
            className="w-[120px]"
          />
        </SettingsRow>

        <SettingsRow label="Top P" description="Nucleus sampling threshold">
          <SettingsSlider
            value={ai.topP}
            onChange={(value) => updateSettings("ai", { topP: value })}
            min={0}
            max={1}
            step={0.05}
          />
        </SettingsRow>

        <SettingsRow label="Top K" description="Top-K sampling parameter">
          <SettingsNumberInput
            value={ai.topK}
            onChange={(value) => updateSettings("ai", { topK: value })}
            min={1}
            max={100}
            className="w-[120px]"
          />
        </SettingsRow>

        <SettingsRow
          label="Context Window"
          description="Maximum context length in tokens"
        >
          <SettingsNumberInput
            value={ai.contextWindow}
            onChange={(value) => updateSettings("ai", { contextWindow: value })}
            min={1000}
            max={200000}
            step={1000}
            className="w-[120px]"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="System Prompt"
        description="Custom system instructions for the AI"
      >
        <SettingsTextarea
          value={ai.systemPrompt}
          onChange={(value) => updateSettings("ai", { systemPrompt: value })}
          placeholder="Enter custom system prompt (optional)"
          rows={4}
          className="w-full"
        />
      </SettingsSection>

      <div className="flex justify-end pt-4">
        <ResetButton onClick={() => resetSection("ai")} />
      </div>
    </div>
  );
}
