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
  | 'unsupported'      // Browser doesn't support push
  | 'not_installed'     // PWA not installed (iOS requirement)
  | 'not_requested'     // Permission not yet requested
  | 'denied'            // Permission denied
  | 'subscribed'        // Active push subscription saved
  | 'unsubscribed';     // Permission granted but no active subscription

export async function getPushState(): Promise<PushState> {
  // Check browser support
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }

  // Check if Notification API exists
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  // Check permission state
  const permission = Notification.permission;
  
  if (permission === 'denied') {
    return 'denied';
  }

  if (permission === 'default') {
    return 'not_requested';
  }

  // Permission is granted, check for active subscription
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

export async function subscribeToPush(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return { success: false, error: 'Tu navegador no soporta notificaciones push.' };
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

    // Get VAPID public key from backend
    const { data: vapidData, error: vapidError } = await supabase.functions.invoke('get-vapid-public-key');
    if (vapidError || !vapidData?.publicKey) {
      console.warn('[Push] Failed to get VAPID key:', vapidError);
      return { success: false, error: 'No se pudo obtener la clave de configuración push.' };
    }

    // Wait for SW to be ready
    const swReg = await navigator.serviceWorker.ready;

    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
    });

    const json = subscription.toJSON();
    const keys = json?.keys;
    if (!keys?.p256dh || !keys?.auth) {
      return { success: false, error: 'La suscripción push no devolvió las claves necesarias.' };
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });

    if (error) {
      console.warn('[Push] Failed to store subscription:', error);
      return { success: false, error: 'No se pudo guardar la suscripción.' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Push] Subscribe error:', err);
    return { success: false, error: err.message || 'Error al suscribirse a push.' };
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

export async function sendTestPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-test-push');
    if (error) {
      return { success: false, error: error.message };
    }
    if (!data?.success) {
      return { success: false, error: data?.error || 'Error desconocido' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
