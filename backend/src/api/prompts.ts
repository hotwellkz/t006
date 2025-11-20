import { Router, Request, Response } from "express";
import { getChannelById } from "../models/channel";
import { generateVeoPrompt } from "../services/openaiService";

const router = Router();

// POST /api/prompts
router.post("/", async (req: Request, res: Response) => {
  try {
    const { channelId, idea } = req.body;

    if (!channelId || !idea) {
      return res.status(400).json({
        error: "Требуются поля: channelId, idea (с полями title и description)",
      });
    }

    if (!idea.title || !idea.description) {
      return res.status(400).json({
        error: "Идея должна содержать поля title и description",
      });
    }

    const channel = await getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Канал не найден" });
    }

    // Проверяем наличие OpenAI API ключа
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OpenAI API ключ не настроен. Установите OPENAI_API_KEY в .env",
      });
    }

    // Генерируем промпт и название через OpenAI
    const result = await generateVeoPrompt(channel, {
      title: idea.title,
      description: idea.description,
    });

    res.json({
      veoPrompt: result.veoPrompt,
      videoTitle: result.videoTitle,
    });
  } catch (error: unknown) {
    console.error("[API] Ошибка генерации промпта:", error);
    const message = error instanceof Error ? error.message : "Ошибка при генерации промпта";
    res.status(500).json({ error: message });
  }
});

export default router;

