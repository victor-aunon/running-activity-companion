/**
 * Resilient UUID v4 generator compatible with insecure contexts.
 *
 * Browsers (Chrome Android, iOS Safari) strictly hide `crypto.randomUUID` in insecure
 * contexts (e.g. accessing http://<LAN-IP>:3000 on mobile devices over Wi-Fi).
 * This utility uses native randomUUID when available, and falls back to
 * crypto.getRandomValues or Math.random to guarantee non-crashing execution.
 */
export function safeRandomUUID(): string {
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : (globalThis as any)?.crypto;

  // 1. Try native crypto.randomUUID (Secure contexts: HTTPS or desktop localhost)
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // Fallback
    }
  }

  // 2. Fallback to RFC 4122 v4 using crypto.getRandomValues (supported even in insecure contexts)
  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      globalCrypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Fallback
    }
  }

  // 3. Fallback using Math.random for legacy/degraded runtimes
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
