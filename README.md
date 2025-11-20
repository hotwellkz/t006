# WhiteCoding Studio

Приложение для автоматизации генерации коротких видео через Syntx AI (Telegram) и загрузки их в Google Drive после ручного одобрения.

## Структура проекта

```
.
├── backend/          # Node.js + TypeScript backend
│   ├── src/
│   │   ├── telegram/     # Модуль работы с Telegram (GramJS)
│   │   ├── googleDrive/  # Модуль работы с Google Drive
│   │   ├── models/       # Модели данных (каналы, видео-джобы)
│   │   ├── api/          # REST API роуты
│   │   └── server.ts     # Главный сервер
│   ├── package.json
│   └── tsconfig.json
├── frontend/        # React + TypeScript frontend
│   ├── src/
│   │   ├── components/   # React компоненты
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── .env.example     # Пример файла с переменными окружения
```

## Установка и запуск

### 1. Установка зависимостей

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта (или в папке `backend/`) на основе `.env.example`:

```env
# Telegram (GramJS)
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash
TELEGRAM_STRING_SESSION=
SYNTX_BOT_USERNAME=syntxaibot
DOWNLOAD_DIR=./downloads

# Для первичного интерактивного логина (если нужно)
TELEGRAM_PHONE_NUMBER=
TELEGRAM_2FA_PASSWORD=

# Google Drive (OAuth2)
GDRIVE_CLIENT_ID=ваш_client_id
GDRIVE_CLIENT_SECRET=ваш_client_secret
GDRIVE_REFRESH_TOKEN=ваш_refresh_token
GDRIVE_FOLDER_ID=id_папки_в_google_drive

# OpenAI API (для генерации идей, промптов и транскрипции голоса)
OPENAI_API_KEY=ваш_openai_api_key

# Firebase (Firestore)
FIREBASE_PROJECT_ID=ваш_project_id
FIREBASE_PRIVATE_KEY_ID=ваш_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=ваш_client_email
FIREBASE_CLIENT_ID=ваш_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=ваш_client_x509_cert_url
FIREBASE_UNIVERSE_DOMAIN=googleapis.com

# HTTP сервер
PORT=4000
```

### Frontend (Vite)

Во время разработки Vite проксирует запросы `/api/*` на `http://localhost:4000` согласно `vite.config.ts`.  
Для production-сборок укажите публичный адрес backend API через переменную `VITE_API_URL` (файл `frontend/.env` или настройки хостинга):

```env
# Например: https://whitecoding-backend.example.com
VITE_API_URL=https://your-backend-api.example.com
```

Если переменная не задана в production, фронт попытается отправлять запросы на тот же домен, что и Netlify-сайт, что приведёт к 404 (как произошло после первого деплоя).

## Деплой фронтенда на Netlify

1. Подготовьте публичный backend (Render, Railway, VPS и т.п.) и возьмите его URL.
2. В Netlify → Site settings → Environment variables добавьте:
   - `VITE_API_URL = https://<домен вашего backend'а>`
3. Параметры билда:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

Если backend временно работает только локально, Netlify всё равно соберёт сайт, но запросы к `/api/*` будут падать. В таком случае приложение покажет сообщение «Не удалось подключиться к серверу. Проверьте настройки backend API.» — это сигнал, что нужно задеплоить backend или обновить `VITE_API_URL`.

## Деплой backend на Google Cloud Run

Инструкция находится в [`backend/DEPLOY_CLOUD_RUN.md`](backend/DEPLOY_CLOUD_RUN.md).  
Кратко:

1. `gcloud auth login && gcloud config set project <project-id>`
2. `cd backend && gcloud run deploy whitecoding-backend --source . --region=europe-central2 --platform=managed --allow-unauthenticated`
3. Скопируйте выданный URL (`https://whitecoding-backend-xxxxx-uc.a.run.app`) и пропишите его в `VITE_API_URL` на Netlify.
4. Все секреты (Telegram, Google Drive, OpenAI) задаём через Variables & Secrets в Cloud Run. Локальный `.env` нужен только для разработки.

#### Как получить Telegram API credentials:

