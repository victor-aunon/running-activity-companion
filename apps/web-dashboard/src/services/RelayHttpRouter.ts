import type { IncomingMessage, ServerResponse } from 'node:http';
import { parse, type UrlWithParsedQuery } from 'node:url';
import type { createRelayServer } from './RelayServerLogic.ts';

export type RelayServerInstance = ReturnType<typeof createRelayServer>;

export interface RelayHttpOptions {
  parsedUrl?: UrlWithParsedQuery;
  recentLogs?: string[];
}

function handleDebugRoute(
  pathname: string,
  res: ServerResponse,
  relay: RelayServerInstance,
  options: { parsedUrl: UrlWithParsedQuery; recentLogs?: string[] },
): boolean {
  if (pathname === '/api/debug/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end((options.recentLogs || []).join('\n'));
    return true;
  }
  if (pathname === '/api/debug/rooms') {
    const token = (options.parsedUrl.query.token as string) || '';
    const data = token ? relay.getRoomDetails(token) : relay.getAllRooms();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data, null, 2));
    return true;
  }
  return false;
}

function handleSessionVerifyAndPath(
  pathname: string,
  parsedUrl: UrlWithParsedQuery,
  res: ServerResponse,
  relay: RelayServerInstance,
): boolean {
  if (pathname === '/api/session/verify') {
    const token = (parsedUrl.query.token as string) || '';
    const pin = (parsedUrl.query.pin as string) || '';
    const result = relay.verifySession(token, pin);
    res.writeHead(result.valid ? 200 : 401, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(result));
    return true;
  }
  if (pathname === '/api/session/path') {
    const token = ((parsedUrl.query.token as string) || '').toString();
    const coordinates = relay.getPathHistory ? relay.getPathHistory(token) : [];
    const kmMarkers = relay.getKmMarkers ? relay.getKmMarkers(token) : [];
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ coordinates, kmMarkers }));
    return true;
  }
  return false;
}

export interface VerifySessionResult {
  valid: boolean;
  error?: string;
}

function handleSessionStream(
  parsedUrl: UrlWithParsedQuery,
  req: IncomingMessage,
  res: ServerResponse,
  relay: RelayServerInstance,
): boolean {
  if (parsedUrl.pathname !== '/api/session/stream') return false;

  const token = ((parsedUrl.query.token as string) || '').toString().trim().toLowerCase();
  const pin = ((parsedUrl.query.pin as string) || '').toString().trim();

  const verify: VerifySessionResult = relay.verifySession
    ? relay.verifySession(token, pin)
    : { valid: true };
  if (!verify.valid && verify.error) {
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ error: verify.error }));
    return true;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });
  if (
    'flushHeaders' in res &&
    typeof (res as ServerResponse & { flushHeaders?: () => void }).flushHeaders === 'function'
  ) {
    (res as ServerResponse & { flushHeaders: () => void }).flushHeaders();
  }

  const backlog = relay.getSpectatorBacklogMessages ? relay.getSpectatorBacklogMessages(token) : [];
  for (const msg of backlog) {
    res.write(`data: ${msg}\n\n`);
  }

  const unsubscribe = relay.subscribeSseSpectator
    ? relay.subscribeSseSpectator(token, (payload) => res.write(`data: ${payload}\n\n`))
    : () => {};

  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) {
      try {
        res.write(`: ping\n\n`);
      } catch {
        // Stream closed
      }
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
  return true;
}

function handleSessionCheer(
  req: IncomingMessage,
  res: ServerResponse,
  relay: RelayServerInstance,
): boolean {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }
  if (req.method !== 'POST') return false;

  let rawBody = '';
  req.on('data', (c) => (rawBody += c));
  req.on('end', () => {
    try {
      const payload = JSON.parse(rawBody || '{}');
      const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
        .toString()
        .split(',')[0]
        .trim();
      const result = relay.dispatchCheerHttp
        ? relay.dispatchCheerHttp(payload, clientIp)
        : { success: false, status: 500, message: 'Relay no disponible' };
      res.writeHead(result.status || (result.success ? 200 : 400), {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ success: false, error: 'JSON malformado' }));
    }
  });
  return true;
}

type GatewayActionHandler = (payload: any, relay: RelayServerInstance) => any;

const gatewayActionMap: Record<string, GatewayActionHandler> = {
  '/api/gateway/session': (payload, relay) =>
    relay.registerGatewayHttp ? relay.registerGatewayHttp(payload) : { status: 'READY' },
  '/api/gateway/telemetry': (payload, relay) =>
    relay.ingestTelemetryHttp
      ? relay.ingestTelemetryHttp(payload)
      : { status: 'OK', pendingCheers: [] },
  '/api/gateway/now-playing': (payload, relay) =>
    relay.ingestNowPlayingHttp ? relay.ingestNowPlayingHttp(payload) : { status: 'OK' },
  '/api/gateway/session/complete': (payload, relay) =>
    relay.completeSessionHttp ? relay.completeSessionHttp(payload) : { status: 'OK' },
  '/api/gateway/cheer-ack': (payload, relay) =>
    relay.ackCheerHttp ? relay.ackCheerHttp(payload) : { status: 'OK' },
};

function dispatchGatewayAction(pathname: string, payload: any, relay: RelayServerInstance): any {
  const handler = gatewayActionMap[pathname];
  return handler ? handler(payload, relay) : { status: 'OK' };
}

function handleGatewayRoute(
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
  relay: RelayServerInstance,
): boolean {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }
  if (req.method !== 'POST') return false;

  let rawBody = '';
  req.on('data', (c) => (rawBody += c));
  req.on('end', () => {
    try {
      const payload = JSON.parse(rawBody || '{}');
      const result = dispatchGatewayAction(pathname, payload, relay);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: 'JSON malformado' }));
    }
  });
  return true;
}

export function handleRelayHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  relay: RelayServerInstance,
  options?: UrlWithParsedQuery | RelayHttpOptions,
): boolean {
  const parsedUrl =
    options && 'pathname' in options
      ? (options as UrlWithParsedQuery)
      : (options as RelayHttpOptions)?.parsedUrl || parse(req.url || '', true);
  const recentLogs =
    options && 'recentLogs' in options ? (options as RelayHttpOptions).recentLogs : undefined;
  const pathname = parsedUrl.pathname || '';

  if (handleDebugRoute(pathname, res, relay, { parsedUrl, recentLogs })) return true;
  if (handleSessionVerifyAndPath(pathname, parsedUrl, res, relay)) return true;
  if (handleSessionStream(parsedUrl, req, res, relay)) return true;
  if (pathname === '/api/session/cheer' && handleSessionCheer(req, res, relay)) return true;
  if (pathname.startsWith('/api/gateway/') && handleGatewayRoute(pathname, req, res, relay))
    return true;

  return false;
}
