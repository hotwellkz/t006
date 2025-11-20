## Деплой backend в Google Cloud Run

Эти шаги выполняются из корня проекта (или из папки `backend/`). Предполагается, что у вас уже есть проект в Google Cloud и установлен `gcloud`.

### 1. Аутентификация и выбор проекта

```bash
gcloud auth login
gcloud config set project <ВАШ_PROJECT_ID>  # например, videobot-478618
```

### 2. Деплой из исходников

```bash
cd backend
gcloud run deploy whitecoding-backend \
  --source . \
  --region=europe-central2 \
  --platform=managed \
  --allow-unauthenticated
```

- `whitecoding-backend` — имя сервиса (можно изменить при необходимости).
- `--region` укажите тот, где уже включён Cloud Run.
- После выполнения команда выведет публичный URL вида `https://whitecoding-backend-xxxxx-uc.a.run.app` — сохраните его, он понадобится фронтенду и curl-проверкам.

### 3. Переменные окружения (Secrets)

Все чувствительные данные задаём через Cloud Run → **whitecoding-backend** → **Variables & Secrets**:

#### Обязательные переменные:

**OpenAI:**
```
OPENAI_API_KEY=sk-...
```

**Telegram:**
```
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890...
TELEGRAM_STRING_SESSION=...
SYNTX_BOT_USERNAME=syntxaibot
```

**Google Drive (OAuth2):**
```
GDRIVE_CLIENT_ID=...
GDRIVE_CLIENT_SECRET=...
GDRIVE_REFRESH_TOKEN=...
GDRIVE_FOLDER_ID=...  # ID папки по умолчанию
```

**Firebase (Firestore) - ОБЯЗАТЕЛЬНО:**
```
FIREBASE_PROJECT_ID=bibi-b7ce9
FIREBASE_PRIVATE_KEY_ID=fc921a371dd1cfe270c1bc6a2c6e9a3bee0db023
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bibi-b7ce9.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=116571718701338136626
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40bibi-b7ce9.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
```

**Системные:**
```
DOWNLOAD_DIR=/tmp
```

> ⚠️ **ВАЖНО:** 
> - `DOWNLOAD_DIR` на Cloud Run должен указывать на временную директорию (`/tmp`), т.к. файловая система только для короткого хранения.
> - `FIREBASE_PRIVATE_KEY` должен быть в кавычках и содержать `\n` для переносов строк (как в JSON).
> - `PORT` задавать не нужно — Cloud Run автоматически устанавливает `PORT=8080`, а сервер читает его из `process.env.PORT`.

#### Как добавить переменные в Cloud Run:

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Перейдите в **Cloud Run** → выберите сервис **whitecoding-backend**
3. Нажмите **Edit & Deploy New Revision**
4. Откройте вкладку **Variables & Secrets**
5. Добавьте каждую переменную через кнопку **Add Variable**
6. Для `FIREBASE_PRIVATE_KEY` используйте многострочный формат или вставьте как одну строку с `\n`

#### Проверка переменных Firebase:

После деплоя проверьте логи Cloud Run:
```bash
gcloud run services logs read whitecoding-backend --region=europe-central2 --limit=50
```

Должны увидеть:
```
🔥 Firebase инициализирован
[Firebase] ✅ Firebase Admin SDK инициализирован
```

Если видите ошибки типа `Firebase не инициализирован` или `FIREBASE_* должны быть заданы`, проверьте, что все переменные добавлены правильно.

### 4. Проверка

После деплоя:

```bash
curl https://whitecoding-backend-xxxxx-uc.a.run.app/health
curl https://whitecoding-backend-xxxxx-uc.a.run.app/api/channels
```

Если ответы 200 OK, сервис доступен.

Локальная проверка перед деплоем:

```bash
cd backend
npm install
npm run dev           # слушает http://localhost:4000
curl http://localhost:4000/api/channels
```

### 5. Связка с фронтендом (Netlify)

1. В Netlify → Site settings → Environment variables добавьте:

   ```
   VITE_API_URL=https://whitecoding-backend-xxxxx-uc.a.run.app
   ```

2. Запустите повторный деплой фронтенда (через кнопку **Deploy site** или новый `git push`).
3. После обновления переменной окружения фронт в production будет слать запросы на указанный URL. В dev-режиме `npm run dev` продолжит использовать proxy `/api → http://localhost:4000`.

### 6. Напоминания

- Файл `backend/.env` храните только локально (он уже в `.gitignore`).
- Все реальные ключи и токены задаются через Cloud Run Variables & Secrets и Netlify Environment variables.
- Для повторного деплоя достаточно снова выполнить команду `gcloud run deploy ...`.


