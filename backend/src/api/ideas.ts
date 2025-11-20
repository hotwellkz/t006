import { Router, Request, Response } from "express";
import { getChannelById } from "../models/channel";
import { generateIdeas } from "../services/openaiService";

const router = Router();

// POST /api/ideas
router.post("/", async (req: Request, res: Response) => {
  try {
    const { channelId, theme, count } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: "Требуется channelId" });
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

    // Генерируем идеи через OpenAI
    const ideas = await generateIdeas(channel, theme || null, count || 5);

    res.json({ ideas });
  } catch (error: unknown) {
    console.error("[API] Ошибка генерации идей:", error);
    const message = error instanceof Error ? error.message : "Ошибка при генерации идей";
    res.status(500).json({ error: message });
  }
});

export default router;

