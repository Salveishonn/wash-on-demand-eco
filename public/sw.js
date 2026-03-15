// Washero Ops Service Worker - Push Notifications

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

async function broadcastToClients(payload) {
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientList) {
    client.postMessage(payload);
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');

  let data = { title: 'Washero Driver', body: 'Nueva notificación' };

  try {
    if (event.data) {
      const raw = event.data.text();
      console.log('[SW] Push raw payload length:', raw.length);
      data = { ...data, ...JSON.parse(raw) };
      console.log('[SW] Push parsed OK — title:', data.title);
    }
  } catch (e) {
    console.error('[SW] Push data parse error:', e);
  }

  const receivedAt = new Date().toISOString();

  // Minimal iOS-safe notification options
  const options = {
    body: data.body || 'Nueva notificación',
    icon: data.icon || '/icons/washero-driver-192.png',
    badge: data.badge || '/icons/washero-driver-192.png',
    tag: data.tag || 'washero-ops',
    data: {
      url: data.url || '/ops',
      receivedAt,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Washero Driver', options)
      .then(() => {
        console.log('[SW] showNotification succeeded');
        return broadcastToClients({
          type: 'PUSH_RECEIVED',
          receivedAt,
          tag: options.tag,
          title: data.title,
          body: data.body,
        });
      })
      .catch((err) => {
        console.error('[SW] showNotification failed:', err);
      })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || '/ops';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/ops') && 'focus' in client) {
          return client.focus().then(() => client.navigate(url));
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Handle local test notification message from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_LOCAL_NOTIFICATION') {
    console.log('[SW] Local notification requested');
    const { title, body, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'Washero Driver', {
        body: body || 'Notificación local de prueba',
        icon: '/icons/washero-driver-192.png',
        badge: '/icons/washero-driver-192.png',
        tag: tag || 'local-test',
        data: { url: '/ops' },
      }).then(() => {
        console.log('[SW] Local notification shown');
      }).catch((err) => {
        console.error('[SW] Local notification failed:', err);
      })
    );
  }
});
