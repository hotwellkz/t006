/**
 * Скрипт для получения refresh_token для Google Drive OAuth2
 * Запуск: npx ts-node tools/getDriveRefreshToken.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { google } from "googleapis";
import * as http from "http";
import * as url from "url";

// Загружаем переменные окружения
const envPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: envPath });
dotenv.config();

const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/oauth2callback";
const PORT = 3000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Ошибка: GDRIVE_CLIENT_ID и GDRIVE_CLIENT_SECRET должны быть заданы в .env");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Генерируем URL для авторизации
// Используем generateAuthUrl, но затем гарантируем наличие всех параметров
const scopes = ["https://www.googleapis.com/auth/drive.file"];
let authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
  prompt: "consent", // Важно: запрашиваем refresh_token
});

// Гарантируем наличие всех обязательных параметров
const urlObj = new URL(authUrl);
if (!urlObj.searchParams.has("response_type")) {
  urlObj.searchParams.set("response_type", "code");
}
if (!urlObj.searchParams.has("client_id")) {
  urlObj.searchParams.set("client_id", CLIENT_ID);
}
if (!urlObj.searchParams.has("redirect_uri")) {
  urlObj.searchParams.set("redirect_uri", REDIRECT_URI);
}
if (!urlObj.searchParams.has("scope")) {
  urlObj.searchParams.set("scope", scopes.join(" "));
}
if (!urlObj.searchParams.has("access_type")) {
  urlObj.searchParams.set("access_type", "offline");
}
if (!urlObj.searchParams.has("prompt")) {
  urlObj.searchParams.set("prompt", "consent");
}

authUrl = urlObj.toString();

console.log("\n=== Получение refresh_token для Google Drive ===\n");
console.log("1. Откройте эту ссылку в браузере:");
console.log("\n" + authUrl + "\n");
console.log("2. Авторизуйтесь в Google и разрешите доступ к Google Drive");
console.log("3. После авторизации вы будете перенаправлены на локальный сервер");
console.log("4. Скрипт автоматически получит код и обменяет его на refresh_token\n");
console.log("Ожидание кода авторизации...\n");

// Создаём HTTP сервер для приёма кода
const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const code = parsedUrl.query.code as string;

  if (code) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html>
        <head><title>Успешно</title></head>
        <body style="font-family: Arial; padding: 20px;">
          <h1>✅ Код получен!</h1>
          <p>Можно закрыть эту страницу и вернуться в консоль.</p>
        </body>
      </html>
    `);

    try {
      // Обмениваем код на токены
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.refresh_token) {
        console.error("\n❌ Ошибка: refresh_token не получен");
        console.log("💡 Попробуйте снова. Убедитесь, что в URL авторизации есть prompt=consent");
        process.exit(1);
      }

      console.log("\n✅ Успешно получен refresh_token!\n");
      
      // Пытаемся автоматически обновить .env файл
      const envFilePath = path.join(__dirname, "..", ".env");
      let envUpdated = false;
      
      try {
        if (fs.existsSync(envFilePath)) {
          let envContent = fs.readFileSync(envFilePath, "utf-8");
          
          // Проверяем, есть ли уже GDRIVE_REFRESH_TOKEN
          if (envContent.includes("GDRIVE_REFRESH_TOKEN=")) {
            // Обновляем существующую строку
            envContent = envContent.replace(
              /GDRIVE_REFRESH_TOKEN=.*/g,
              `GDRIVE_REFRESH_TOKEN=${tokens.refresh_token}`
            );
          } else {
            // Добавляем новую строку
            envContent += `\nGDRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
          }
          
          fs.writeFileSync(envFilePath, envContent, "utf-8");
          envUpdated = true;
          console.log("✅ refresh_token автоматически добавлен в .env файл!\n");
        }
      } catch (error) {
        console.log("⚠️  Не удалось автоматически обновить .env файл\n");
      }
      
      if (!envUpdated) {
        console.log("=== Скопируйте эту строку в .env файл ===\n");
        console.log(`GDRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
        console.log("==========================================\n");
      }

      server.close();
      process.exit(0);
    } catch (error: unknown) {
      console.error("\n❌ Ошибка при получении токена:");
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error(error);
      }
      server.close();
      process.exit(1);
    }
  } else {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html>
        <head><title>Ошибка</title></head>
        <body style="font-family: Arial; padding: 20px;">
          <h1>❌ Код не найден</h1>
          <p>Попробуйте снова.</p>
        </body>
      </html>
    `);
  }
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log("Готов к приёму кода авторизации...\n");
});

// Обработка закрытия сервера
process.on("SIGINT", () => {
  console.log("\n\nСервер остановлен");
  server.close();
  process.exit(0);
});

