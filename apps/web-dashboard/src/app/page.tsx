import React from 'react';
import { SpectatorAccessCard } from '../components/landing/SpectatorAccessCard';

export const dynamic = 'force-dynamic';

export default function SpectatorLandingPage() {
  const athleteName = process.env.NEXT_PUBLIC_ATHLETE_NAME?.trim() || 'Víctor';

  return (
    <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-lg mx-auto">
        <SpectatorAccessCard athleteName={athleteName} />
      </div>
    </main>
  );
}
