# Настройка Firebase в Cloud Run

## Проблема: Ошибка 500 при запросе `/api/channels`

Если вы видите ошибку `500 Internal Server Error` при попытке получить каналы, это означает, что Firebase не настроен в Cloud Run.

## Решение: Добавить переменные окружения Firebase

### Шаг 1: Откройте Cloud Run Console

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите проект (например, `videobot-478618`)
3. Перейдите в **Cloud Run** → выберите сервис `whitecoding-backend`
4. Нажмите **Edit & Deploy New Revision**

### Шаг 2: Добавьте переменные окружения

Откройте вкладку **Variables & Secrets** и добавьте следующие переменные:

#### Обязательные переменные Firebase:

```
FIREBASE_PROJECT_ID=bibi-b7ce9
FIREBASE_PRIVATE_KEY_ID=fc921a371dd1cfe270c1bc6a2c6e9a3bee0db023
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCvi4Tz/LHE2BWM\n1hJk7jp9nON6AZ73xUnaOAcR3/F0HIqjx17Ot70NUtZi+csoq4wCojOMipzpgbs7\n2OXwnP7TvGaxuxmCClredEObYibJ3GW+u2rW65/BctPU+5EAmJAzdPcn2uyEivJQ\noQ595++OSwS+s4g2eWd2RyjAM3F5Sj3S5Q1Q5Uxghct7iJkd9efxJQv8jXid1YlI\nADQ24nRCzx6H1pRTn0mcBmoj91x7BaYb4CXKyJM1olfIr51oPoaDm9Jh0wRkCGAi\nuHkvKo/eWDxbmBfqkNIhXwU/nfHJAZmO8w5KpNwLwzBjZ6c2/qtW05Mbgi+R1+mP\n6VEjvNiFAgMBAAECggEAFYoKTOBbSkqJOmKklyXJSihkm6UfRZ+Q1D8TqanPYpkt\n7wfuJhx9Yekhd7uBUK2GhxGH6bKzAM5zlCr6QRptBLs/49w6i6426sdb6ZuSztSa\n11r/slHu+Y7cAcIW+fpo7Hy+5sZXRwbAJ2HbpASVbDbgOitP3Knre/kh6D4SVPix\noVVWM2GcC9CBfzHaUGWBmOT14wU8ActMuo79228JoX7ftJ0lnfDTyYZDJfjQvh2C\n08qGUf/9wO3Tu69N5BLMfjWkecP3QPuD1h9xHlBXSt5zzn6htjaoDaUf6UsvMX/t\nltz2RGjnIKm8A/paxbxblh7yXRU8uEUaJ/6QG7Ef8QKBgQDfxZ8blX9LXgduYPnp\ndJuiGKmig+R/X2d+VzWmZLncfUstodagcjkimSNQElT7OE8ADq2eTxogDi9zUEfM\nqYvA5AjjjyP5o5AFvAJ+UKhlumtYGiqz9QdM0z2lXTEt68imQtpy4po5bm0zatym\ntTtfEVMaORAlFbgaYADElOMPiwKBgQDI08o5nW/I+fGxoD6q1fhz/o+SIvHCY+7V\nJKDbgdy0nmfCmsxkm3Pvak77SX8FDnlTHEP+JjQqtakpW1E5x4xBEhJGPa3yyAXC\n+1ePChkOZ6iCNuhamAOR0UwyY4k7VOjWuek+BWC7sY5LUQ4eg6iDlh0WZ97GsN7q\nO9AuVoa6LwKBgGvlbgJu4yIEBLFEMTxP7XsLSUADOHnyFoTkqAnDJ5sZDtbB4isa\n6FG2ZUCGllNLo0vzx+M9YOtz640+eGBGoAwx59dRfZcxNpCNRuaBHbFvYbLpaw26\nZ/qzIFZLyRrLRcRlF8+tU4+9nwnbzOjVGfuM7vUF7rLy9gJBqB0hbRphAoGAILu0\niHOK1t02cddGn53Eo1Non08mzKJxOTiBJ4YhLSdsjiGhEvzrhqhzOy4dj/tt9wfy\nZShg9F0rt1v0/0/xImIJrH09Lwc/OSqyeNQShXCL3L2KXcnNOyU8IDJtGcibMvSW\nec9yluU35jrN7FdVTi1XjGFdxFDr5I3fPs5Ho20CgYEAioVZAno4LHZ3GM7cFt/I\ntvajb29k8Ddm/AHXNYXD0V3SILagPzMhZ8MMZuBd3RYqAna29+VHZqz2Zlj/VC5s\nzWjTlrIHZejw40PxqOxny0Ofi+2K7RV6g28iGgEfklTCvabvB6yM8WzaGrRFJhlv\nGcWhNj4d+xHpq/GMIEXlUH0=\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bibi-b7ce9.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=116571718701338136626
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40bibi-b7ce9.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
```

> ⚠️ **ВАЖНО:** 
> - `FIREBASE_PRIVATE_KEY` должен быть в кавычках и содержать `\n` для переносов строк
> - В Cloud Run Console можно вставить ключ как многострочный текст (без кавычек), система автоматически обработает переносы строк

### Шаг 3: Сохраните и задеплойте

1. Нажмите **Deploy** (или **Save**)
2. Дождитесь завершения деплоя (обычно 1-2 минуты)

### Шаг 4: Проверьте логи

После деплоя проверьте логи Cloud Run:

```bash
gcloud run services logs read whitecoding-backend --region=europe-central2 --limit=20
```

Или через веб-интерфейс:
1. Cloud Run → `whitecoding-backend` → вкладка **Logs**

Должны увидеть:
```
🔥 Firebase инициализирован
[Firebase] ✅ Firebase Admin SDK инициализирован
```

### Шаг 5: Проверьте API

Проверьте, что API работает:

```bash
curl https://whitecoding-backend-487498983516.europe-central2.run.app/api/channels
```

Должен вернуться JSON-массив (может быть пустым `[]`, если каналы ещё не созданы).

## Если ошибка сохраняется

1. **Проверьте логи Cloud Run** на наличие ошибок Firebase
2. **Убедитесь, что все переменные добавлены** (особенно `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`)
3. **Проверьте формат `FIREBASE_PRIVATE_KEY`** — он должен содержать `\n` для переносов строк
4. **Убедитесь, что Firebase проект активен** и Firestore включён

## Создание начальных каналов

После успешной настройки Firebase, выполните миграцию каналов:

```bash
# Локально (если у вас есть доступ к Firebase)
cd backend
npm run migrate-channels
```

Или создайте каналы через API:

```bash
curl -X POST https://whitecoding-backend-487498983516.europe-central2.run.app/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Бабушка и Дедушка Life",
    "description": "Семейный юмор",
    "language": "ru",
    "durationSeconds": 8,
    "ideaPromptTemplate": "...",
    "videoPromptTemplate": "..."
  }'
```

