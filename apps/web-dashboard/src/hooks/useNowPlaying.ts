import { useState, useEffect, useRef } from 'react';
import type {
  NowPlayingUpdatePacket,
  RunnerPlaybackStatus,
  RunnerTrackInfo,
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

function normalizeTrack(rawTrack: any): RunnerTrackInfo | null {
  if (!rawTrack || typeof rawTrack !== 'object') return null;
  const trackId = String(rawTrack.trackId || 'unknown');
  return {
    trackId,
    title: String(rawTrack.title || 'Pista'),
    artist: String(rawTrack.artist || 'Artista'),
    album: rawTrack.album ? String(rawTrack.album) : undefined,
    artworkUrl: rawTrack.artworkUrl ? String(rawTrack.artworkUrl) : undefined,
    durationMs: Number(rawTrack.durationMs || 0),
    spotifyUrl: String(rawTrack.spotifyUrl || `https://open.spotify.com/track/${trackId}`),
  };
}

function normalizePlayback(rawPlayback: any): RunnerPlaybackStatus {
  return {
    state: rawPlayback?.state || 'NONE',
    positionMs: Number(rawPlayback?.positionMs || 0),
    capturedAt: Number(rawPlayback?.capturedAt || Date.now()),
    isLiveSync: Boolean(rawPlayback?.isLiveSync),
  };
}

function normalizeNowPlayingPacket(raw: Record<string, any>): NowPlayingUpdatePacket {
  return {
    type: 'NOW_PLAYING_UPDATE',
    sessionId: String(raw.sessionId || ''),
    timestamp: Number(raw.timestamp || Date.now()),
    playback: normalizePlayback(raw.playback),
    track: normalizeTrack(raw.track),
  };
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
      } else if (msg && typeof msg === 'object' && (msg as any).type === 'NOW_PLAYING_UPDATE') {
        handlerRef.current(normalizeNowPlayingPacket(msg as Record<string, any>));
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
  const onTransitionRef = useRef(onTransition);
  onTransitionRef.current = onTransition;

  useEffect(() => {
    if (!nowPlaying || nowPlaying.playback.state !== 'PAUSED') return;

    const elapsed = Math.max(0, Date.now() - nowPlaying.playback.capturedAt);
    if (elapsed >= 60000) {
      onTransitionRef.current();
      return;
    }

    const timeout = setTimeout(() => {
      onTransitionRef.current();
    }, 60000 - elapsed);
    return () => clearTimeout(timeout);
  }, [nowPlaying?.playback.state, nowPlaying?.playback.capturedAt]);
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
