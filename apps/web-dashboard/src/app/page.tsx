'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionButton } from '../components/ui/button';
import { StatusBadge } from '../components/ui/badge';
import { Flame, KeyRound, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

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

function TokenInputField({ token, setToken }: { token: string; setToken: (t: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
        Identificador de Sesión / Token
      </label>
      <input
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ej. maraton-madrid-2026"
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>
  );
}

function PinInputField({ pin, setPin }: { pin: string; setPin: (p: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
        PIN de Espectador (4 Dígitos)
      </label>
      <div className="relative">
        <input
          type="password"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          className="w-full px-3.5 py-2.5 text-sm font-mono tracking-widest bg-slate-50/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
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
  onSubmit,
}: {
  token: string;
  setToken: (t: string) => void;
  pin: string;
  setPin: (p: string) => void;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TokenInputField token={token} setToken={setToken} />
      <PinInputField pin={pin} setPin={setPin} />
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}
      <ActionButton
        type="submit"
        variant="primary"
        className="w-full justify-center py-2.5 text-sm"
      >
        <span>Conectar en Vivo</span>
        <ArrowRight className="w-4 h-4 ml-1" />
      </ActionButton>
    </form>
  );
}

function DemoQuickAccessCard({ onQuickConnect }: { onQuickConnect: () => void }) {
  return (
    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-semibold text-slate-700">Sesión Activa Detectada</span>
        <StatusBadge variant="live">EN VIVO</StatusBadge>
      </div>
      <button
        type="button"
        onClick={onQuickConnect}
        className="text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors inline-flex items-center gap-1"
      >
        <span>Acceso Rápido</span>
        <ShieldCheck className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function SpectatorLandingPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Debes introducir un identificador de sesión.');
      return;
    }
    if (!/^\d{4}$/.test(pin.trim())) {
      setError('El PIN debe tener exactamente 4 dígitos.');
      return;
    }
    setError(null);
    router.push(
      `/session/${encodeURIComponent(token.trim())}?pin=${encodeURIComponent(pin.trim())}`,
    );
  };

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
            onSubmit={handleSubmit}
          />
          <DemoQuickAccessCard
            onQuickConnect={() =>
              router.push(
                `/session/${encodeURIComponent(token.trim() || 'live-session')}?pin=${encodeURIComponent(pin.trim() || '4829')}`,
              )
            }
          />
        </div>
      </div>
    </main>
  );
}
