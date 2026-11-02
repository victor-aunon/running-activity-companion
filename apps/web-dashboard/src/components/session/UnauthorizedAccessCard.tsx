import React from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';

export function UnauthorizedAccessCard({ token }: { token: string }) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-slate-50/70 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-2xl border border-red-200 shadow-xl p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Acceso no autorizado</h2>
        <p className="text-sm text-slate-600">
          El PIN de 4 dígitos proporcionado para la sesión &ldquo;{token}&rdquo; es incorrecto.
        </p>
        <button
          onClick={() => router.push('/')}
          className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          Volver a Introducir PIN
        </button>
      </div>
    </main>
  );
}
