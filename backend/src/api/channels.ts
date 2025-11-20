import { Router, Request, Response } from "express";
import {
  getAllChannels,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  Channel,
} from "../models/channel";

const router = Router();

// GET /api/channels
router.get("/", async (req: Request, res: Response) => {
  try {
    const channels = await getAllChannels();
    res.json(channels);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API] Ошибка при получении каналов:", errorMessage);
    
    // Если это ошибка Firebase, возвращаем более детальное сообщение
    if (errorMessage.includes("Firebase не инициализирован") || errorMessage.includes("FIREBASE_")) {
      console.error("[API] Firebase credentials отсутствуют или неверны");
      return res.status(500).json({ 
        error: "Firebase не настроен. Проверьте переменные окружения FIREBASE_* в Cloud Run.",
        details: errorMessage 
      });
    }
    
    res.status(500).json({ 
      error: "Ошибка при получении каналов",
      details: errorMessage 
    });
  }
});

// POST /api/channels
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      language,
      durationSeconds,
      ideaPromptTemplate,
      videoPromptTemplate,
      gdriveFolderId,
    } = req.body;

    // Валидация обязательных полей
    if (!name || !ideaPromptTemplate || !videoPromptTemplate) {
      return res.status(400).json({
        error: "Требуются поля: name, ideaPromptTemplate, videoPromptTemplate",
      });
    }

    // Генерируем ID из имени
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const channel = await createChannel({
      id,
      name,
      description: description || "",
      language: language || "ru",
      durationSeconds: durationSeconds || 8,
      ideaPromptTemplate,
      videoPromptTemplate,
      gdriveFolderId: gdriveFolderId || null,
    });

    res.json(channel);
  } catch (error) {
    console.error("Ошибка при создании канала:", error);
    res.status(500).json({ error: "Ошибка при создании канала" });
  }
});

// PUT /api/channels/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      language,
      durationSeconds,
      ideaPromptTemplate,
      videoPromptTemplate,
      gdriveFolderId,
    } = req.body;

    // Валидация обязательных полей
    if (!name || !ideaPromptTemplate || !videoPromptTemplate) {
      return res.status(400).json({
        error: "Требуются поля: name, ideaPromptTemplate, videoPromptTemplate",
      });
    }

    const updated = await updateChannel(id, {
      name,
      description: description || "",
      language: language || "ru",
      durationSeconds: durationSeconds || 8,
      ideaPromptTemplate,
      videoPromptTemplate,
      gdriveFolderId: gdriveFolderId || null,
    });

    if (!updated) {
      return res.status(404).json({ error: "Канал не найден" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Ошибка при обновлении канала:", error);
    res.status(500).json({ error: "Ошибка при обновлении канала" });
  }
});

// DELETE /api/channels/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await deleteChannel(id);

    if (!deleted) {
      return res.status(404).json({ error: "Канал не найден" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка при удалении канала:", error);
    res.status(500).json({ error: "Ошибка при удалении канала" });
  }
});

export default router;

