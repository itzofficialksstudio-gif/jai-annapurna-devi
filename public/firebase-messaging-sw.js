/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCWM5DnK3XThjusRrTFkiLxVVeNsmIvHLI',
  authDomain: 'gen-lang-client-0977660427.firebaseapp.com',
  projectId: 'gen-lang-client-0977660427',
  storageBucket: 'gen-lang-client-0977660427.firebasestorage.app',
  messagingSenderId: '752007871962',
  appId: '1:752007871962:web:62f65202d1cf6c0374d4e3',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'New Order — Jai Annapurna Devi';
  const options = {
    body: payload.notification?.body || 'A customer placed a new food order.',
    icon: '/src/assets/images/hero_indian_thali_1795527587477.jpg',
    badge: '/src/assets/images/hero_indian_thali_1795527587477.jpg',
    vibrate: [300, 150, 300, 150, 500],
    requireInteraction: true,
    tag: payload.data?.orderId || 'new-order',
    data: { url: '/?view=admin' },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/?view=admin';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