1. Перейдите на https://my.telegram.org/apps
2. Войдите в свой аккаунт
3. Создайте приложение и получите `api_id` и `api_hash`

#### Как настроить Google Drive (OAuth2):

1. **Создайте OAuth 2.0 Client в Google Cloud Console:**
   - Перейдите на https://console.cloud.google.com/
   - Выберите проект (или создайте новый)
   - Перейдите в "APIs & Services" → "Credentials"
   - Нажмите "Create Credentials" → "OAuth client ID"
   - Если впервые: настройте OAuth consent screen (выберите "External" и заполните обязательные поля)
   - Выберите тип приложения: "Desktop app" или "Web application"
   - Добавьте Authorized redirect URIs: `http://localhost:3000/oauth2callback`
   - Скопируйте `Client ID` и `Client secret`

2. **Получите refresh_token:**
   ```bash
   cd backend
   npm run get-drive-token
   ```
   - Скрипт выведет OAuth-ссылку для авторизации (содержит все необходимые параметры, включая `response_type=code`)
   - Откройте ссылку в браузере и авторизуйтесь в Google
   - Разрешите доступ к Google Drive
   - После авторизации скрипт автоматически получит код через локальный сервер и обменяет его на refresh_token
   - Скрипт автоматически добавит `GDRIVE_REFRESH_TOKEN` в `.env` файл
   - Если автоматическое обновление не сработало, скопируйте `GDRIVE_REFRESH_TOKEN` из консоли в `.env` вручную

3. **Настройте папку:**
   - Создайте папку в вашем Google Drive
   - Откройте папку и скопируйте ID из URL: `https://drive.google.com/drive/folders/ВАШ_ID`
   - Укажите ID в `GDRIVE_FOLDER_ID` (это папка по умолчанию)
   - **Для разных каналов можно указать свои папки:** в настройках канала (в веб-интерфейсе) есть поле "ID папки Google Drive". Если указать ID папки для канала, видео этого канала будут сохраняться в эту папку, а не в папку по умолчанию.

### 3. Первичная авторизация в Telegram

При первом запуске backend попросит авторизоваться в Telegram:

```bash
cd backend
npm run dev
```

Введите номер телефона и код из Telegram. После успешной авторизации скопируйте `TELEGRAM_STRING_SESSION` из консоли в `.env` файл.

### 4. Запуск приложения

#### Backend (в одном терминале):

```bash
cd backend
npm run dev
```

Сервер запустится на `http://localhost:4000`

#### Frontend (в другом терминале):

```bash
cd frontend
npm run dev
```

Frontend запустится на `http://localhost:3000`

## Использование

1. Откройте `http://localhost:3000` в браузере
2. Перейдите во вкладку "Настройки каналов" и создайте каналы (или используйте предустановленные)
3. Перейдите во вкладку "Генерация видео":
   - Выберите канал
   - Выберите один из трёх вариантов:
     1. **"Предложить свою идею"** (голосом/текстом):
        - Нажмите кнопку с микрофоном
        - Нажмите на микрофон и надиктуйте идею (используется OpenAI Whisper для распознавания речи)
        - После распознавания текст появится в текстовом поле
        - Нажмите "Сгенерировать промпт" для создания финального промпта
     2. **"Сгенерировать идеи"** (через AI):
        - Нажмите кнопку для автоматической генерации идей через OpenAI
        - Выберите понравившуюся идею из списка
        - Промпт и название видео будут сгенерированы автоматически
     3. **"Вставить готовый промпт"** (прямой ввод):
        - Нажмите кнопку для вставки уже подготовленного промпта для Veo 3.1 Fast
        - Вставьте промпт в модальное окно
        - Нажмите "Продолжить к генерации" — сразу перейдёте к шагу генерации видео
   - На шаге 3 отредактируйте промпт при необходимости
   - Нажмите "Сгенерировать видео"
   - Дождитесь генерации (может занять несколько минут)
   - Просмотрите видео и одобрите/отклоните/перегенерируйте

## Особенности работы

### Генерация промптов на языке канала

