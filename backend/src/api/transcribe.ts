import { Router, Request, Response } from "express";
import multer from "multer";
import OpenAI from "openai";
import { FormData, File } from "formdata-node";

const router = Router();

// Настройка multer для загрузки файлов в память
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум
  },
  fileFilter: (req, file, cb) => {
    // Принимаем аудио файлы
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Только аудио файлы разрешены"));
    }
  },
});

// Инициализация OpenAI клиента (ленивая)
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY не установлен в переменных окружения");
    }
    openaiClient = new OpenAI({
      apiKey,
    });
  }
  return openaiClient;
}

/**
 * POST /api/transcribe-idea
 * Принимает аудио файл и возвращает транскрипцию через OpenAI Whisper
 */
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Файл не предоставлен" });
    }

    const fileSize = req.file.buffer.length;
    console.log(`[transcribe] received audio, size: ${fileSize} bytes, mimetype: ${req.file.mimetype}`);

    // Проверяем наличие OpenAI API ключа
    if (!process.env.OPENAI_API_KEY) {
      console.error("[transcribe] OPENAI_API_KEY not set");
      return res.status(500).json({
        error: "OpenAI API ключ не настроен. Установите OPENAI_API_KEY в .env",
      });
    }

    const client = getOpenAIClient();

    // Определяем расширение файла на основе mimetype
    let extension = "webm";
    if (req.file.mimetype.includes("ogg")) extension = "ogg";
    if (req.file.mimetype.includes("mp4")) extension = "mp4";
    if (req.file.mimetype.includes("wav")) extension = "wav";
    if (req.file.mimetype.includes("mp3")) extension = "mp3";

    const fileName = req.file.originalname || `audio.${extension}`;

    console.log("[transcribe] Sending to OpenAI Whisper...");
    console.log(`[transcribe] File name: ${fileName}, size: ${req.file.buffer.length} bytes, type: ${req.file.mimetype}`);

    try {
      // Используем FormData для создания multipart/form-data запроса
      // OpenAI SDK требует правильную сериализацию файла
      const formData = new FormData();
      const audioFile = new File(
        [req.file.buffer],
        fileName,
        {
          type: req.file.mimetype,
        }
      );
      formData.append("file", audioFile);
      formData.append("model", "whisper-1");
      formData.append("language", "ru");
      formData.append("response_format", "text");

      // Вызываем OpenAI Whisper API напрямую через fetch
      // Это обходной путь для проблемы с сериализацией File в OpenAI SDK
      const apiKey = process.env.OPENAI_API_KEY!;
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[transcribe] OpenAI API error:", errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const transcription = await response.text();

      // OpenAI возвращает строку напрямую при response_format: "text"
      const text = transcription.trim();

      const textPreview = text.length > 100 ? text.substring(0, 100) + "..." : text;
      console.log(`[transcribe] transcription result: ${textPreview}`);

      if (!text || text.trim().length === 0) {
        console.warn("[transcribe] Empty transcription result");
        return res.status(400).json({
          error: "Не удалось распознать речь. Попробуйте ещё раз или введите текст вручную.",
        });
      }

      res.json({ text: text.trim() });
    } catch (error: unknown) {
      throw error; // Пробрасываем ошибку дальше
    }
  } catch (error: unknown) {
    console.error("[transcribe] error:", error);
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    res.status(500).json({
      error: "Ошибка при транскрипции аудио",
      message: message,
    });
  }
});

export default router;

