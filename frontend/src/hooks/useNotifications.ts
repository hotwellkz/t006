import { useRef, useCallback, useEffect, useState } from 'react'
import { initFirebase, getFCMToken, registerFCMToken, unregisterFCMToken, onFCMMessage } from '../lib/firebase'

const STORAGE_KEY_SOUND = 'notifications_sound_enabled'
const STORAGE_KEY_BROWSER = 'notifications_browser_enabled'
const STORAGE_KEY_PERMISSION_ASKED = 'notifications_permission_asked'

// Звуковой файл - используем простой способ с data URL или внешний файл
// Если файл не найден, используем встроенный звук через Web Audio API
const NOTIFICATION_SOUND_URL = '/notification.mp3' // Будет добавлен в public

// Создание простого звука уведомления через Web Audio API (fallback)
function createNotificationSound(): string {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
    
    // Возвращаем пустую строку, так как это прямой вызов Web Audio API
    return ''
  } catch (error) {
    console.warn('[Notifications] Failed to create fallback sound:', error)
    return ''
  }
}

export interface NotificationSettings {
  soundEnabled: boolean
  browserEnabled: boolean
  permissionGranted: boolean
  pushEnabled: boolean
  fcmTokenRegistered: boolean
}

/**
 * Хук для управления уведомлениями о готовности видео
 */
