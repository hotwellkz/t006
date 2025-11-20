// Service Worker для Firebase Cloud Messaging
// Этот файл должен быть в public директории

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Конфигурация Firebase из переменных окружения
// В production эти значения должны быть заменены на реальные из Firebase Console
// Для Vite нужно использовать import.meta.env, но в service worker это недоступно
// Поэтому используем глобальную переменную, которая устанавливается при загрузке страницы
const firebaseConfig = {
  apiKey: self.firebaseConfig?.apiKey || 'YOUR_API_KEY',
  authDomain: self.firebaseConfig?.authDomain || 'YOUR_AUTH_DOMAIN',
  projectId: self.firebaseConfig?.projectId || 'YOUR_PROJECT_ID',
  storageBucket: self.firebaseConfig?.storageBucket || 'YOUR_STORAGE_BUCKET',
  messagingSenderId: self.firebaseConfig?.messagingSenderId || 'YOUR_MESSAGING_SENDER_ID',
  appId: self.firebaseConfig?.appId || 'YOUR_APP_ID',
}

// Инициализация Firebase
firebase.initializeApp(firebaseConfig)

// Получение экземпляра Messaging
const messaging = firebase.messaging()

// Обработка фоновых сообщений (когда вкладка закрыта)
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Получено фоновое сообщение:', payload)
  
  const notificationTitle = payload.notification?.title || 'Уведомление'
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.jobId ? `video-ready-${payload.data.jobId}` : 'notification',
    data: payload.data || {},
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Клик по уведомлению:', event)
  
  event.notification.close()

  const jobId = event.notification.data?.jobId
  const link = event.notification.data?.link || '/'

  // Открываем или фокусируем вкладку приложения
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Ищем открытую вкладку приложения
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            // Если есть jobId, можно добавить навигацию к конкретной задаче
            if (jobId) {
              client.postMessage({ type: 'navigate', jobId, link })
            }
          })
        }
      }
      // Если вкладка не найдена, открываем новую
      if (clients.openWindow) {
        return clients.openWindow(link)
      }
    })
  )
})

