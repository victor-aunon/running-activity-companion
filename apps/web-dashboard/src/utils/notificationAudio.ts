import type { NotificationType } from '@running-support/shared-contracts';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Auto-resume AudioContext on first user gesture
if (typeof window !== 'undefined') {
  const resume = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', resume, { once: false, passive: true });
  window.addEventListener('keydown', resume, { once: false, passive: true });
  window.addEventListener('touchstart', resume, { once: false, passive: true });
}

function playSprintChime(ctx: AudioContext, now: number): void {
  // High-energy 3-tone ascending chime (E5 -> G#5 -> B5)
  const notes = [659.25, 830.61, 987.77];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    gain.gain.setValueAtTime(0.001, now + idx * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.25);
  });
}

function playExertionPulse(ctx: AudioContext, now: number): void {
  // Attention-grabbing 2-tone pulse (F5 -> Ab5)
  const notes = [698.46, 830.61];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.12);

    gain.gain.setValueAtTime(0.001, now + idx * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.12);
    osc.stop(now + idx * 0.12 + 0.28);
  });
}

function playMilestoneChime(ctx: AudioContext, now: number): void {
  // Warm ascending major 5th (D5 -> A5)
  const notes = [587.33, 880.0];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.1);

    gain.gain.setValueAtTime(0.001, now + idx * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.1);
    osc.stop(now + idx * 0.1 + 0.38);
  });
}

/**
 * Synthesizes a clean acoustic chime for web notifications using the Web Audio API.
 * Does not require external audio files or network requests.
 */
export function playNotificationSound(type: NotificationType = 'MILESTONE_25'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    if (type === 'SPRINT') {
      playSprintChime(ctx, now);
    } else if (type === 'EXERTION') {
      playExertionPulse(ctx, now);
    } else {
      playMilestoneChime(ctx, now);
    }
  } catch {
    // Ignore audio errors on environments without audio support
  }
}
