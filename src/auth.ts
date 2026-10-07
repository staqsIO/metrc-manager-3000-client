/**
 * METRC authentication helpers.
 *
 * - HMAC: Web Crypto API primary (Edge-safe), Node.js crypto fallback.
 * - Basic: btoa() primary, Buffer fallback.
 *
 * HMAC message format follows METRC's HMAC specification:
 *   `${method}\n${path}\n${body}\n${timestamp}`
 */

// ── Text encoder (shared) ──

const encoder = new TextEncoder();

// ── HMAC signing (async — Web Crypto) ──

/**
 * Sign a message with HMAC-SHA256 using Web Crypto (Edge-safe) with
 * a Node.js crypto fallback for environments without crypto.subtle.
 */
async function hmacSign(key: string, message: string): Promise<string> {
  // Prefer Web Crypto (works in Edge, Cloudflare Workers, Deno, Node 18+)
  if (typeof globalThis.crypto?.subtle?.importKey === 'function') {
    const keyData = encoder.encode(key);
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    return bufferToHex(sig);
  }

  // Fallback: Node.js crypto module
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHmac('sha256', key).update(message).digest('hex');
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// ── Public API ──

export interface HmacSignatureResult {
  signature: string;
  timestamp: string;
}

/**
 * Generate HMAC-SHA256 signature for METRC API authentication.
 *
 * Message format: `${method}\n${path}\n${body}\n${timestamp}`
 */
export async function generateHmacSignature(
  userApiKey: string,
  method: string,
  path: string,
  body: string = '',
): Promise<HmacSignatureResult> {
  const timestamp = Date.now().toString();
  const message = `${method}\n${path}\n${body}\n${timestamp}`;
  const signature = await hmacSign(userApiKey, message);
  return { signature, timestamp };
}

/**
 * Build headers for HMAC-authenticated requests.
 */
export async function buildHmacHeaders(
  vendorApiKey: string,
  userApiKey: string,
  method: string,
  path: string,
  body: string = '',
): Promise<Record<string, string>> {
  const { signature, timestamp } = await generateHmacSignature(userApiKey, method, path, body);
  return {
    'X-METRC-Vendor-API-Key': vendorApiKey,
    'X-METRC-User-API-Key': userApiKey,
    'X-METRC-Signature': signature,
    'X-METRC-Timestamp': timestamp,
  };
}

/**
 * Encode credentials for HTTP Basic auth (Edge-safe).
 * Uses btoa() when available, falls back to Buffer.
 */
export function encodeBasicAuth(vendorApiKey: string, userApiKey: string): string {
  const raw = `${vendorApiKey}:${userApiKey}`;
  let encoded: string;
  if (typeof globalThis.btoa === 'function') {
    encoded = globalThis.btoa(raw);
  } else if (typeof Buffer !== 'undefined') {
    encoded = Buffer.from(raw, 'utf-8').toString('base64');
  } else {
    throw new Error('No base64 encoder available (btoa or Buffer)');
  }
  return `Basic ${encoded}`;
}