Промпты для Veo 3.1 Fast и названия видео автоматически генерируются на том же языке, что и язык канала:

- Если канал на русском (`language: "ru"`) → промпт и название на русском
- Если канал на английском (`language: "en"`) → промпт и название на английском
- Если канал на казахском (`language: "kk"`) → промпт и название на казахском

Язык определяется автоматически из настроек канала при генерации промпта через OpenAI.

### Связь запроса с ответом в Telegram

При генерации видео система использует `reply_to_message_id` для точного сопоставления запроса и ответа от бота Syntx. Это гарантирует, что:

- Каждое задание генерации жёстко связано со своим результатом
- При нескольких генерациях с одинаковым промптом в приложении и на диске оказываются именно разные файлы
- Каждое задание имеет свой уникальный `telegramRequestMessageId`, который сохраняется в базе

### Разные папки Google Drive для разных каналов

Каждый канал может иметь свою папку в Google Drive:

1. **Настройка папки для канала:**
   - Перейдите во вкладку "Настройки каналов"
   - Создайте или отредактируйте канал
   - В поле "ID папки Google Drive" укажите ID папки (например, `1AbCdEfGh...`)
   - Если поле пустое, используется папка по умолчанию из `GDRIVE_FOLDER_ID` в `.env`

2. **Как получить ID папки:**
   - Откройте папку в Google Drive
   - Скопируйте ID из URL: `https://drive.google.com/drive/folders/ВАШ_ID`
   - Вставьте ID в поле настройки канала

3. **Поведение:**
   - Видео для канала A сохраняются в папку, указанную в `gdriveFolderId` канала A
   - Видео для канала B сохраняются в папку, указанную в `gdriveFolderId` канала B
   - Если у канала `gdriveFolderId` не указан, используется `GDRIVE_FOLDER_ID` из `.env`

## API Endpoints

- `GET /api/channels` - Получить список каналов
- `POST /api/channels` - Создать канал (поддерживает поле `gdriveFolderId`)
- `PUT /api/channels/:id` - Обновить канал (поддерживает поле `gdriveFolderId`)
- `DELETE /api/channels/:id` - Удалить канал
- `POST /api/ideas/generate` - Сгенерировать идеи для канала
- `POST /api/prompts/veo` - Сгенерировать промпт для Veo
- `POST /api/video/generate` - Сгенерировать видео
- `GET /api/video/preview/:id` - Получить превью видео
- `POST /api/video/jobs/:id/approve` - Одобрить и загрузить в Google Drive
- `POST /api/video/jobs/:id/reject` - Отклонить видео
- `POST /api/video/jobs/:id/regenerate` - Перегенерировать видео
- `POST /api/transcribe-idea` - Транскрибировать аудио в текст (OpenAI Whisper)
- `POST /api/generate-title` - Сгенерировать название видео на основе промпта (OpenAI)

## Технологии

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: React, TypeScript, Vite
- **Telegram**: GramJS (telegram)
- **Google Drive**: googleapis
- **OpenAI**: OpenAI API (для генерации идей, промптов и транскрипции голоса через Whisper)
- **Голосовой ввод**: MediaRecorder API (frontend) + OpenAI Whisper (backend)
- **Хранение данных**: Firebase Firestore (каналы, настройки, задачи генерации видео)

## Настройка Firebase

Подробная инструкция по настройке Firebase Firestore находится в [`backend/FIREBASE_SETUP.md`](backend/FIREBASE_SETUP.md).

Кратко:
1. Получите Service Account credentials из Firebase Console
2. Добавьте все `FIREBASE_*` переменные в `.env`
3. Выполните миграцию начальных данных: `npm run migrate-channels`

## Примечания

- Данные хранятся в Firebase Firestore, сохраняются между перезапусками сервера
- Каналы и задачи генерации видео синхронизируются через Firestore
- Генерация идей и промптов использует OpenAI API (gpt-4o-mini)
- Голосовой ввод использует OpenAI Whisper для транскрипции речи (более надёжно, чем браузерный SpeechRecognition)
- Видео скачиваются локально в папку `downloads/` (можно настроить через `DOWNLOAD_DIR`)

