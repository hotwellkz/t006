# Настройка Firebase Firestore

## Получение Service Account Credentials

1. Перейдите в [Firebase Console](https://console.firebase.google.com/)
2. Выберите проект (или создайте новый)
3. Перейдите в **Project Settings** (⚙️) → **Service accounts**
4. Нажмите **Generate new private key**
5. Скачайте JSON файл с credentials

## Настройка переменных окружения

Скопируйте значения из скачанного JSON файла в `.env`:

```env
# Firebase (Firestore)
FIREBASE_PROJECT_ID=bibi-b7ce9
FIREBASE_PRIVATE_KEY_ID=fc921a371dd1cfe270c1bc6a2c6e9a3bee0db023
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCvi4Tz/LHE2BWM\n1hJk7jp9nON6AZ73xUnaOAcR3/F0HIqjx17Ot70NUtZi+csoq4wCojOMipzpgbs7\n2OXwnP7TvGaxuxmCClredEObYibJ3GW+u2rW65/BctPU+5EAmJAzdPcn2uyEivJQ\noQ595++OSwS+s4g2eWd2RyjAM3F5Sj3S5Q1Q5Uxghct7iJkd9efxJQv8jXid1YlI\nADQ24nRCzx6H1pRTn0mcBmoj91x7BaYb4CXKyJM1olfIr51oPoaDm9Jh0wRkCGAi\nuHkvKo/eWDxbmBfqkNIhXwU/nfHJAZmO8w5KpNwLwzBjZ6c2/qtW05Mbgi+R1+mP\n6VEjvNiFAgMBAAECggEAFYoKTOBbSkqJOmKklyXJSihkm6UfRZ+Q1D8TqanPYpkt\n7wfuJhx9Yekhd7uBUK2GhxGH6bKzAM5zlCr6QRptBLs/49w6i6426sdb6ZuSztSa\n11r/slHu+Y7cAcIW+fpo7Hy+5sZXRwbAJ2HbpASVbDbgOitP3Knre/kh6D4SVPix\noVVWM2GcC9CBfzHaUGWBmOT14wU8ActMuo79228JoX7ftJ0lnfDTyYZDJfjQvh2C\n08qGUf/9wO3Tu69N5BLMfjWkecP3QPuD1h9xHlBXSt5zzn6htjaoDaUf6UsvMX/t\nltz2RGjnIKm8A/paxbxblh7yXRU8uEUaJ/6QG7Ef8QKBgQDfxZ8blX9LXgduYPnp\ndJuiGKmig+R/X2d+VzWmZLncfUstodagcjkimSNQElT7OE8ADq2eTxogDi9zUEfM\nqYvA5AjjjyP5o5AFvAJ+UKhlumtYGiqz9QdM0z2lXTEt68imQtpy4po5bm0zatym\ntTtfEVMaORAlFbgaYADElOMPiwKBgQDI08o5nW/I+fGxoD6q1fhz/o+SIvHCY+7V\nJKDbgdy0nmfCmsxkm3Pvak77SX8FDnlTHEP+JjQqtakpW1E5x4xBEhJGPa3yyAXC\n+1ePChkOZ6iCNuhamAOR0UwyY4k7VOjWuek+BWC7sY5LUQ4eg6iDlh0WZ97GsN7q\nO9AuVoa6LwKBgGvlbgJu4yIEBLFEMTxP7XsLSUADOHnyFoTkqAnDJ5sZDtbB4isa\n6FG2ZUCGllNLo0vzx+M9YOtz640+eGBGoAwx59dRfZcxNpCNRuaBHbFvYbLpaw26\nZ/qzIFZLyRrLRcRlF8+tU4+9nwnbzOjVGfuM7vUF7rLy9gJBqB0hbRphAoGAILu0\niHOK1t02cddGn53Eo1Non08mzKJxOTiBJ4YhLSdsjiGhEvzrhqhzOy4dj/tt9wfy\nZShg9F0rt1v0/0/xImIJrH09Lwc/OSqyeNQShXCL3L2KXcnNOyU8IDJtGcibMvSW\nec9yluU35jrN7FdVTi1XjGFdxFDr5I3fPs5Ho20CgYEAioVZAno4LHZ3GM7cFt/I\ntvajb29k8Ddm/AHXNYXD0V3SILagPzMhZ8MMZuBd3RYqAna29+VHZqz2Zlj/VC5s\nzWjTlrIHZejw40PxqOxny0Ofi+2K7RV6g28iGgEfklTC+abvB6yM8WzaGrRFJhlv\nGcWhNj4d+xHpq/GMIEXlUH0=\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bibi-b7ce9.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=116571718701338136626
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40bibi-b7ce9.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
```

**Важно:** 
- `FIREBASE_PRIVATE_KEY` должен быть в кавычках и содержать `\n` для переносов строк
- Все значения должны быть скопированы точно из JSON файла

## Миграция начальных данных

После настройки Firebase credentials выполните миграцию начальных каналов:

```bash
cd backend
npm run migrate-channels
```

Это создаст три предустановленных канала в Firestore:
- `babushka-dedushka` - Бабушка и Дедушка Life
- `sipdeluxe` - SIPDeluxe.kz
- `hotwell` - HotWell.kz

## Структура данных в Firestore

### Коллекция `channels`
Каждый документ содержит:
- `id` (ID документа)
- `name` (string)
- `description` (string)
- `language` ("ru" | "kk" | "en")
- `durationSeconds` (number)
- `ideaPromptTemplate` (string)
- `videoPromptTemplate` (string)
- `gdriveFolderId` (string | null)

### Коллекция `videoJobs`
Каждый документ содержит:
- `id` (ID документа)
- `prompt` (string)
- `channelId` (string | null)
- `channelName` (string | null)
- `ideaText` (string | null)
- `videoTitle` (string | null)
- `localPath` (string | null)
- `status` (VideoJobStatus)
- `driveFileId` (string | null)
- `webViewLink` (string | null)
- `webContentLink` (string | null)
- `errorMessage` (string | null)
- `telegramRequestMessageId` (number | null)
- `createdAt` (number - timestamp)
- `updatedAt` (number - timestamp)

## Правила безопасности Firestore

Рекомендуется настроить правила безопасности в Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Только сервер (через Admin SDK) может читать/писать
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Поскольку мы используем Admin SDK, доступ к Firestore осуществляется только с сервера, и правила безопасности могут быть строгими.