export function useNotifications() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastNotificationTimeRef = useRef<number>(0)
  const notificationQueueRef = useRef<Array<{ title: string; body: string; jobId: string }>>([])
  const isProcessingQueueRef = useRef(false)
  const fcmTokenRef = useRef<string | null>(null)
  const [fcmRegistered, setFcmRegistered] = useState(false)

  // Инициализация аудио при первом использовании
  const initAudio = useCallback(() => {
    if (audioRef.current) return

    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL)
      audio.preload = 'auto'
      audio.volume = 0.7
      audioRef.current = audio
      
      // Пробуем загрузить аудио (может не сработать если файла нет, но это нормально)
      audio.load().catch(() => {
        console.warn('[Notifications] Audio file not found, will use fallback')
      })
    } catch (error) {
      console.warn('[Notifications] Failed to initialize audio:', error)
    }
  }, [])

  const STORAGE_KEY_PUSH = 'notifications_push_enabled'

  // Загрузка настроек из localStorage
  const loadSettings = useCallback((): NotificationSettings => {
    const soundEnabled = localStorage.getItem(STORAGE_KEY_SOUND) === 'true'
    const browserEnabled = localStorage.getItem(STORAGE_KEY_BROWSER) === 'true'
    const pushEnabled = localStorage.getItem(STORAGE_KEY_PUSH) === 'true'
    const permissionAsked = localStorage.getItem(STORAGE_KEY_PERMISSION_ASKED) === 'true'
    
    let permissionGranted = false
    if (typeof Notification !== 'undefined') {
      permissionGranted = Notification.permission === 'granted'
    }

    return {
      soundEnabled,
      browserEnabled,
      permissionGranted: permissionGranted && browserEnabled,
      pushEnabled,
      fcmTokenRegistered: fcmRegistered,
    }
  }, [fcmRegistered])

  // Сохранение настроек в localStorage
  const saveSettings = useCallback((settings: Partial<NotificationSettings>) => {
    if (settings.soundEnabled !== undefined) {
      localStorage.setItem(STORAGE_KEY_SOUND, String(settings.soundEnabled))
    }
    if (settings.browserEnabled !== undefined) {
      localStorage.setItem(STORAGE_KEY_BROWSER, String(settings.browserEnabled))
    }
    if (settings.pushEnabled !== undefined) {
      localStorage.setItem(STORAGE_KEY_PUSH, String(settings.pushEnabled))
    }
  }, [])

  // Запрос разрешения на браузерные уведомления
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') {
      console.warn('[Notifications] Browser does not support Notification API')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      console.warn('[Notifications] Permission denied, cannot request again')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      localStorage.setItem(STORAGE_KEY_PERMISSION_ASKED, 'true')
      
      if (permission === 'granted') {
        saveSettings({ browserEnabled: true })
        return true
      }
      
      return false
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error)
      return false
    }
  }, [saveSettings])

  // Включение/выключение звуковых уведомлений
  const setSoundEnabled = useCallback((enabled: boolean) => {
    saveSettings({ soundEnabled: enabled })
    
    // При первом включении инициализируем аудио
    if (enabled) {
      initAudio()
      // Пробуем "немой" запуск для активации аудио контекста
      if (audioRef.current) {
        audioRef.current.play().catch(() => {
          // Игнорируем ошибки при первом запуске
        })
      }
    }
  }, [saveSettings, initAudio])

  // Включение/выключение браузерных уведомлений
  const setBrowserEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestPermission()
      if (!granted) {
        return false
      }
    }
    
    saveSettings({ browserEnabled: enabled })
    return true
  }, [saveSettings, requestPermission])

  // Воспроизведение звука с защитой от дублирования
  const playSound = useCallback(() => {
    const now = Date.now()
    const DEBOUNCE_MS = 2000 // Минимум 2 секунды между звуками

    if (now - lastNotificationTimeRef.current < DEBOUNCE_MS) {
      return
    }

    lastNotificationTimeRef.current = now

    if (!audioRef.current) {
      initAudio()
    }

    if (audioRef.current) {
      // Сбрасываем позицию и воспроизводим
      audioRef.current.currentTime = 0
      audioRef.current.play().catch((error) => {
        console.warn('[Notifications] Failed to play sound file, using fallback:', error)
        // Fallback на Web Audio API звук
        try {
          createNotificationSound()
        } catch (e) {
          console.warn('[Notifications] Fallback sound also failed:', e)
        }
      })
    } else {
      // Если аудио не инициализировано, используем fallback
      try {
        createNotificationSound()
      } catch (e) {
        console.warn('[Notifications] Fallback sound failed:', e)
      }
    }
  }, [initAudio])

  // Показ браузерного уведомления
  const showBrowserNotification = useCallback((title: string, body: string, jobId: string) => {
    if (typeof Notification === 'undefined') {
      return null
    }

    if (Notification.permission !== 'granted') {
      return null
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico', // Можно добавить иконку
        badge: '/favicon.ico',
        tag: `video-ready-${jobId}`, // Предотвращает дублирование для одной задачи
        requireInteraction: false,
      })

      // Обработка клика по уведомлению
      notification.onclick = () => {
        window.focus()
        notification.close()
        
        // Можно добавить скролл к карточке задачи, если есть элемент с data-job-id
        const jobElement = document.querySelector(`[data-job-id="${jobId}"]`)
        if (jobElement) {
          jobElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }

      // Автоматически закрываем через 5 секунд
      setTimeout(() => {
        notification.close()
      }, 5000)

      return notification
    } catch (error) {
      console.error('[Notifications] Failed to show browser notification:', error)
      return null
    }
  }, [])

  // Обработка очереди уведомлений
  const processNotificationQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || notificationQueueRef.current.length === 0) {
      return
    }

    isProcessingQueueRef.current = true
    const settings = loadSettings()

    while (notificationQueueRef.current.length > 0) {
      const notification = notificationQueueRef.current.shift()
      if (!notification) break

      // Звук
      if (settings.soundEnabled) {
        playSound()
      }

      // Браузерное уведомление
      if (settings.browserEnabled && settings.permissionGranted) {
        showBrowserNotification(notification.title, notification.body, notification.jobId)
      }

      // Небольшая задержка между уведомлениями
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    isProcessingQueueRef.current = false
  }, [loadSettings, playSound, showBrowserNotification])

  // Основная функция для отправки уведомления
  const notifyVideoReady = useCallback((jobTitle: string, jobId: string) => {
    const settings = loadSettings()
    
    if (!settings.soundEnabled && !settings.browserEnabled) {
      return
    }

    // Добавляем в очередь
    notificationQueueRef.current.push({
      title: 'Видео готово',
      body: `Ролик "${jobTitle}" сгенерирован и готов к просмотру`,
      jobId,
    })

    // Обрабатываем очередь
    processNotificationQueue()
  }, [loadSettings, processNotificationQueue])

  // Регистрация FCM токена
  const registerFCM = useCallback(async (): Promise<boolean> => {
    try {
      // Инициализируем Firebase
      initFirebase()
      
      // Получаем токен
      const token = await getFCMToken()
      if (!token) {
        return false
      }

      fcmTokenRef.current = token

      // Регистрируем на бэкенде
      const registered = await registerFCMToken(token)
      if (registered) {
        setFcmRegistered(true)
        return true
      }
      return false
    } catch (error) {
      console.error('[Notifications] Error registering FCM:', error)
      return false
    }
  }, [])

  // Отключение FCM
  const unregisterFCM = useCallback(async () => {
    if (fcmTokenRef.current) {
      await unregisterFCMToken(fcmTokenRef.current).catch(console.error)
      fcmTokenRef.current = null
      setFcmRegistered(false)
    }
  }, [])

  // Включение/выключение push-уведомлений
  const setPushEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      // Сначала запрашиваем разрешение на уведомления
      const permissionGranted = await requestPermission()
      if (!permissionGranted) {
        return false
      }

      // Регистрируем FCM
      const registered = await registerFCM()
      if (registered) {
        saveSettings({ pushEnabled: true })
        return true
      } else {
        alert('Не удалось зарегистрировать push-уведомления. Проверьте настройки Firebase.')
        return false
      }
    } else {
      await unregisterFCM()
      saveSettings({ pushEnabled: false })
      return true
    }
  }, [requestPermission, registerFCM, unregisterFCM, saveSettings])

  // Инициализация при монтировании
  useEffect(() => {
    const settings = loadSettings()
    if (settings.soundEnabled) {
      initAudio()
    }

    // Инициализируем FCM если включен
    if (settings.pushEnabled) {
      registerFCM().catch(console.error)
    }

    // Подписываемся на входящие FCM сообщения (когда вкладка открыта)
    onFCMMessage((payload) => {
      console.log('[Notifications] Received FCM message:', payload)
      
      const notification = payload.notification
      const data = payload.data
      
      if (notification && data?.jobId) {
        const jobTitle = data.jobTitle || notification.title || 'Видео'
        notifyVideoReady(jobTitle, data.jobId)
      }
    }).catch(console.error)
  }, [loadSettings, initAudio, registerFCM, notifyVideoReady])

  return {
    settings: loadSettings(),
    setSoundEnabled,
    setBrowserEnabled,
    setPushEnabled,
    requestPermission,
    notifyVideoReady,
  }
}

