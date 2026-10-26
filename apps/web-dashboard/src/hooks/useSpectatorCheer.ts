/**
 * Hook for Spectator Cheers dispatch and local timeline tracking
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  CheerPreset,
  ProtocolError,
  WebSocketDownlinkMessage,
} from '@running-support/shared-contracts';
import type { WebSocketClient } from '../services/WebSocketClient';
import type { CheerItem } from '../types/cheer';

export interface UseSpectatorCheerOptions {
  client?: WebSocketClient | null;
  sessionId?: string;
  initialCheers?: CheerItem[];
  initialPin?: string;
  initialSenderName?: string;
}

function updateCheerList(prev: CheerItem[], msg: any): CheerItem[] {
  const index = prev.findIndex((c) => c.notificationId === msg.notificationId);
  if (index >= 0) {
    const updated = [...prev];
    updated[index] = {
      ...updated[index],
      status: msg.status,
      runnerReplyText: msg.runnerReplyText,
    };
    return updated;
  }
  return [
    {
      notificationId: msg.notificationId,
      senderName: msg.senderName || 'Espectador',
      body: msg.body || '¡Ánimo!',
      status: msg.status,
      runnerReplyText: msg.runnerReplyText,
      timestamp: msg.timestamp || Date.now(),
    },
    ...prev,
  ];
}

interface SocketEventListenerParams {
  client: WebSocketClient | null;
  setCheers: React.Dispatch<React.SetStateAction<CheerItem[]>>;
  setRateLimitSeconds: (secs: number) => void;
  setError: (err: string | null) => void;
  setSubmitting: (sub: boolean) => void;
}

function handleProtocolError(
  msg: WebSocketDownlinkMessage,
  setRateLimit: (s: number) => void,
  setError: (e: string | null) => void,
) {
  const errMsg = msg as ProtocolError;
  if (errMsg.code === 'PIN_RATE_LIMITED') {
    setRateLimit(60);
    setError('Demasiados intentos fallidos. Bloqueado temporalmente durante 60s.');
  } else if (errMsg.code === 'UNAUTHORIZED_PIN') {
    setError('PIN de espectador incorrecto. El mensaje ha sido rechazado.');
  } else {
    setError(errMsg.message || 'Error en la solicitud');
  }
}

function useRateLimitCountdown(
  seconds: number,
  setSeconds: React.Dispatch<React.SetStateAction<number>>,
) {
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [seconds, setSeconds]);
}

function useCheerSocketEvents(params: SocketEventListenerParams) {
  const { client, setCheers, setRateLimitSeconds, setError, setSubmitting } = params;
  useEffect(() => {
    if (!client) return;
    const unsubscribe = client.onMessage((msg: WebSocketDownlinkMessage) => {
      if (msg.type === 'CHEER_STATUS_UPDATE') {
        setCheers((prev) => updateCheerList(prev, msg));
      } else if (msg.type === 'ERROR') {
        setSubmitting(false);
        handleProtocolError(msg, setRateLimitSeconds, setError);
      }
    });
    return () => unsubscribe();
  }, [client, setCheers, setRateLimitSeconds, setError, setSubmitting]);
}

interface DispatchCheerParams {
  client: WebSocketClient | null;
  sessionId?: string;
  pin: string;
  senderName: string;
}

function sendCheerPacket(
  params: DispatchCheerParams,
  presetId: CheerPreset,
  body: string,
): { success: boolean; notificationId?: string } {
  const { client, sessionId, pin, senderName } = params;
  if (!client || !sessionId) return { success: false };
  const notificationId = crypto.randomUUID();
  const displayName = senderName.trim();
  const command = {
    type: 'DISPATCH_CHEER' as const,
    notificationId,
    sessionId,
    spectatorPin: pin.trim(),
    senderName: displayName,
    presetId,
    body: body.substring(0, 50),
    ttlSeconds: 60,
  };
  const sent = client.send(command);
  if (!sent) return { success: false };
  return { success: true, notificationId };
}

interface CheerSenderState {
  client: WebSocketClient | null;
  sessionId?: string;
  pin: string;
  senderName: string;
  rateLimitSeconds: number;
  setSubmitting: (b: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
  setCheers: React.Dispatch<React.SetStateAction<CheerItem[]>>;
}

function executeCheerSend(state: CheerSenderState, presetId: CheerPreset, body: string) {
  const { client, sessionId, pin, senderName, rateLimitSeconds, setSubmitting, setErrorMsg } =
    state;
  if (rateLimitSeconds > 0) return;
  if (!senderName.trim()) {
    setErrorMsg('Por favor, indica tu nombre para enviar un mensaje de ánimo.');
    return;
  }
  if (!/^\d{4}$/.test(pin.trim())) {
    setErrorMsg('El PIN debe contener exactamente 4 dígitos.');
    return;
  }
  setErrorMsg(null);
  setSubmitting(true);
  const res = sendCheerPacket({ client, sessionId, pin, senderName }, presetId, body);
  if (!res.success) {
    setErrorMsg('No hay conexión con el servidor. Reconectando...');
  }
  setSubmitting(false);
}

function useCheerState(initialPin: string, initialSenderName: string, initialCheers: CheerItem[]) {
  const [pin, setPin] = useState(initialPin);
  const [senderName, setSenderName] = useState(initialSenderName);
  const [cheers, setCheers] = useState<CheerItem[]>(initialCheers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  return {
    pin,
    setPin,
    senderName,
    setSenderName,
    cheers,
    setCheers,
    isSubmitting,
    setIsSubmitting,
    errorMsg,
    setErrorMsg,
    rateLimitSeconds,
    setRateLimitSeconds,
  };
}

function useCheerSender(state: {
  client: WebSocketClient | null;
  sessionId?: string;
  pin: string;
  senderName: string;
  rateLimitSeconds: number;
  setIsSubmitting: (b: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
  setCheers: React.Dispatch<React.SetStateAction<CheerItem[]>>;
}) {
  return useCallback(
    async (presetId: CheerPreset, body: string) => {
      executeCheerSend(
        {
          client: state.client,
          sessionId: state.sessionId,
          pin: state.pin,
          senderName: state.senderName,
          rateLimitSeconds: state.rateLimitSeconds,
          setSubmitting: state.setIsSubmitting,
          setErrorMsg: state.setErrorMsg,
          setCheers: state.setCheers,
        },
        presetId,
        body,
      );
    },
    [
      state.client,
      state.sessionId,
      state.pin,
      state.senderName,
      state.rateLimitSeconds,
      state.setCheers,
      state.setErrorMsg,
      state.setIsSubmitting,
    ],
  );
}

export function useSpectatorCheer({
  client = null,
  sessionId,
  initialCheers = [],
  initialPin = '',
  initialSenderName = '',
}: UseSpectatorCheerOptions = {}) {
  const state = useCheerState(initialPin, initialSenderName, initialCheers);

  useRateLimitCountdown(state.rateLimitSeconds, state.setRateLimitSeconds);
  useCheerSocketEvents({
    client,
    setCheers: state.setCheers,
    setRateLimitSeconds: state.setRateLimitSeconds,
    setError: state.setErrorMsg,
    setSubmitting: state.setIsSubmitting,
  });

  const sendCheer = useCheerSender({
    client,
    sessionId,
    pin: state.pin,
    senderName: state.senderName,
    rateLimitSeconds: state.rateLimitSeconds,
    setIsSubmitting: state.setIsSubmitting,
    setErrorMsg: state.setErrorMsg,
    setCheers: state.setCheers,
  });

  return {
    pin: state.pin,
    setPin: state.setPin,
    senderName: state.senderName,
    setSenderName: state.setSenderName,
    cheers: state.cheers,
    isSubmitting: state.isSubmitting,
    errorMsg: state.errorMsg,
    rateLimitSeconds: state.rateLimitSeconds,
    sendCheer,
  };
}
