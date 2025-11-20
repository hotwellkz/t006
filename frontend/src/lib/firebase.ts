import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, Messaging, isSupported } from 'firebase/messaging'
import { apiFetch } from './apiClient'

// Конфигурация Firebase из переменных окружения
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

/**
 * Инициализировать Firebase
 */
export function initFirebase(): FirebaseApp | null {
  if (app) {
    return app
  }

  // Проверяем наличие обязательных полей
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('[Firebase] Firebase не настроен. Установите VITE_FIREBASE_* переменные окружения.')
    return null
  }

  try {
    const existingApps = getApps()
    if (existingApps.length > 0) {
      app = existingApps[0]
    } else {
      app = initializeApp(firebaseConfig)
      console.log('[Firebase] ✅ Firebase инициализирован')
    }
    return app
  } catch (error) {
    console.error('[Firebase] ❌ Ошибка инициализации Firebase:', error)
    return null
  }
}

/**
 * Получить экземпляр Messaging для FCM
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messaging) {
    return messaging
  }

  const isMessagingSupported = await isSupported()
  if (!isMessagingSupported) {
    console.warn('[Firebase] Messaging не поддерживается в этом браузере')
    return null
  }

  if (!app) {
    app = initFirebase()
    if (!app) {
      return null
    }
  }

  try {
    messaging = getMessaging(app)
    return messaging
  } catch (error) {
    console.error('[Firebase] ❌ Ошибка получения Messaging:', error)
    return null
  }
}

/**
 * Регистрация Service Worker для FCM
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      // Регистрируем service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      })
      console.log('[Firebase] ✅ Service Worker зарегистрирован:', registration.scope)
      return registration
    } catch (error) {
      console.error('[Firebase] ❌ Ошибка регистрации Service Worker:', error)
      return null
    }
  }
  return null
}

/**
 * Получить FCM токен устройства
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Сначала регистрируем service worker
    await registerServiceWorker()

    const messagingInstance = await getMessagingInstance()
    if (!messagingInstance) {
      return null
    }

    // VAPID key должен быть получен из Firebase Console
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      console.warn('[Firebase] VITE_FIREBASE_VAPID_KEY не установлен')
      return null
    }

    const token = await getToken(messagingInstance, { vapidKey })
    
    if (token) {
      console.log('[Firebase] ✅ FCM token получен:', token.substring(0, 20) + '...')
      return token
    } else {
      console.warn('[Firebase] ⚠️ Не удалось получить FCM token. Убедитесь, что уведомления разрешены.')
      return null
    }
  } catch (error) {
    console.error('[Firebase] ❌ Ошибка получения FCM token:', error)
    return null
  }
}

/**
 * Зарегистрировать FCM токен на бэкенде
 */
export async function registerFCMToken(token: string, userId?: string): Promise<boolean> {
  try {
    await apiFetch('/api/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId }),
    })
    console.log('[Firebase] ✅ FCM token зарегистрирован на бэкенде')
    return true
  } catch (error) {
    console.error('[Firebase] ❌ Ошибка регистрации FCM token:', error)
    return false
  }
}

/**
 * Удалить FCM токен с бэкенда
 */
export async function unregisterFCMToken(token: string): Promise<boolean> {
  try {
    await apiFetch('/api/fcm/unregister', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    console.log('[Firebase] ✅ FCM token удалён с бэкенда')
    return true
  } catch (error) {
    console.error('[Firebase] ❌ Ошибка удаления FCM token:', error)
    return false
  }
}

/**
 * Подписаться на входящие сообщения FCM (когда вкладка открыта)
 */
export async function onFCMMessage(callback: (payload: any) => void): Promise<(() => void) | null> {
  try {
    const messagingInstance = await getMessagingInstance()
    if (!messagingInstance) {
      return null
    }

    const unsubscribe = onMessage(messagingInstance, (payload) => {
      console.log('[Firebase] 📨 Получено FCM сообщение:', payload)
      callback(payload)
    })

    return unsubscribe
  } catch (error) {
    console.error('[Firebase] ❌ Ошибка подписки на FCM сообщения:', error)
    return null
  }
}

