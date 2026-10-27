import { NextRequest, NextResponse } from 'next/server';

function resolveRelayUrl(): string {
  if (process.env.RELAY_HTTP_URL) return process.env.RELAY_HTTP_URL;
  if (process.env.NEXT_PUBLIC_WS_URL) {
    try {
      const parsed = new URL(process.env.NEXT_PUBLIC_WS_URL);
      const protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
      return `${protocol}//${parsed.host}/api/session/verify`;
    } catch {
      // Fallback
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return `http://127.0.0.1:${process.env.PORT || '3000'}/api/session/verify`;
  }
  return 'http://127.0.0.1:3001/api/session/verify';
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const pin = (req.nextUrl.searchParams.get('pin') || '').trim();

  if (!token || !pin) {
    return NextResponse.json(
      { valid: false, error: 'Token y PIN son obligatorios.' },
      { status: 400 },
    );
  }

  const relayUrl = resolveRelayUrl();

  try {
    const res = await fetch(
      `${relayUrl}?token=${encodeURIComponent(token)}&pin=${encodeURIComponent(pin)}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        valid: false,
        error:
          'No se puede conectar con el servidor Relay. Comprueba que el servicio esté encendido.',
      },
      { status: 503 },
    );
  }
}
