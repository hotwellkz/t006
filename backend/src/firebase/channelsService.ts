import { getFirestore } from "./admin";
import { Channel } from "../models/channel";

const COLLECTION_NAME = "channels";

/**
 * Получить все каналы из Firestore
 */
export async function getAllChannels(): Promise<Channel[]> {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    const channels: Channel[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      channels.push({
        id: doc.id,
        name: data.name || "",
        description: data.description || "",
        language: data.language || "ru",
        durationSeconds: data.durationSeconds || 8,
        ideaPromptTemplate: data.ideaPromptTemplate || "",
        videoPromptTemplate: data.videoPromptTemplate || "",
        gdriveFolderId: data.gdriveFolderId || null,
      } as Channel);
    });

    console.log(`[Firebase] ✅ Получено ${channels.length} каналов`);
    return channels;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Firebase] ❌ Error getting channels:", errorMessage);
    
    // Если Firebase не настроен, возвращаем пустой массив вместо ошибки
    if (errorMessage.includes("Firebase не инициализирован") || errorMessage.includes("FIREBASE_")) {
      console.warn("[Firebase] ⚠️  Firebase не настроен, возвращаем пустой массив каналов");
      return [];
    }
    
    throw new Error(`Ошибка получения каналов: ${errorMessage}`);
  }
}

/**
 * Получить канал по ID
 */
export async function getChannelById(id: string): Promise<Channel | undefined> {
  try {
    const db = getFirestore();
    const doc = await db.collection(COLLECTION_NAME).doc(id).get();
    
    if (!doc.exists) {
      return undefined;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Channel;
  } catch (error: unknown) {
    console.error(`[Firebase] Error getting channel ${id}:`, error);
    throw new Error(`Ошибка получения канала: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Создать канал в Firestore
 */
export async function createChannel(channel: Channel): Promise<Channel> {
  try {
    const db = getFirestore();
    const channelRef = db.collection(COLLECTION_NAME).doc(channel.id);
    
    await channelRef.set({
      name: channel.name,
      description: channel.description,
      language: channel.language,
      durationSeconds: channel.durationSeconds,
      ideaPromptTemplate: channel.ideaPromptTemplate,
      videoPromptTemplate: channel.videoPromptTemplate,
      gdriveFolderId: channel.gdriveFolderId || null,
    });

    console.log(`[Firebase] ✅ Channel created: ${channel.id}`);
    return channel;
  } catch (error: unknown) {
    console.error(`[Firebase] Error creating channel ${channel.id}:`, error);
    throw new Error(`Ошибка создания канала: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Обновить канал в Firestore
 */
export async function updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | null> {
  try {
    const db = getFirestore();
    const channelRef = db.collection(COLLECTION_NAME).doc(id);
    
    const doc = await channelRef.get();
    if (!doc.exists) {
      return null;
    }

    // Удаляем id из updates, если он там есть (id не обновляется)
    const { id: _, ...updateData } = updates as any;
    
    await channelRef.update(updateData);

    const updatedDoc = await channelRef.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as Channel;
  } catch (error: unknown) {
    console.error(`[Firebase] Error updating channel ${id}:`, error);
    throw new Error(`Ошибка обновления канала: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Удалить канал из Firestore
 */
export async function deleteChannel(id: string): Promise<boolean> {
  try {
    const db = getFirestore();
    const channelRef = db.collection(COLLECTION_NAME).doc(id);
    
    const doc = await channelRef.get();
    if (!doc.exists) {
      return false;
    }

    await channelRef.delete();
    console.log(`[Firebase] ✅ Channel deleted: ${id}`);
    return true;
  } catch (error: unknown) {
    console.error(`[Firebase] Error deleting channel ${id}:`, error);
    throw new Error(`Ошибка удаления канала: ${error instanceof Error ? error.message : String(error)}`);
  }
}

