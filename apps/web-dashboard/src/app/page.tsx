'use client';

import React from 'react';
import { SpectatorAccessCard } from '../components/landing/SpectatorAccessCard';

export default function SpectatorLandingPage() {
  return (
    <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-lg mx-auto">
        <SpectatorAccessCard />
      </div>
    </main>
  );
}
