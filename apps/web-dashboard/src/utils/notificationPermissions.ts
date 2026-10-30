/**
 * Upfront browser notification permission helper
 * Invoked during explicit user interaction (e.g. form submission)
 */
export async function requestNotificationPermissionUpfront(): Promise<NotificationPermission | null> {
  const globalObj = typeof window !== 'undefined' ? window : (globalThis as any);
  if (!globalObj || typeof globalObj.Notification === 'undefined') {
    return null;
  }
  const notif = globalObj.Notification;
  if (notif.permission === 'default' && typeof notif.requestPermission === 'function') {
    try {
      return await notif.requestPermission();
    } catch {
      return null;
    }
  }
  return notif.permission ?? null;
}
