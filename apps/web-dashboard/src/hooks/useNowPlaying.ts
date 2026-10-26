import { useState, useEffect, useRef } from 'react';
import type {
  NowPlayingUpdatePacket,
  RunnerPlaybackStatus,
} from '@running-support/shared-contracts';
import { isNowPlayingUpdatePacket } from '@running-support/shared-contracts';
import type { WebSocketClient } from '../services/WebSocketClient';

export interface UseNowPlayingOptions {
  client?: WebSocketClient | null;
  initialNowPlaying?: NowPlayingUpdatePacket | null;
}

const DEFAULT_PLAYBACK_STATUS: RunnerPlaybackStatus = {
  state: 'NONE',
  positionMs: 0,
  capturedAt: 0,
};

export function calculateInterpolatedPosition(
  playback: RunnerPlaybackStatus,
  durationMs: number,
  now = Date.now(),
): number {
  if (playback.state !== 'PLAYING') {
    return playback.positionMs;
  }
  const elapsed = Math.max(0, now - playback.capturedAt);
  return Math.min(durationMs, playback.positionMs + elapsed);
}

export function formatTrackTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function computeProgressPercent(positionMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.min(100, (positionMs / durationMs) * 100);
}

export function shouldAutoTransitionToIdle(
  state: string,
  pausedAt: number,
  now = Date.now(),
): boolean {
  if (state !== 'PAUSED') return false;
  return now - pausedAt >= 60000;
}

function useNowPlayingSocket(
  client: WebSocketClient | null | undefined,
  onPacket: (pkt: NowPlayingUpdatePacket) => void,
) {
  const handlerRef = useRef(onPacket);
  handlerRef.current = onPacket;

  useEffect(() => {
    if (!client) return;
    const unsubscribe = client.onMessage((msg) => {
      if (isNowPlayingUpdatePacket(msg)) {
        handlerRef.current(msg);
      }
    });
    return () => unsubscribe();
  }, [client]);
}

function useInterpolationTimer(
  nowPlaying: NowPlayingUpdatePacket | null,
  onTick: (pos: number) => void,
) {
  useEffect(() => {
    if (!nowPlaying || nowPlaying.playback.state !== 'PLAYING' || !nowPlaying.track) {
      return;
    }
    const duration = nowPlaying.track.durationMs;
    const interval = setInterval(() => {
      onTick(calculateInterpolatedPosition(nowPlaying.playback, duration));
    }, 1000);

    return () => clearInterval(interval);
  }, [nowPlaying, onTick]);
}

function usePausedAutoTransition(
  nowPlaying: NowPlayingUpdatePacket | null,
  onTransition: () => void,
) {
  useEffect(() => {
    if (!nowPlaying || nowPlaying.playback.state !== 'PAUSED') return;

    const elapsed = Math.max(0, Date.now() - nowPlaying.playback.capturedAt);
    if (elapsed >= 60000) {
      onTransition();
      return;
    }

    const timeout = setTimeout(onTransition, 60000 - elapsed);
    return () => clearTimeout(timeout);
  }, [nowPlaying, onTransition]);
}

export function useNowPlaying({ client, initialNowPlaying }: UseNowPlayingOptions) {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingUpdatePacket | null>(
    initialNowPlaying ?? null,
  );
  const [currentPositionMs, setCurrentPositionMs] = useState<number>(
    initialNowPlaying?.playback.positionMs ?? 0,
  );

  useNowPlayingSocket(client, (pkt) => {
    setNowPlaying((prev) => {
      const isStopped = pkt.playback.state === 'STOPPED' || pkt.playback.state === 'NONE';
      const mergedTrack = isStopped ? null : (pkt.track ?? prev?.track ?? null);
      return {
        ...pkt,
        track: mergedTrack,
      };
    });
    setCurrentPositionMs(pkt.playback.positionMs);
  });

  useInterpolationTimer(nowPlaying, setCurrentPositionMs);

  usePausedAutoTransition(nowPlaying, () => {
    setNowPlaying((prev) =>
      prev
        ? {
            ...prev,
            playback: { state: 'NONE', positionMs: 0, capturedAt: Date.now() },
            track: null,
          }
        : null,
    );
  });

  const track = nowPlaying?.track ?? null;
  const playbackStatus = nowPlaying?.playback ?? DEFAULT_PLAYBACK_STATUS;
  const durationMs = track?.durationMs ?? 0;

  return {
    track,
    playbackStatus,
    currentPositionMs,
    progressPercent: computeProgressPercent(currentPositionMs, durationMs),
    formattedCurrentTime: formatTrackTime(currentPositionMs),
    formattedDuration: formatTrackTime(durationMs),
  };
}
