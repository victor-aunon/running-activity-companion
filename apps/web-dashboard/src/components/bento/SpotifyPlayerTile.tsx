'use client';

import React, { useState } from 'react';
import type { RunnerTrackInfo, RunnerPlaybackStatus } from '@running-support/shared-contracts';
import { Music, ExternalLink, Disc3, Radio } from 'lucide-react';
import { formatTrackTime } from '../../hooks/useNowPlaying';

export interface SpotifyPlayerTileProps {
  track: RunnerTrackInfo | null;
  playbackStatus: RunnerPlaybackStatus;
  currentPositionMs?: number;
  athleteName?: string;
  className?: string;
}

function IdlePlayerCard({ athleteName }: { athleteName?: string }) {
  const message = athleteName
    ? `No se está reproduciendo nada en el teléfono de ${athleteName}`
    : 'No se está reproduciendo nada en el teléfono del corredor';

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
        <Music className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-slate-600 leading-snug">{message}</p>
    </div>
  );
}

function TrackHeader({ state, spotifyUrl }: { state: string; spotifyUrl: string }) {
  const isPlaying = state === 'PLAYING';
  const label = isPlaying ? 'Spotify en Directo' : 'Pausado';
  const dotColor = isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-600" />
          {label}
        </span>
      </div>
      <a
        href={spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
      >
        <span>Abrir en Spotify</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

function TrackMetadataRow({ track }: { track: RunnerTrackInfo }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {track.artworkUrl && !imgError ? (
        <img
          src={track.artworkUrl}
          alt={track.title}
          className="w-12 h-12 rounded-lg object-cover shadow-xs shrink-0"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
          <Disc3 className="w-6 h-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold text-slate-800 truncate leading-snug">{track.title}</h4>
        <p className="text-xs text-slate-500 truncate mt-0.5">{track.artist}</p>
      </div>
    </div>
  );
}

function TrackProgressBar({ currentMs, durationMs }: { currentMs: number; durationMs: number }) {
  const percent = durationMs > 0 ? Math.min(100, (currentMs / durationMs) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
        <span>{formatTrackTime(currentMs)}</span>
        <span>{formatTrackTime(durationMs)}</span>
      </div>
    </div>
  );
}

function SpotifyEmbedPlayer({ trackId }: { trackId: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const cleanTrackId = trackId.replace('spotify:track:', '');
  const embedUrl = `https://open.spotify.com/embed/track/${cleanTrackId}?utm_source=generator&theme=0`;

  return (
    <div className="w-full pt-1 relative min-h-[80px]">
      {isLoading && (
        <div className="absolute inset-x-0 top-1 h-20 bg-slate-100 animate-pulse rounded-xl" />
      )}
      <iframe
        src={embedUrl}
        width="100%"
        height="80"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className={`rounded-xl border-0 shadow-xs transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        title="Reproductor Spotify en Vivo"
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}

export function SpotifyPlayerTile({
  track,
  playbackStatus,
  currentPositionMs = 0,
  athleteName,
  className = '',
}: SpotifyPlayerTileProps) {
  const isIdle = playbackStatus.state === 'NONE' || playbackStatus.state === 'STOPPED' || !track;

  return (
    <div
      className={`relative bg-white/85 backdrop-blur-md rounded-2xl p-4 border border-slate-200/60 shadow-xs flex flex-col gap-3 transition-all duration-300 ${className}`}
    >
      {isIdle ? (
        <IdlePlayerCard athleteName={athleteName} />
      ) : (
        <>
          <TrackHeader state={playbackStatus.state} spotifyUrl={track.spotifyUrl} />
          <TrackMetadataRow track={track} />
          <TrackProgressBar currentMs={currentPositionMs} durationMs={track.durationMs} />
          <SpotifyEmbedPlayer trackId={track.trackId} />
        </>
      )}
    </div>
  );
}
