import http from 'http';
import { logger } from '../utils/logger.js';

export function startKeepAliveServer(port: number | string = 3002) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Beyond The Final Whistle (BTFW) Football RPG',
      uptime: process.uptime()
    }));
  });

  server.listen(port, () => {
    logger.info(`BTFW Health check HTTP server listening on port ${port}`);
  });

  return server;
}
