/**
 * Тестовый скрипт для проверки загрузки файла в Google Drive
 * Запуск: npx ts-node src/test-drive-upload.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { uploadFileToDrive } from "./googleDrive/driveService";

// Загружаем переменные окружения
const envPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: envPath });
dotenv.config();

async function testUpload() {
  console.log("=== Тест загрузки в Google Drive ===\n");

  // Проверяем переменные окружения
  console.log("Проверка переменных окружения:");
  console.log("GDRIVE_FOLDER_ID:", process.env.GDRIVE_FOLDER_ID || "НЕ ЗАДАН");
  console.log("GDRIVE_CLIENT_ID:", process.env.GDRIVE_CLIENT_ID ? "ЗАДАН" : "НЕ ЗАДАН");
  console.log("GDRIVE_CLIENT_SECRET:", process.env.GDRIVE_CLIENT_SECRET ? "ЗАДАН" : "НЕ ЗАДАН");
  console.log("GDRIVE_REFRESH_TOKEN:", process.env.GDRIVE_REFRESH_TOKEN ? "ЗАДАН" : "НЕ ЗАДАН");
  console.log("");

  if (!process.env.GDRIVE_FOLDER_ID) {
    console.error("❌ GDRIVE_FOLDER_ID не задан в .env");
    process.exit(1);
  }

  // Ищем тестовый файл в папке downloads
  const downloadsDir = path.join(__dirname, "..", "downloads");
  if (!fs.existsSync(downloadsDir)) {
    console.error(`❌ Папка downloads не найдена: ${downloadsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(downloadsDir)
    .filter((f) => f.endsWith(".mp4"))
    .map((f) => path.join(downloadsDir, f));

  if (files.length === 0) {
    console.error("❌ Не найдено .mp4 файлов в папке downloads");
    process.exit(1);
  }

  const testFile = files[0];
  const fileName = `test_${Date.now()}.mp4`;

  console.log(`Используем файл: ${testFile}`);
  console.log(`Имя файла в Drive: ${fileName}`);
  console.log(`Папка назначения: ${process.env.GDRIVE_FOLDER_ID}`);
  console.log("");

  try {
    console.log("Начинаем загрузку...\n");
    const result = await uploadFileToDrive(testFile, fileName);

    console.log("\n✅ Успешно загружено!");
    console.log("File ID:", result.fileId);
    console.log("Web View Link:", result.webViewLink);
    console.log("Web Content Link:", result.webContentLink);
    console.log(
      "\nПроверьте папку '001 для публикации' в вашем Google Drive"
    );
  } catch (error: any) {
    console.error("\n❌ Ошибка загрузки:");
    console.error(error.message);
    if (error.response?.data) {
      console.error("Детали ошибки:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testUpload();

