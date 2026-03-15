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

function buildTargetUrl(rawUrl, receivedAt, fallbackTab) {
  try {
    const absolute = new URL(rawUrl || '/ops', self.location.origin);
    if (!absolute.searchParams.get('push_received_at')) {
      absolute.searchParams.set('push_received_at', receivedAt);
    }
    if (fallbackTab && !absolute.searchParams.get('tab')) {
      absolute.searchParams.set('tab', fallbackTab);
    }
    return `${absolute.pathname}${absolute.search}${absolute.hash}`;
  } catch {
    const params = new URLSearchParams();
    params.set('push_received_at', receivedAt);
    if (fallbackTab) params.set('tab', fallbackTab);
    return `/ops?${params.toString()}`;
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Washero Ops', body: 'Nueva notificación', url: '/ops', tag: 'washero-ops', data: {} };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.error('[SW] Push data parse error:', e);
  }

  const receivedAt = new Date().toISOString();

  const options = {
    body: data.body,
    icon: data.icon || '/ops-icon-192.png',
    badge: data.badge || '/ops-icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'washero-ops',
    renotify: true,
    data: {
      url: data.url || '/ops',
      receivedAt,
      tag: data.tag || 'washero-ops',
      payload: data.data || {},
    },
    actions: data.actions || [],
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(data.title, options);
    await broadcastToClients({
      type: 'PUSH_RECEIVED',
      receivedAt,
      tag: options.tag,
      payload: data,
    });
  })());
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const receivedAt = event.notification.data?.receivedAt || new Date().toISOString();
  const payload = event.notification.data?.payload || {};
  const fallbackTab = payload?.tab || (event.notification.data?.tag?.includes('whatsapp') ? 'messages' : 'notifications');
  const targetUrl = buildTargetUrl(event.notification.data?.url || '/ops', receivedAt, fallbackTab);

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of clientList) {
      if (client.url.includes('/ops') && 'focus' in client) {
        await client.navigate(targetUrl);
        await client.focus();
        await broadcastToClients({ type: 'PUSH_CLICKED', receivedAt, tag: event.notification.data?.tag });
        return;
      }
    }

    await clients.openWindow(targetUrl);
  })());
});
