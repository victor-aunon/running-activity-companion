import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const pin = req.nextUrl.searchParams.get('pin') || '';

  if (!token || !pin) {
    return NextResponse.json(
      { valid: false, error: 'Token y PIN son obligatorios.' },
      { status: 400 },
    );
  }

  const relayUrl =
    process.env.RELAY_HTTP_URL ||
    (process.env.NODE_ENV === 'production'
      ? `http://127.0.0.1:${process.env.PORT || '3000'}/api/session/verify`
      : 'http://127.0.0.1:3001/api/session/verify');

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
