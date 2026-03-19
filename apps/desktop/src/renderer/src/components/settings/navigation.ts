export const SETTINGS_MODAL_SECTION_IDS = ["ai", "interface"] as const;

export type SettingsModalSection = (typeof SETTINGS_MODAL_SECTION_IDS)[number];
