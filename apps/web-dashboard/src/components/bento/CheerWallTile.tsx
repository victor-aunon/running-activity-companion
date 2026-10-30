'use client';

import React, { useState } from 'react';
import type { CheerItem } from '../../types/cheer';
import type { CheerPreset } from '@running-support/shared-contracts';
import { Megaphone, Send, ShieldAlert, HeartHandshake } from 'lucide-react';
import { formatShortTime, resolveCheerStatusConfig } from './CheerWallLogic';

export interface CheerWallTileProps {
  cheers: CheerItem[];
  onSendCheer: (preset: CheerPreset, body: string) => Promise<void>;
  pin?: string;
  activePin?: string;
  onPinChange?: (pin: string) => void;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  isSubmitting?: boolean;
  errorMsg?: string | null;
  rateLimitSeconds?: number;
  spectatorCount?: number;
  athleteName?: string;
  selectedPresetId?: CheerPreset | null;
  onPresetSelected?: (preset: CheerPreset | null) => void;
}

function CheerItemCard({ cheer }: { cheer: CheerItem }) {
  const fallbackReply = `${process.env.NEXT_PUBLIC_ATHLETE_NAME || 'Víctor'} te lo agradece`;
  const timeStr = formatShortTime(cheer.timestamp);
  const statusCfg = resolveCheerStatusConfig(cheer.status);

  return (
    <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/60 flex flex-col gap-1.5 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-bold text-slate-800 truncate">{cheer.senderName}</span>
          {timeStr && (
            <span className="text-[11px] font-medium text-slate-400 shrink-0">({timeStr})</span>
          )}
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${statusCfg.className}`}
        >
          {statusCfg.label}
        </span>
      </div>
      <p className="text-xs text-slate-600 italic">"{cheer.body}"</p>
      {cheer.status === 'AGRADECIDO' && (
        <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-purple-700 bg-purple-50 p-1.5 rounded-md border border-purple-200">
          <HeartHandshake className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span>{cheer.runnerReplyText || fallbackReply}</span>
        </div>
      )}
    </div>
  );
}

function CheerFeed({ displayCheers }: { displayCheers: CheerItem[] }) {
  if (displayCheers.length === 0) {
    return (
      <div className="border-t border-slate-100 pt-8 pb-4 flex-1 flex flex-col items-center justify-center text-center text-slate-400">
        <p className="text-xs font-semibold text-slate-600">Aún no hay mensajes de ánimo</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Sé el primero en enviar un mensaje al corredor.
        </p>
      </div>
    );
  }

  // Ordenar mensajes más recientes primero (orden cronológico inverso)
  const sortedCheers = [...displayCheers].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return (
    <div className="border-t border-slate-100 pt-3 flex-1 flex flex-col min-h-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        Mensajes Recientes ({displayCheers.length})
      </div>
      <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 max-h-[280px]">
        {sortedCheers.map((c) => (
          <CheerItemCard key={c.notificationId} cheer={c} />
        ))}
      </div>
    </div>
  );
}

function PresetButtons({
  disabled,
  selectedPresetId,
  onSend,
}: {
  disabled: boolean;
  selectedPresetId?: CheerPreset | null;
  onSend: (p: CheerPreset, t: string) => void;
}) {
  const isSelected = (p: CheerPreset) => selectedPresetId === p;
  return (
    <div className="grid grid-cols-3 gap-2 my-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSend('MUCHO_ANIMO', '¡Mucho ánimo!')}
        className={`py-2.5 px-2 rounded-xl bg-gradient-to-b from-indigo-50 to-indigo-100/60 text-indigo-700 font-bold text-xs border border-indigo-200/70 shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 ${isSelected('MUCHO_ANIMO') ? 'ring-2 ring-indigo-500 shadow-md' : ''}`}
      >
        <span className="text-base">🔥</span>
        <span className="leading-none text-center">¡Mucho ánimo!</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSend('TU_PUEDES', '¡Tú puedes!')}
        className={`py-2.5 px-2 rounded-xl bg-gradient-to-b from-teal-50 to-teal-100/60 text-teal-700 font-bold text-xs border border-teal-200/70 shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 ${isSelected('TU_PUEDES') ? 'ring-2 ring-teal-500 shadow-md' : ''}`}
      >
        <span className="text-base">⚡️</span>
        <span className="leading-none text-center">¡Tú puedes!</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSend('SIGUE_ASI', '¡Sigue así!')}
        className={`py-2.5 px-2 rounded-xl bg-gradient-to-b from-rose-50 to-rose-100/60 text-rose-700 font-bold text-xs border border-rose-200/70 shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 ${isSelected('SIGUE_ASI') ? 'ring-2 ring-rose-500 shadow-md' : ''}`}
      >
        <span className="text-base">🏃</span>
        <span className="leading-none text-center">¡Sigue así!</span>
      </button>
    </div>
  );
}

function CustomCheerForm({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [customText, setCustomText] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    onSend(customText.trim());
    setCustomText('');
  };
  return (
    <form onSubmit={handleSubmit} className="flex gap-2 my-2">
      <div className="relative flex-1">
        <input
          type="text"
          maxLength={50}
          placeholder="Escribe un mensaje de ánimo..."
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          disabled={disabled}
          className="w-full px-3.5 py-2 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder-slate-400 disabled:opacity-50"
        />
        <span className="absolute right-3 top-2.5 text-[10px] font-semibold text-slate-400">
          {customText.length}/50
        </span>
      </div>
      <button
        type="submit"
        disabled={disabled || !customText.trim()}
        className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-xl shadow-md shadow-orange-200 flex items-center justify-center disabled:opacity-50 transition-all"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  );
}

function CheerWallHeader({ spectatorCount }: { spectatorCount?: number }) {
  const subtitle =
    spectatorCount !== undefined
      ? `${spectatorCount} seguidores conectados ahora`
      : 'Comunidad en vivo';
  return (
    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
          <Megaphone className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Muro de Ánimos</h2>
          <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        </div>
      </div>
      <span
        className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"
        title="Feed en vivo"
      />
    </div>
  );
}

interface CheerActionSectionProps {
  athlete: string;
  isDisabled: boolean;
  onSendCheer: (preset: CheerPreset, body: string) => Promise<void>;
  errorMsg: string | null;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  selectedPresetId?: CheerPreset | null;
}

function SpectatorCredentialsInput({
  senderName,
  onSenderNameChange,
}: {
  senderName: string;
  onSenderNameChange: (name: string) => void;
}) {
  return (
    <div className="mb-2">
      <input
        type="text"
        placeholder="Tu nombre (ej. Laura)..."
        value={senderName}
        onChange={(e) => onSenderNameChange(e.target.value)}
        className="w-full px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
    </div>
  );
}

function CheerActionSection({
  athlete,
  isDisabled,
  onSendCheer,
  errorMsg,
  senderName,
  onSenderNameChange,
  selectedPresetId,
}: CheerActionSectionProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-1">
        Envía un ánimo rápido al reloj de {athlete}:
      </p>
      <SpectatorCredentialsInput senderName={senderName} onSenderNameChange={onSenderNameChange} />
      <PresetButtons
        disabled={isDisabled}
        selectedPresetId={selectedPresetId}
        onSend={(p, t) => void onSendCheer(p, t)}
      />
      <CustomCheerForm disabled={isDisabled} onSend={(t) => void onSendCheer('CUSTOM', t)} />
      {errorMsg && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs my-2">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

export function CheerWallTile({
  cheers,
  onSendCheer,
  senderName,
  onSenderNameChange,
  isSubmitting = false,
  errorMsg = null,
  rateLimitSeconds = 0,
  spectatorCount,
  athleteName,
  selectedPresetId,
}: CheerWallTileProps) {
  const isLocked = rateLimitSeconds > 0;
  const isDisabled = isSubmitting || isLocked;
  const athlete = athleteName || process.env.NEXT_PUBLIC_ATHLETE_NAME || 'Víctor';

  return (
    <div
      id="cheer-wall"
      className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-full min-h-[560px] justify-between scroll-mt-6"
    >
      <div>
        <CheerWallHeader spectatorCount={spectatorCount} />
        <CheerActionSection
          athlete={athlete}
          isDisabled={isDisabled}
          onSendCheer={onSendCheer}
          errorMsg={errorMsg}
          senderName={senderName}
          onSenderNameChange={onSenderNameChange}
          selectedPresetId={selectedPresetId}
        />
      </div>
      <CheerFeed displayCheers={cheers} />
    </div>
  );
}
