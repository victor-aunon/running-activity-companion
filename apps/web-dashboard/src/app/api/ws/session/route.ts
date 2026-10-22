import { NextRequest } from 'next/server';

/**
 * Next.js API Route for WebSocket Session Relay
 * Used for HTTP fallback and session status inspections
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  return new Response(
    JSON.stringify({
      status: 'UP',
      token: token || 'unspecified',
      protocol: 'ws://',
      supportedEvents: [
        'TELEMETRY_SNAPSHOT',
        'SESSION_STATE_CHANGED',
        'DISPATCH_CHEER',
        'CHEER_STATUS_UPDATE',
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
