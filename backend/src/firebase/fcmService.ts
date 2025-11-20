import { getFirestore } from "./admin";
import * as admin from "firebase-admin";

const FCM_TOKENS_COLLECTION = "fcmTokens";

/**
 * Сохранить FCM токен устройства
 */
export async function saveFCMToken(token: string, userId?: string): Promise<void> {
  try {
    const db = getFirestore();
    const tokenRef = db.collection(FCM_TOKENS_COLLECTION).doc(token);
    
    await tokenRef.set({
      token,
      userId: userId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[FCM] ✅ Token saved: ${token.substring(0, 20)}...`);
  } catch (error: unknown) {
    console.error(`[FCM] ❌ Error saving token:`, error);
    throw new Error(`Ошибка сохранения FCM токена: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Удалить FCM токен
 */
export async function deleteFCMToken(token: string): Promise<void> {
  try {
    const db = getFirestore();
    const tokenRef = db.collection(FCM_TOKENS_COLLECTION).doc(token);
    await tokenRef.delete();
    console.log(`[FCM] ✅ Token deleted: ${token.substring(0, 20)}...`);
  } catch (error: unknown) {
    console.error(`[FCM] ❌ Error deleting token:`, error);
    throw new Error(`Ошибка удаления FCM токена: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Получить все активные FCM токены (или для конкретного пользователя)
 */
export async function getFCMTokens(userId?: string): Promise<string[]> {
  try {
    const db = getFirestore();
    let query: admin.firestore.Query = db.collection(FCM_TOKENS_COLLECTION);
    
    if (userId) {
      query = query.where("userId", "==", userId);
    }

    const snapshot = await query.get();
    const tokens: string[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    return tokens;
  } catch (error: unknown) {
    console.error("[FCM] ❌ Error getting tokens:", error);
    throw new Error(`Ошибка получения FCM токенов: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Отправить push-уведомление через FCM
 */
export async function sendFCMNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (tokens.length === 0) {
    console.log("[FCM] No tokens to send notification");
    return;
  }

  try {
    const app = admin.app();
    const messaging = app.messaging();

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens,
      webpush: {
        fcmOptions: {
          link: data?.link || "/",
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    
    console.log(`[FCM] ✅ Sent ${response.successCount} notifications, ${response.failureCount} failed`);
    
    // Удаляем невалидные токены
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error?.code === "messaging/invalid-registration-token" ||
            error?.code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      // Удаляем невалидные токены из базы
      for (const token of invalidTokens) {
        await deleteFCMToken(token).catch((err) => {
          console.error(`[FCM] Error deleting invalid token:`, err);
        });
      }
    }
  } catch (error: unknown) {
    console.error("[FCM] ❌ Error sending notification:", error);
    throw new Error(`Ошибка отправки FCM уведомления: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Отправить уведомление о готовности видео
 */
export async function notifyVideoReady(jobId: string, videoTitle: string, userId?: string): Promise<void> {
  try {
    const tokens = await getFCMTokens(userId);
    
    if (tokens.length === 0) {
      console.log(`[FCM] No tokens found for video ready notification (jobId: ${jobId})`);
      return;
    }

    const title = "Видео готово";
    const body = `Ролик "${videoTitle}" сгенерирован и готов к просмотру`;
    
    await sendFCMNotification(tokens, title, body, {
      type: "video_ready",
      jobId,
      link: `/video-jobs/${jobId}`,
    });

    console.log(`[FCM] ✅ Video ready notification sent for job ${jobId}`);
  } catch (error: unknown) {
    console.error(`[FCM] ❌ Error sending video ready notification:`, error);
    // Не пробрасываем ошибку, чтобы не ломать основной процесс
  }
}

