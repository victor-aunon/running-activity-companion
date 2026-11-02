import React, { Suspense } from 'react';
import { SessionDashboardInner } from '../../../components/session/SessionDashboardInner';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SessionLivePage({ params }: PageProps) {
  const { token } = await params;
  const runtimeAthlete = process.env.NEXT_PUBLIC_ATHLETE_NAME?.trim() || 'Víctor';

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50/70" />}>
      <SessionDashboardInner token={token} athleteName={runtimeAthlete} />
    </Suspense>
  );
}
