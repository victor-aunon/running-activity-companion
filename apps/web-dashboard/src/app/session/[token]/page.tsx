import React, { Suspense } from 'react';
import { SessionDashboardInner } from '../../../components/session/SessionDashboardInner';
import { resolveDashboardRuntimeConfig } from '../../../utils/runtimeConfig';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SessionLivePage({ params }: PageProps) {
  const { token } = await params;
  const runtimeConfig = resolveDashboardRuntimeConfig();

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50/70" />}>
      <SessionDashboardInner
        token={token}
        athleteName={runtimeConfig.athleteName}
        runtimeConfig={runtimeConfig}
      />
    </Suspense>
  );
}
