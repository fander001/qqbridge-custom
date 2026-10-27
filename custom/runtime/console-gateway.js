import crypto from 'node:crypto';

/** Only authenticated loopback proxy requests may use the configured HTTPS origin. */
export function consoleGateway(req, hostHeader, env = process.env) {
  // Explicit LAN gateway: backend stays loopback-only; gateway key is separate from console token.
  const gatewayOrigin = env.QQ_BRIDGE_CONSOLE_ORIGIN || '';
  const gatewayKey = env.QQ_BRIDGE_GATEWAY_KEY || '';
  const gatewayKeySupplied = String(req.headers['x-qq-gateway-key'] || '');
  const gatewayKeyMatches = gatewayKey.length >= 32
    && Buffer.byteLength(gatewayKey) === Buffer.byteLength(gatewayKeySupplied)
    && crypto.timingSafeEqual(Buffer.from(gatewayKey), Buffer.from(gatewayKeySupplied));
  let gatewayHost = '';
  try {
    const configured = new URL(gatewayOrigin);
    if (configured.protocol === 'https:' && configured.origin === gatewayOrigin) gatewayHost = configured.host;
  } catch {}
  const fromLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const gatewayRequest = Boolean(gatewayHost && hostHeader === gatewayHost && fromLoopback && gatewayKeyMatches);
  const crossOrigin = gatewayRequest && ((req.headers.origin && req.headers.origin !== gatewayOrigin)
    || (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin !== gatewayOrigin));
  return { gatewayRequest, crossOrigin: Boolean(crossOrigin) };
}
