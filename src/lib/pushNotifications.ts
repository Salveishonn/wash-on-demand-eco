import { supabase } from '@/integrations/supabase/client';

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
    return null;
  }
}

export type PushState =
  | 'unsupported'
  | 'not_installed'
  | 'not_requested'
  | 'denied'
  | 'subscribed'
  | 'unsubscribed';

export interface PushDiagnostics {
  permission: NotificationPermission | 'unsupported';
  serviceWorkerRegistered: boolean;
  serviceWorkerReady: boolean;
  subscriptionActive: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  canRequestInCurrentContext: boolean;
  lastTestPushSentAt: string | null;
  lastTestPushReceivedAt: string | null;
}

export interface TestPushResult {
  success: boolean;
  sent?: number;
  total?: number;
  testId?: string;
  error?: string;
  failures?: Array<{ status?: number; error?: string }>;
}

type PushWorkerMessage = {
  type: 'PUSH_RECEIVED' | 'PUSH_CLICKED';
  receivedAt?: string;
};

const LAST_TEST_SENT_KEY = 'ops_last_test_push_sent_at';
const LAST_TEST_RECEIVED_KEY = 'ops_last_push_received_at';

function isIOSDevice() {
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration('/sw.js')) || (await navigator.serviceWorker.getRegistration()) || null;
}

export async function getPushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  if (isIOSDevice() && !isStandaloneMode()) {
    return 'not_installed';
  }

  const permission = Notification.permission;
  if (permission === 'denied') return 'denied';
  if (permission === 'default') return 'not_requested';

  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) return 'unsubscribed';
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

export async function getPushDiagnostics(): Promise<PushDiagnostics> {
  const isIOS = isIOSDevice();
  const isStandalone = isStandaloneMode();

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      permission: 'unsupported',
      serviceWorkerRegistered: false,
      serviceWorkerReady: false,
      subscriptionActive: false,
      isIOS,
      isStandalone,
      canRequestInCurrentContext: false,
      lastTestPushSentAt: localStorage.getItem(LAST_TEST_SENT_KEY),
      lastTestPushReceivedAt: localStorage.getItem(LAST_TEST_RECEIVED_KEY),
    };
  }

  const registration = await getServiceWorkerRegistration();
  let subscriptionActive = false;

  if (registration) {
    const sub = await registration.pushManager.getSubscription();
    subscriptionActive = !!sub;
  }

  let serviceWorkerReady = false;
  try {
    await navigator.serviceWorker.ready;
    serviceWorkerReady = true;
  } catch {
    serviceWorkerReady = false;
  }

  return {
    permission: Notification.permission,
    serviceWorkerRegistered: !!registration,
    serviceWorkerReady,
    subscriptionActive,
    isIOS,
    isStandalone,
    canRequestInCurrentContext: !isIOS || isStandalone,
    lastTestPushSentAt: localStorage.getItem(LAST_TEST_SENT_KEY),
    lastTestPushReceivedAt: localStorage.getItem(LAST_TEST_RECEIVED_KEY),
  };
}

export function listenForPushMessages(onMessage: (message: PushWorkerMessage) => void) {
  if (!('serviceWorker' in navigator)) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    if (!event?.data?.type) return;

    if (event.data.type === 'PUSH_RECEIVED' || event.data.type === 'PUSH_CLICKED') {
      if (event.data.receivedAt) {
        localStorage.setItem(LAST_TEST_RECEIVED_KEY, event.data.receivedAt);
      }
      onMessage(event.data as PushWorkerMessage);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

export async function subscribeToPush(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return { success: false, error: 'Tu navegador no soporta notificaciones push.' };
    }

    if (isIOSDevice() && !isStandaloneMode()) {
      return {
        success: false,
        error: 'not_installed',
      };
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: 'No se pudo registrar el service worker.' };
    }

    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      return { success: false, error: 'denied' };
    }
    if (permission !== 'granted') {
      return { success: false, error: 'No se otorgó permiso para notificaciones.' };
    }

    const { data: vapidData, error: vapidError } = await supabase.functions.invoke('get-vapid-public-key');
    if (vapidError || !vapidData?.publicKey) {
      console.warn('[Push] Failed to get VAPID key:', vapidError);
      return { success: false, error: 'No se pudo obtener la clave de configuración push.' };
    }

    const swReg = await navigator.serviceWorker.ready;
    let subscription = await swReg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });
    }

    const json = subscription.toJSON();
    const keys = json?.keys;
    if (!keys?.p256dh || !keys?.auth) {
      return { success: false, error: 'La suscripción push no devolvió las claves necesarias.' };
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      );

    if (error) {
      console.warn('[Push] Failed to store subscription:', error);
      return { success: false, error: 'No se pudo guardar la suscripción.' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Push] Subscribe error:', err);

    if (err?.name === 'NotAllowedError') {
      return { success: false, error: 'Permiso denegado o bloqueado por el navegador.' };
    }

    return { success: false, error: err.message || 'Error al suscribirse a push.' };
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const registration = await getServiceWorkerRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

export async function sendTestPush(): Promise<TestPushResult> {
  try {
    const registration = await getServiceWorkerRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;

    const { data, error } = await supabase.functions.invoke('send-test-push', {
      body: {
        endpoint: subscription?.endpoint ?? null,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'No se pudo enviar la notificación de prueba.',
        sent: data?.sent,
        total: data?.total,
        failures: data?.failures,
      };
    }

    localStorage.setItem(LAST_TEST_SENT_KEY, new Date().toISOString());

    return {
      success: true,
      sent: data?.sent,
      total: data?.total,
      testId: data?.testId,
      failures: data?.failures,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function markPushReceivedAt(receivedAt: string) {
  localStorage.setItem(LAST_TEST_RECEIVED_KEY, receivedAt);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
