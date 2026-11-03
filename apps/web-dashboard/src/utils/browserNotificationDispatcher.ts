/**
 * Dispatches a native browser/OS notification using ServiceWorkerRegistration.showNotification()
 * when available (enabling background OS notifications and mobile Chrome compatibility),
 * falling back gracefully to the window Notification constructor.
 */
export async function dispatchBrowserNotification(
  notif: { title: string; message: string; type?: string },
  options: { url?: string; icon?: string; badge?: string } = {},
): Promise<boolean> {
  const globalObj = typeof window !== 'undefined' ? window : (globalThis as any);
  if (!globalObj || typeof globalObj.Notification === 'undefined') {
    return false;
  }

  const NotificationApi = globalObj.Notification;
  if (NotificationApi.permission !== 'granted') {
    return false;
  }

  const targetUrl =
    options.url || (typeof globalObj.location !== 'undefined' ? globalObj.location.href : '/');

  const notificationOptions = {
    body: notif.message,
    icon: options.icon || '/icon.svg',
    badge: options.badge || '/icon.svg',
    tag: `running-support-${notif.type || 'alert'}`,
    data: {
      url: targetUrl,
    },
  };

  // 1. Prefer Service Worker registration (OS-level notifications on Desktop & Android Chrome)
  const nav = globalObj.navigator;
  if (nav && 'serviceWorker' in nav && nav.serviceWorker?.ready) {
    try {
      const registration = await nav.serviceWorker.ready;
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(notif.title, notificationOptions);
        return true;
      }
    } catch {
      // Fallback to Notification constructor
    }
  }

  // 2. Fallback to window Notification constructor
  try {
    if (typeof NotificationApi === 'function') {
      new NotificationApi(notif.title, notificationOptions);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
