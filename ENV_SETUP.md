# Настройка переменных окружения

Создайте файл `.env` в папке `backend/` со следующим содержимым:

```env
# Telegram (GramJS)
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_STRING_SESSION=
SYNTX_BOT_USERNAME=syntxaibot
DOWNLOAD_DIR=./downloads

# Для первичного интерактивного логина (если нужно)
TELEGRAM_PHONE_NUMBER=
TELEGRAM_2FA_PASSWORD=

# Google Drive (OAuth2)
GDRIVE_CLIENT_ID=
GDRIVE_CLIENT_SECRET=
GDRIVE_REFRESH_TOKEN=
GDRIVE_FOLDER_ID=

# HTTP сервер
PORT=4000
```

## Как получить значения:

### Telegram API credentials:
1. Перейдите на https://my.telegram.org/apps
2. Войдите в свой аккаунт
3. Создайте приложение и получите `api_id` и `api_hash`
4. При первом запуске backend попросит авторизоваться, после чего скопируйте `TELEGRAM_STRING_SESSION` из консоли

### Google Drive (OAuth2):
1. Создайте проект в Google Cloud Console (https://console.cloud.google.com/)
2. Включите Google Drive API
3. Создайте OAuth 2.0 Client ID:
   - Перейдите в "APIs & Services" → "Credentials"
   - Нажмите "Create Credentials" → "OAuth client ID"
   - Выберите "Desktop app" или "Web application"
   - Добавьте redirect URI: `http://localhost:3000/oauth2callback`
   - Скопируйте `Client ID` в `GDRIVE_CLIENT_ID`
   - Скопируйте `Client secret` в `GDRIVE_CLIENT_SECRET`
4. Получите refresh_token:
   - Запустите: `npm run get-drive-token` в папке backend
   - Скрипт выведет OAuth-ссылку для авторизации
   - Откройте ссылку в браузере и авторизуйтесь в Google
   - Разрешите доступ к Google Drive
   - После авторизации скрипт автоматически получит код и обменяет его на refresh_token
   - Скрипт автоматически добавит `GDRIVE_REFRESH_TOKEN` в `.env` файл
   - Если автоматическое обновление не сработало, скопируйте `GDRIVE_REFRESH_TOKEN` из консоли в `.env` вручную
5. Получите ID папки в Google Drive и укажите в `GDRIVE_FOLDER_ID`

## Frontend (Vite)

Создайте файл `frontend/.env` со значением:

```
VITE_API_URL=https://your-backend-api.example.com
```

В dev-режиме эта переменная опциональна (Vite использует proxy `/api → http://localhost:4000`).  
В production (например, на Netlify) она обязательна — иначе запросы пойдут на домен фронтенда и вернут 404.

