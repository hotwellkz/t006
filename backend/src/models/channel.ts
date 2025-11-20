export type Language = "ru" | "kk" | "en";

export interface Channel {
  id: string;
  name: string;
  description: string; // Краткое описание стиля канала
  language: Language; // Основной язык ролика
  durationSeconds: number; // Целевая длительность (по умолчанию 8)
  ideaPromptTemplate: string; // Шаблон промпта для генерации идей
  videoPromptTemplate: string; // Шаблон промпта для генерации финального промпта Veo
  gdriveFolderId?: string | null; // ID папки Google Drive для этого канала (если null, используется GDRIVE_FOLDER_ID из .env)
}

// Экспортируем функции из Firebase сервиса
export {
  getAllChannels,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
} from "../firebase/channelsService";

