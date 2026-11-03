/**
 * Registers the dashboard Service Worker (/sw.js) for handling
 * OS-level background notifications and mobile platform support.
 */
export async function registerDashboardServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  const globalObj = typeof window !== 'undefined' ? window : (globalThis as any);
  if (
    !globalObj ||
    typeof globalObj.navigator === 'undefined' ||
    !('serviceWorker' in globalObj.navigator)
  ) {
    return null;
  }

  try {
    return await globalObj.navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('[ServiceWorker] Registration failed:', err);
    return null;
  }
}
