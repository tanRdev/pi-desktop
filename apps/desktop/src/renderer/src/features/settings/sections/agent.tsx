import { SettingsRow, SettingsSection } from "../controls";

export function AgentSection() {
  return (
    <SettingsSection
      title="Agent"
      description="How Pi Desktop talks to the agent runtime."
    >
      <SettingsRow
        label="Runtime"
        description="Mock when the `pi` binary is missing. Install the Pi CLI for a real agent session."
      >
        <span className="text-[11px] text-white/45">Mock or Pi CLI</span>
      </SettingsRow>
      <SettingsRow
        label="Thinking level"
        description="Controlled by the agent runtime / Pi settings. Not edited here yet."
      >
        <span className="text-[11px] text-white/45">Runtime default</span>
      </SettingsRow>
      <SettingsRow
        label="Model"
        description="Type /model in the prompt, or use the model picker in the chat dock."
      >
        <span className="text-[11px] text-white/50">/model</span>
      </SettingsRow>
    </SettingsSection>
  );
}
