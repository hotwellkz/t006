import { Router, Request, Response } from "express";
import { generateTitle } from "../services/openaiService";

const router = Router();

/**
 * POST /api/generate-title
 * Генерирует название видео на основе промпта для Veo
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { prompt, channelName, language } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Требуется поле prompt (непустая строка)" });
    }

    // Проверяем наличие OpenAI API ключа
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OpenAI API ключ не настроен. Установите OPENAI_API_KEY в .env",
      });
    }

    console.log(`[Title] Generating title for prompt (length: ${prompt.length}), channel: ${channelName || "не указан"}, language: ${language || "ru"}`);

    try {
      const title = await generateTitle(
        prompt.trim(),
        channelName || undefined,
        language || "ru"
      );

      console.log(`[Title] Generated title: ${title}`);

      res.json({ title });
    } catch (error: unknown) {
      console.error("[Title] Error generating title:", error);
      const message = error instanceof Error ? error.message : "Ошибка при генерации названия";
      res.status(500).json({
        error: "Ошибка при генерации названия",
        message: message,
      });
    }
  } catch (error: unknown) {
    console.error("[Title] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    res.status(500).json({
      error: "Внутренняя ошибка сервера",
      message: message,
    });
  }
});

export default router;

