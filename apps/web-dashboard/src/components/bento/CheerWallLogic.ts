import type { CheerItem } from '../../types/cheer';
import type { CheerPreset } from '@running-support/shared-contracts';

export interface CheerStatusConfig {
  label: string;
  className: string;
}

export function formatShortTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function resolveCheerStatusConfig(status: CheerItem['status']): CheerStatusConfig {
  switch (status) {
    case 'EN_RELOJ':
    case 'ENVIADO':
      return {
        label: 'Enviado',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      };
    case 'AGRADECIDO':
      return {
        label: 'Agradecido',
        className: 'bg-purple-50 text-purple-700 border-purple-200/80',
      };
    case 'EXPIRADO':
      return {
        label: 'Expirado',
        className: 'bg-slate-100 text-slate-500 border-slate-200/80',
      };
    default:
      return {
        label: 'Enviado',
        className: 'bg-slate-50 text-slate-600 border-slate-200/80',
      };
  }
}

export interface CheerCredentialsConfig {
  hasPinInput: boolean;
  senderNameFullWidth: boolean;
  activePinRequired: boolean;
}

export function getCheerWallCredentialsConfig(): CheerCredentialsConfig {
  return {
    hasPinInput: false,
    senderNameFullWidth: true,
    activePinRequired: false,
  };
}

export function buildCheerPayload(
  senderName: string,
  presetId: CheerPreset,
  body: string,
  activePin?: string,
) {
  const trimmedName = senderName.trim();
  if (!trimmedName) {
    throw new Error('Por favor, indica tu nombre para enviar un mensaje de ánimo.');
  }
  return {
    senderName: trimmedName,
    presetId,
    body: body.trim(),
    pin: activePin || '',
  };
}
