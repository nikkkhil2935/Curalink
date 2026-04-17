import { gzipSync } from 'node:zlib';

const GZIP_LEVEL = Number.parseInt(process.env.GZIP_LEVEL || '6', 10);
const GZIP_MIN_BYTES = Number.parseInt(process.env.GZIP_MIN_BYTES || '1024', 10);

function toLowerString(value) {
  return String(value || '').toLowerCase();
}

function appendVary(existing, token) {
  const tokens = String(existing || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!tokens.some((part) => part.toLowerCase() === token.toLowerCase())) {
    tokens.push(token);
  }

  return tokens.join(', ');
}

function shouldBypassCompression(req, res, payloadBuffer) {
  if (!Buffer.isBuffer(payloadBuffer) || payloadBuffer.length < GZIP_MIN_BYTES) {
    return true;
  }

  if (req.method === 'HEAD' || res.statusCode === 204 || res.statusCode === 304) {
    return true;
  }

  if (res.getHeader('Content-Encoding')) {
    return true;
  }

  const acceptedEncodings = toLowerString(req.headers['accept-encoding']);
  if (!acceptedEncodings.includes('gzip')) {
    return true;
  }

  const contentType = toLowerString(res.getHeader('Content-Type') || 'application/json');
  return !contentType.includes('json') && !contentType.startsWith('text/');
}

export function gzipCompression() {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = (payload) => {
      let serialized;
      try {
        serialized = Buffer.from(JSON.stringify(payload));
      } catch {
        return originalJson(payload);
      }

      if (shouldBypassCompression(req, res, serialized)) {
        return originalJson(payload);
      }

      try {
        const compressed = gzipSync(serialized, {
          level: Math.min(9, Math.max(1, GZIP_LEVEL))
        });

        if (compressed.length >= serialized.length) {
          return originalJson(payload);
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', appendVary(res.getHeader('Vary'), 'Accept-Encoding'));
        res.removeHeader('Content-Length');

        return originalSend(compressed);
      } catch {
        return originalJson(payload);
      }
    };

    next();
  };
}
