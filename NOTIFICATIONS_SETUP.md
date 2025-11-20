# Настройка уведомлений о готовности видео

## Обзор

Реализованы три типа уведомлений о готовности видео:
1. **Звуковые уведомления** - проигрывание звука в браузере
2. **Браузерные уведомления** - нативные уведомления через Notification API (работают только при открытой вкладке)
3. **Push-уведомления** - через Firebase Cloud Messaging (работают даже при закрытой вкладке/браузере)

## Настройка звуковых и браузерных уведомлений

Эти уведомления работают без дополнительной настройки. Пользователь может включить их в интерфейсе на странице генерации видео.

## Настройка Push-уведомлений (FCM)

### 1. Настройка Firebase проекта

1. Перейдите в [Firebase Console](https://console.firebase.google.com/)
2. Выберите проект (или создайте новый)
3. Перейдите в **Project Settings** (⚙️) → **Cloud Messaging**
4. Включите **Web Push certificates** (если не включено)
5. Скопируйте **Web Push certificate** (VAPID key) - понадобится для фронтенда

### 2. Получение конфигурации Firebase

1. В Firebase Console перейдите в **Project Settings** → **General**
2. В разделе **Your apps** нажмите на иконку веб-приложения (или создайте новое)
3. Скопируйте значения из объекта `firebaseConfig`:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### 3. Настройка переменных окружения фронтенда

Создайте файл `.env` в директории `frontend/` со следующими переменными:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Firebase VAPID Key (для Web Push)
VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
```

### 4. Установка зависимостей

```bash
cd frontend
npm install
```

### 5. Регистрация Service Worker

Service Worker для FCM уже создан в `frontend/public/firebase-messaging-sw.js`. 
Vite автоматически копирует файлы из `public/` в корень при сборке.

### 6. Настройка бэкенда

Бэкенд уже настроен для отправки FCM уведомлений. Убедитесь, что:
- Firebase Admin SDK настроен (см. `backend/FIREBASE_SETUP.md`)
- Переменные окружения `FIREBASE_*` установлены в `.env` бэкенда

### 7. Проверка работы

1. Запустите фронтенд: `npm run dev`
2. Запустите бэкенд: `npm run dev`
3. Откройте приложение в браузере
4. На странице генерации видео включите "Push-уведомления"
5. Разрешите уведомления в браузере
6. Создайте задачу генерации видео
7. Когда видео будет готово, вы получите push-уведомление даже при закрытой вкладке

## Структура файлов

### Фронтенд
- `frontend/src/hooks/useNotifications.ts` - хук для управления уведомлениями
- `frontend/src/lib/firebase.ts` - инициализация Firebase и FCM
- `frontend/public/firebase-messaging-sw.js` - Service Worker для FCM
- `frontend/src/components/VideoGeneration.tsx` - UI настроек уведомлений

### Бэкенд
- `backend/src/firebase/fcmService.ts` - сервис для работы с FCM
- `backend/src/api/fcm.ts` - API endpoints для регистрации токенов
- `backend/src/api/videoJobs.ts` - отправка уведомлений при готовности видео

## Особенности реализации

1. **Звуковые уведомления**:
   - Используют HTML5 Audio API
   - Fallback на Web Audio API если файл не найден
   - Debounce 2 секунды между звуками

2. **Браузерные уведомления**:
   - Работают только при открытой вкладке
   - Требуют разрешения пользователя
   - Автоматически закрываются через 5 секунд

3. **Push-уведомления**:
   - Работают даже при закрытой вкладке/браузере
   - Требуют настройки Firebase
   - Токены сохраняются в Firestore
   - Автоматически удаляются невалидные токены

## Troubleshooting

### Push-уведомления не работают

1. Проверьте, что все переменные окружения установлены
2. Убедитесь, что VAPID key правильный
3. Проверьте консоль браузера на ошибки
4. Убедитесь, что Service Worker зарегистрирован (DevTools → Application → Service Workers)

### Звук не проигрывается

1. Проверьте, что звук включен в настройках
2. Убедитесь, что браузер не блокирует автовоспроизведение
3. Проверьте консоль браузера на ошибки

### Браузерные уведомления не показываются

1. Проверьте разрешения браузера (Settings → Notifications)
2. Убедитесь, что уведомления включены в настройках приложения
3. Проверьте, что браузер поддерживает Notification API

