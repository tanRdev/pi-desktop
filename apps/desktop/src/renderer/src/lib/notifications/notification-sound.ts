import type { NotificationLevel } from "./notification-center";
import { getNotificationPrefs } from "./notification-prefs";

const LEVEL_FREQUENCY: Record<NotificationLevel, number> = {
  success: 523,
  info: 659,
  warn: 784,
  error: 440,
};

const BEEP_DURATION_MS = 80;

export interface BeepParams {
  frequency: number;
  duration: number;
}

export function createBeep(frequency: number, duration: number): BeepParams {
  return { frequency, duration };
}

function getLevelBeep(level: NotificationLevel): BeepParams {
  return createBeep(LEVEL_FREQUENCY[level], BEEP_DURATION_MS);
}

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

function playBeep(params: BeepParams): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = params.frequency;

  gain.gain.value = 0.3;
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + params.duration / 1000,
  );

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + params.duration / 1000);
}

export function playNotificationSound(level: NotificationLevel): void {
  const prefs = getNotificationPrefs();
  if (!prefs.sounds) return;

  const params = getLevelBeep(level);
  playBeep(params);
}

export function _resetAudioContext(): void {
  sharedContext = null;
}
