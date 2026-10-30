'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionButton } from '../components/ui/button';
import { Flame, KeyRound, ArrowRight } from 'lucide-react';
import { requestNotificationPermissionUpfront } from '../utils/notificationPermissions';

function LandingHeader() {
  const athlete = process.env.NEXT_PUBLIC_ATHLETE_NAME || 'Víctor';
  return (
    <div className="text-center space-y-2 mb-6">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100/80 text-orange-700 text-xs font-bold uppercase tracking-wider mb-2">
        <Flame className="w-3.5 h-3.5 text-orange-600" />
        Seguimiento Atlético en Vivo
      </div>
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
        Apoya a {athlete} en Carrera
      </h1>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        Introduce el identificador de sesión y el PIN de 4 dígitos proporcionado para ver la
        telemetría y enviar ánimos en directo.
      </p>
    </div>
  );
}

function TokenInputField({
  token,
  setToken,
  disabled,
}: {
  token: string;
  setToken: (t: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
        Identificador de Sesión / Token
      </label>
      <input
        type="text"
        disabled={disabled}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ej. carrera-victor"
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
      />
    </div>
  );
}

function PinInputField({
  pin,
  setPin,
  disabled,
}: {
  pin: string;
  setPin: (p: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
        PIN de Espectador (4 Dígitos)
      </label>
      <div className="relative">
        <input
          type="password"
          maxLength={4}
          disabled={disabled}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          className="w-full px-3.5 py-2.5 text-sm font-mono tracking-widest bg-slate-50/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
        />
        <KeyRound className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function SessionLookupForm({
  token,
  setToken,
  pin,
  setPin,
  error,
  isLoading,
  onSubmit,
}: {
  token: string;
  setToken: (t: string) => void;
  pin: string;
  setPin: (p: string) => void;
  error: string | null;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TokenInputField token={token} setToken={setToken} disabled={isLoading} />
      <PinInputField pin={pin} setPin={setPin} disabled={isLoading} />
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}
      <ActionButton
        type="submit"
        variant="primary"
        disabled={isLoading}
        className="w-full justify-center py-2.5 text-sm"
      >
        <span>{isLoading ? 'Verificando PIN...' : 'Conectar en Vivo'}</span>
        <ArrowRight className="w-4 h-4 ml-1" />
      </ActionButton>
    </form>
  );
}

function useSessionVerifier() {
  const router = useRouter();
  const [token, setToken] = useState('carrera-victor');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    const cleanPin = pin.trim();

    if (!cleanToken) {
      setError('Debes introducir un identificador de sesión.');
      return;
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('El PIN debe tener exactamente 4 dígitos.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/session/verify?token=${encodeURIComponent(cleanToken)}&pin=${encodeURIComponent(cleanPin)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setError(data.error || 'El PIN de 4 dígitos es incorrecto para esta sesión.');
        setIsLoading(false);
        return;
      }

      await requestNotificationPermissionUpfront();
      router.push(`/session/${encodeURIComponent(cleanToken)}?pin=${encodeURIComponent(cleanPin)}`);
    } catch {
      setError('No se pudo verificar el PIN con el servidor. Comprueba la conexión.');
      setIsLoading(false);
    }
  };

  return { token, setToken, pin, setPin, error, setError, isLoading, handleSubmit };
}

export default function SpectatorLandingPage() {
  const { token, setToken, pin, setPin, error, isLoading, handleSubmit } = useSessionVerifier();

  return (
    <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-lg mx-auto">
        <div className="bento-card p-6 md:p-8 shadow-xl">
          <LandingHeader />
          <SessionLookupForm
            token={token}
            setToken={setToken}
            pin={pin}
            setPin={setPin}
            error={error}
            isLoading={isLoading}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </main>
  );
}
