import http from 'http';
import { logger } from '../utils/logger.js';

let keepAliveInterval: NodeJS.Timeout | null = null;

export function resolveKeepAliveUrl(port: number | string = 3002): string {
  const explicit = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim().replace(/\/+$/, '') + '/';
  }

  // Local development fallback
  if (process.env.NODE_ENV === 'development' || !process.env.RENDER_EXTERNAL_URL) {
    return `http://127.0.0.1:${port}/`;
  }

  return 'https://beyond-the-final-whistle.onrender.com/';
}

export function startKeepAliveServer(port: number | string = 3002): http.Server {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Beyond The Final Whistle (BTFW) Football RPG',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  });

  server.listen(Number(port), '0.0.0.0', () => {
    logger.info(`BTFW Health check HTTP server listening on port ${port} (0.0.0.0)`);
  });

  return server;
}

export async function pingHealthEndpoint(targetUrl: string): Promise<{ success: boolean; status: number; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'BTFW-KeepAlive-Worker/1.0',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15_000),
    });

    const latencyMs = Date.now() - start;
    if (response.ok) {
      return { success: true, status: response.status, latencyMs };
    }

    const text = await response.text().catch(() => '');
    return {
      success: false,
      status: response.status,
      latencyMs,
      error: `HTTP ${response.status}: ${text.slice(0, 150)}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return {
      success: false,
      status: 0,
      latencyMs,
      error: err?.message || String(err),
    };
  }
}

/**
 * Anti-snoozing worker: runs every 9 minutes (540,000 ms) to keep host/Render active 24/7.
 */
export function startKeepAliveWorker(port: number | string = 3002, intervalMs: number = 9 * 60 * 1000): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }

  const targetUrl = resolveKeepAliveUrl(port);
  logger.info({ targetUrl, intervalMinutes: Math.round(intervalMs / 60000) }, 'Starting BTFW Keep-Alive anti-snooze worker (9min interval)');

  // Initial self-ping after 15 seconds
  setTimeout(async () => {
    const res = await pingHealthEndpoint(targetUrl);
    if (res.success) {
      logger.info({ targetUrl, latencyMs: res.latencyMs }, 'Initial keep-alive anti-snooze health ping successful');
    } else {
      logger.warn({ targetUrl, error: res.error }, 'Initial keep-alive ping returned non-200 or pending host');
    }
  }, 15_000);

  // Recurring 9-minute interval
  keepAliveInterval = setInterval(async () => {
    const res = await pingHealthEndpoint(targetUrl);
    if (res.success) {
      logger.info({ targetUrl, latencyMs: res.latencyMs }, 'Keep-alive self-ping successful (Host anti-snoozed 24/7)');
    } else {
      logger.warn({ targetUrl, error: res.error }, 'Keep-alive self-ping failed');
    }
  }, intervalMs);
}

export function stopKeepAliveWorker(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    logger.info('Keep-alive worker stopped');
  }
}
