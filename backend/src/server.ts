import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import channelsRouter from "./api/channels";
import ideasRouter from "./api/ideas";
import promptsRouter from "./api/prompts";
import videoRouter from "./api/video";
import videoJobsRouter from "./api/videoJobs";
import transcribeRouter from "./api/transcribe";
import titleRouter from "./api/title";
import fcmRouter from "./api/fcm";
import { getTelegramClient } from "./telegram/client";
import { initializeFirebase } from "./firebase/admin";

// Загружаем переменные окружения
// Пытаемся загрузить из разных возможных мест
import * as path from "path";
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });
// Также пробуем загрузить из корня проекта
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/channels", channelsRouter);
app.use("/api/ideas", ideasRouter);
app.use("/api/prompts", promptsRouter);
app.use("/api/video", videoRouter);
app.use("/api/video-jobs", videoJobsRouter);
app.use("/api/transcribe-idea", transcribeRouter);
app.use("/api/generate-title", titleRouter);
app.use("/api/fcm", fcmRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Инициализация Firebase (неблокирующая)
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    initializeFirebase();
    console.log("🔥 Firebase инициализирован");
  } catch (error: any) {
    console.error("⚠️  Ошибка инициализации Firebase:", error.message);
    console.log("💡 Убедитесь, что все FIREBASE_* переменные установлены в .env");
  }
} else {
  console.warn("⚠️  Firebase не настроен (FIREBASE_PROJECT_ID не установлен)");
}

// Инициализация Telegram клиента и проверка бота при старте (неблокирующая)
// Важно: не блокируем запуск сервера, но логируем статус
if (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH) {
  (async () => {
    try {
      console.log("🔐 Инициализация Telegram клиента...");
      const client = await getTelegramClient();
      
      // Проверяем авторизацию еще раз
      const isAuthorized = await client.checkAuthorization();
      if (!isAuthorized) {
        console.warn("⚠️  Telegram клиент не авторизован. Выполните авторизацию.");
        return;
      }

      const botUsername = process.env.SYNTX_BOT_USERNAME || "syntxaibot";
      
      // Проверяем, что бот существует
      try {
        await client.getEntity(botUsername);
        console.log(`✅ Бот ${botUsername} найден и готов к работе`);
      } catch (error: any) {
        // Если ошибка авторизации, не критично - пользователь еще не авторизован
        if (error.errorMessage === 'AUTH_KEY_UNREGISTERED') {
          console.log("⏳ Ожидание авторизации в Telegram...");
        } else {
          console.error(`[ERROR] Bot username ${botUsername} not found. Проверь SYNTX_BOT_USERNAME.`);
          console.error(`Ошибка: ${error.message}`);
          console.log("💡 Убедитесь, что бот существует и вы подписаны на него в Telegram");
        }
      }
    } catch (error: any) {
      // Если это ошибка авторизации, это нормально при первом запуске
      if (error.message?.includes('AUTH_KEY_UNREGISTERED') || error.errorMessage === 'AUTH_KEY_UNREGISTERED') {
        console.log("⏳ Ожидание авторизации в Telegram...");
      } else {
        console.error("⚠️  Ошибка инициализации Telegram клиента:", error.message);
        console.log("💡 Убедитесь, что TELEGRAM_STRING_SESSION установлен или выполните авторизацию");
      }
    }
  })();
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен по адресу http://localhost:${PORT}/api`);
});

