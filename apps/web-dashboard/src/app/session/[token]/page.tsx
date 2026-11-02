'use client';

import React, { Suspense, use } from 'react';
import { SessionDashboardInner } from '../../../components/session/SessionDashboardInner';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function SessionLivePage({ params }: PageProps) {
  const { token } = use(params);

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50/70" />}>
      <SessionDashboardInner token={token} />
    </Suspense>
  );
}
