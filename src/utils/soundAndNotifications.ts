import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance } from '../firebase';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays a rich multi-tone kitchen order bell chime using Web Audio API.
 * Zero external audio file dependency — works reliably offline and online.
 */
export async function playOrderAlertSound(variant: 'new-order' | 'accepted' | 'test' = 'new-order'): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const notes =
      variant === 'accepted'
        ? [523.25, 659.25, 783.99, 1046.5] // Uplifting major arpeggio for customer
        : [880, 1108.73, 1318.51, 880, 1318.51]; // Bright attention-grabbing kitchen chime

    notes.forEach((freq, idx) => {
      const start = now + idx * (variant === 'accepted' ? 0.11 : 0.14);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = variant === 'accepted' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(variant === 'accepted' ? 0.22 : 0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.48);
    });

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(variant === 'accepted' ? [150, 80, 150] : [300, 120, 300, 120, 450]);
    }
    return true;
  } catch {
    return false;
  }
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    return reg;
  } catch {
    return null;
  }
}

export async function showSystemNotification(title: string, body: string, tag = 'jad-alert'): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const options: NotificationOptions & { vibrate?: number[] } = {
    body,
    icon: '/src/assets/images/hero_indian_thali_1795527587477.jpg',
    badge: '/src/assets/images/hero_indian_thali_1795527587477.jpg',
    tag,
    vibrate: [300, 150, 300, 150, 500],
    requireInteraction: true,
  };

  try {
    const reg = await navigator.serviceWorker?.getRegistration('/firebase-messaging-sw.js');
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }
}

export async function enablePushAndFcmNotifications(): Promise<{
  permission: NotificationPermission | 'unsupported';
  fcmToken: string | null;
  swRegistered: boolean;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { permission: 'unsupported', fcmToken: null, swRegistered: false };
  }

  const permission = await Notification.requestPermission();
  const reg = await registerNotificationServiceWorker();

  if (permission !== 'granted') {
    return { permission, fcmToken: null, swRegistered: Boolean(reg) };
  }

  let fcmToken: string | null = null;
  try {
    const messaging = await getMessagingInstance();
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    if (messaging && reg && vapidKey && vapidKey.trim().length > 10) {
      fcmToken = await getToken(messaging, {
        vapidKey: vapidKey.trim(),
        serviceWorkerRegistration: reg,
      });
    }
  } catch (err) {
    console.warn('FCM token registration skipped:', err);
  }

  return { permission, fcmToken, swRegistered: Boolean(reg) };
}

export async function subscribeForegroundFcm(
  callback: (title: string, body: string) => void
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || 'New Order — Jai Annapurna Devi';
    const body = payload.notification?.body || 'Check your owner dashboard for order details.';
    callback(title, body);
  });
}
