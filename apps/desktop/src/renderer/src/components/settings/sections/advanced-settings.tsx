import { useSettings } from "../settings-context";
import {
  SettingsSection,
  SettingsRow,
  SettingsSelect,
  SettingsSwitch,
  SettingsInput,
  SettingsNumberInput,
  SettingsDivider,
  ResetButton,
} from "../form-components";
import { LOG_LEVELS, UPDATE_CHANNELS } from "../defaults";

export function AdvancedSettingsSection() {
  const { settings, updateSettings, resetSection } = useSettings();
  const advanced = settings.advanced;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Privacy & Telemetry"
        description="Data collection settings"
      >
        <SettingsRow
          label="Telemetry"
          description="Send anonymous usage data to help improve PiDesk"
        >
          <SettingsSwitch
            checked={advanced.telemetryEnabled}
            onChange={(checked) => updateSettings("advanced", { telemetryEnabled: checked })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Developer Options"
        description="Advanced development settings"
      >
        <SettingsRow
          label="Experimental Features"
          description="Enable beta and experimental features"
        >
          <SettingsSwitch
            checked={advanced.experimentalFeatures}
            onChange={(checked) => updateSettings("advanced", { experimentalFeatures: checked })}
          />
        </SettingsRow>

        <SettingsRow
          label="Debug Mode"
          description="Enable detailed debugging information"
        >
          <SettingsSwitch
            checked={advanced.debugMode}
            onChange={(checked) => updateSettings("advanced", { debugMode: checked })}
          />
        </SettingsRow>

        <SettingsRow label="Log Level" description="Console logging verbosity">
          <SettingsSelect
            value={advanced.logLevel}
            onChange={(value) => updateSettings("advanced", { logLevel: value as typeof advanced.logLevel })}
            options={LOG_LEVELS}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Updates"
        description="Application update settings"
      >
        <SettingsRow label="Update Channel" description="Which version to update to">
          <SettingsSelect
            value={advanced.updateChannel}
            onChange={(value) => updateSettings("advanced", { updateChannel: value as typeof advanced.updateChannel })}
            options={UPDATE_CHANNELS}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Network"
        description="Network and connection settings"
      >
        <SettingsRow
          label="Proxy URL"
          description="HTTP/HTTPS proxy server"
        >
          <SettingsInput
            value={advanced.proxyUrl}
            onChange={(value) => updateSettings("advanced", { proxyUrl: value })}
            placeholder="http://proxy:8080"
            className="w-[200px]"
          />
        </SettingsRow>

        <SettingsRow
          label="Request Timeout"
          description="Timeout in milliseconds"
        >
          <SettingsNumberInput
            value={advanced.timeout}
            onChange={(value) => updateSettings("advanced", { timeout: value })}
            min={5000}
            max={120000}
            step={5000}
            className="w-[120px]"
          />
        </SettingsRow>

        <SettingsRow
          label="Max Concurrent Requests"
          description="Maximum parallel API requests"
        >
          <SettingsNumberInput
            value={advanced.maxConcurrentRequests}
            onChange={(value) => updateSettings("advanced", { maxConcurrentRequests: value })}
            min={1}
            max={20}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Danger Zone"
        description="Irreversible actions"
      >
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <h4 className="text-sm font-medium text-destructive">Reset All Settings</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            This will reset all settings to their default values. This action cannot be undone.
          </p>
          <ResetButton
            onClick={() => resetSection("advanced")}
            label="Reset Section"
          />
        </div>
      </SettingsSection>

      <div className="flex justify-end pt-4">
        <ResetButton onClick={() => resetSection("advanced")} />
      </div>
    </div>
  );
}