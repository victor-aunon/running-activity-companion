import React from 'react';
import { SpectatorAccessCard } from '../components/landing/SpectatorAccessCard';
import { resolveDashboardRuntimeConfig } from '../utils/runtimeConfig';

export const dynamic = 'force-dynamic';

export default function SpectatorLandingPage() {
  const runtimeConfig = resolveDashboardRuntimeConfig();

  return (
    <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-lg mx-auto">
        <SpectatorAccessCard athleteName={runtimeConfig.athleteName} />
      </div>
    </main>
  );
}
