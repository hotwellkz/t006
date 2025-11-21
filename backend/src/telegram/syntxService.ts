import { TelegramClient, Api } from "telegram";
import * as fs from "fs";
import * as path from "path";
import { getTelegramClient } from "./client";
import { getAllJobs } from "../firebase/videoJobsService";

export interface SyntxResult {
  localPath: string;
  requestMessageId: number;
  videoMessageId: number; // ID сообщения с видео от бота
}

/**
 * Добавляет маркер jobId в промпт
 */
function addJobIdToPrompt(prompt: string, jobId: string): string {
  const marker = `[JOB_ID: ${jobId}]`;
  // Добавляем маркер в конец промпта
  return `${prompt}\n\n${marker}`;
}

/**
 * Извлекает jobId из текста сообщения
 */
function extractJobIdFromText(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\[JOB_ID:\s*([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

export async function sendPromptToSyntx(
  prompt: string,
  customFileName?: string,
  jobId?: string, // jobId для маркировки промпта
  requestMessageId?: number // Если передан, ищем ответ на это сообщение (legacy)
): Promise<SyntxResult> {
  const client = await getTelegramClient();
  const botUsername = process.env.SYNTX_BOT_USERNAME || "syntxaibot";

  try {
    // Проверяем, что клиент авторизован
    const isAuthorized = await client.checkAuthorization();
    if (!isAuthorized) {
      throw new Error("Telegram клиент не авторизован. Выполните авторизацию перед использованием.");
    }

    console.log(`[Syntx] Проверяем доступность бота ${botUsername}...`);
    
    // Получаем чат бота
    const entity = await client.getEntity(botUsername);
    
    // Отправляем промпт
    let actualRequestMessageId: number;
    let actualJobId: string;
    
    if (requestMessageId && !jobId) {
      // Legacy режим: используем существующий requestMessageId (для обратной совместимости)
      actualRequestMessageId = requestMessageId;
      actualJobId = `legacy_${requestMessageId}`;
      console.log(`[Syntx] Используем существующий requestMessageId: ${actualRequestMessageId} (legacy режим)`);
    } else {
      // Новый режим: добавляем jobId в промпт
      if (!jobId) {
        throw new Error("jobId обязателен для отправки промпта в Syntax");
      }
      actualJobId = jobId;
      
      // Добавляем маркер jobId в промпт
      const promptWithJobId = addJobIdToPrompt(prompt, actualJobId);
      console.log(`[Syntx] Отправляем промпт боту ${botUsername} с jobId: ${actualJobId}...`);
      const sentMessage = await client.sendMessage(entity, { message: promptWithJobId });
      actualRequestMessageId = sentMessage.id;
      console.log(`[Syntx] ✅ Промпт отправлен боту ${botUsername}, message ID: ${actualRequestMessageId}, jobId: ${actualJobId}`);
    }

    console.log(`[Syntx] Ожидаем видео для jobId ${actualJobId} (таймаут: 30 минут)...`);

    // Ищем видео по jobId
    const videoMessage = await waitForSyntxVideoByJobId(
      client,
      entity,
      actualJobId,
      30 * 60 * 1000 // 30 минут
    );

    // Подготавливаем директорию для загрузок с абсолютным путём
    const downloadRoot = process.env.DOWNLOAD_DIR || "./downloads";
    const downloadDir = path.resolve(downloadRoot);
    
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
      console.log(`[Syntx] Создана директория для загрузок: ${downloadDir}`);
    }
    
    console.log(`[Syntx] Download directory: ${downloadDir}`);

    // Генерируем имя файла (используем customFileName если указан, иначе дефолтное)
    const timestamp = Date.now();
    const fileName = customFileName || `syntx_${timestamp}.mp4`;
    const filePath = path.join(downloadDir, fileName);
    
    console.log(`[Syntx] Target file path: ${filePath}`);

    // Логируем информацию о медиа перед скачиванием
    console.log("[Syntx] Message media info:", {
      messageId: videoMessage.id,
      hasMedia: !!videoMessage.media,
      mediaType: videoMessage.media?.constructor?.name || "unknown",
    });

    // Скачиваем видео с проверкой результата
    console.log("[Syntx] Starting download...");
    
    try {
      // Пробуем скачать через опцию file
      await client.downloadMedia(videoMessage, {
        outputFile: filePath,
      });

      // Проверяем, что файл реально появился
      await new Promise((resolve) => setTimeout(resolve, 500)); // Небольшая задержка для завершения записи
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File was not created at ${filePath}`);
      }

      const stat = fs.statSync(filePath);
      console.log(`[Syntx] File downloaded, size: ${stat.size} bytes`);
      
      if (stat.size === 0) {
        throw new Error("Downloaded file has size 0 bytes");
      }

      console.log(`[Syntx] ✅ Видео успешно скачано: ${filePath}`);
      return {
        localPath: filePath,
        requestMessageId: actualRequestMessageId,
        videoMessageId: videoMessage.id,
      };
    } catch (err: any) {
      console.error("[Syntx] Error while downloading media (file mode):", err);
      
      // Если опция file не сработала, пробуем через Buffer
      console.log("[Syntx] Trying buffer mode...");
      
      try {
        const buffer = (await client.downloadMedia(videoMessage, {})) as Buffer;
        
        if (!buffer || !buffer.length) {
          throw new Error("downloadMedia returned empty buffer");
        }

        fs.writeFileSync(filePath, buffer);
        const stat = fs.statSync(filePath);
        console.log(`[Syntx] File saved (buffer mode), size: ${stat.size} bytes`);
        
        if (stat.size === 0) {
          throw new Error("Saved file has size 0 bytes");
        }

        console.log(`[Syntx] ✅ Видео успешно скачано (buffer mode): ${filePath}`);
        return {
          localPath: filePath,
          requestMessageId: actualRequestMessageId,
          videoMessageId: videoMessage.id,
        };
      } catch (bufferErr: any) {
        console.error("[Syntx] Error while downloading media (buffer mode):", bufferErr);
        throw new Error(`Failed to download media: ${err.message || err}. Buffer mode also failed: ${bufferErr.message || bufferErr}`);
      }
    }
  } catch (error: any) {
    console.error("Ошибка в sendPromptToSyntx:", error);
    
    // Специальная обработка ошибки авторизации
    if (error.errorMessage === 'AUTH_KEY_UNREGISTERED' || error.message?.includes('AUTH_KEY_UNREGISTERED')) {
      throw new Error("Telegram клиент не авторизован. Выполните авторизацию в консоли backend сервера и перезапустите сервер.");
    }
    
    throw new Error(`Ошибка при работе с Telegram ботом: ${error.message || error}`);
  }
}

/**
 * Находит видео от Syntax-бота по jobId в caption или тексте сообщения
 */
async function findSyntaxVideoByJobId(
  client: TelegramClient,
  chat: Api.TypeEntityLike,
  jobId: string,
  botUsername: string
): Promise<Api.Message | null> {
  try {
    // Загружаем последние N сообщений из чата с Syntax
    const messages = await client.getMessages(chat, {
      limit: 100, // Увеличиваем лимит для надёжности
    });

    // Получаем список уже использованных video message IDs
    const usedVideoMessageIds = await getUsedVideoMessageIds();

    // Фильтруем сообщения с видео от бота
    for (const message of messages) {
      // Проверяем, что сообщение от бота (не от нас)
      const fromId = message.fromId;
      if (fromId) {
        try {
          const sender = await client.getEntity(fromId);
          if (sender instanceof Api.User) {
            const senderUsername = sender.username?.toLowerCase();
            const expectedUsername = botUsername.toLowerCase().replace('@', '');
            if (senderUsername !== expectedUsername) {
              // Это не от нужного бота, пропускаем
              continue;
            }
          }
        } catch (e) {
          // Если не удалось получить информацию об отправителе, продолжаем проверку
        }
      }

      // Проверяем, что это видео не было уже использовано
      if (usedVideoMessageIds.has(message.id)) {
        continue;
      }

      // Проверяем, есть ли видео
      if (message.media) {
        if (message.media instanceof Api.MessageMediaDocument) {
          const document = message.media.document;
          if (document instanceof Api.Document) {
            let hasVideo = false;
            for (const attr of document.attributes) {
              if (attr instanceof Api.DocumentAttributeVideo) {
                hasVideo = true;
                break;
              }
            }
            
            if (hasVideo) {
              // Проверяем caption или message text на наличие jobId
              // В GramJS: message.message - это текст сообщения, message.media может иметь caption
              const messageText = message.message || "";
              // Для Api.MessageMediaDocument caption может быть в message.media
              let caption = "";
              if (message.media instanceof Api.MessageMediaDocument) {
                // В GramJS caption может быть строкой или объектом, проверяем оба варианта
                const mediaCaption = (message.media as any).caption;
                if (typeof mediaCaption === "string") {
                  caption = mediaCaption;
                } else if (mediaCaption && typeof mediaCaption === "object" && "text" in mediaCaption) {
                  caption = (mediaCaption as any).text || "";
                }
              }
              
              const fullText = `${messageText} ${caption}`.trim();
              
              console.log(`[Syntx] Проверяем сообщение ${message.id}: text="${messageText.substring(0, 50)}...", caption="${caption.substring(0, 50)}..."`);
              
              const extractedJobId = extractJobIdFromText(fullText);
              
              if (extractedJobId === jobId) {
                console.log(`[Syntx] ✅ Видео найдено по jobId: message ID: ${message.id}, jobId: ${jobId}`);
                const document = (message.media as Api.MessageMediaDocument).document as Api.Document;
                for (const attr of document.attributes) {
                  if (attr instanceof Api.DocumentAttributeVideo) {
                    console.log(`[Syntx] Video info: duration=${attr.duration}s, size=${document.size} bytes`);
                    return message;
                  }
                }
              } else if (extractedJobId) {
                console.log(`[Syntx] Найдён другой jobId в сообщении ${message.id}: ${extractedJobId} (ожидали ${jobId})`);
              }
            }
          }
        }
      }
    }

    return null; // Видео не найдено
  } catch (error) {
    console.error("[Syntx] Ошибка при поиске видео по jobId:", error);
    return null;
  }
}

/**
 * Ожидает видео от Syntax-бота по jobId
 */
async function waitForSyntxVideoByJobId(
  client: TelegramClient,
  chat: Api.TypeEntityLike,
  jobId: string,
  timeoutMs: number
): Promise<Api.Message> {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 секунд
  const botUsername = process.env.SYNTX_BOT_USERNAME || "syntxaibot";

  console.log(`[Syntx] Ожидаем видео с jobId: ${jobId}`);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const videoMessage = await findSyntaxVideoByJobId(client, chat, jobId, botUsername);
      
      if (videoMessage) {
        return videoMessage;
      }

      // Ждём перед следующей проверкой
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error("Ошибка при ожидании видео:", error);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error(
    `Таймаут ожидания видео от бота ${botUsername} для jobId ${jobId} (${timeoutMs / 1000} секунд)`
  );
}

/**
 * @deprecated Используйте waitForSyntxVideoByJobId вместо этой функции
 * Оставлена для обратной совместимости
 */
async function waitForSyntxVideo(
  client: TelegramClient,
  chat: Api.TypeEntityLike,
  requestMessageId: number,
  timeoutMs: number,
  usedVideoMessageIds?: Set<number> // Множество уже использованных message_id видео
): Promise<Api.Message> {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 секунд
  const botUsername = process.env.SYNTX_BOT_USERNAME || "syntxaibot";

  console.log(`[Syntx] Ожидаем видео с reply_to_message_id = ${requestMessageId}`);
  if (usedVideoMessageIds && usedVideoMessageIds.size > 0) {
    console.log(`[Syntx] Исключаем уже использованные видео: ${Array.from(usedVideoMessageIds).join(', ')}`);
  }

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Получаем последние сообщения из диалога с ботом
      const messages = await client.getMessages(chat, {
        limit: 50, // Увеличиваем лимит для надёжности
      });

      // Фильтруем сообщения с видео от бота
      const videoMessages: Api.Message[] = [];
      
      for (const message of messages) {
        // Проверяем, что сообщение от бота (не от нас)
        const fromId = message.fromId;
        if (fromId) {
          try {
            const sender = await client.getEntity(fromId);
            // Проверяем, что это сообщение от бота, а не от нас
            if (sender instanceof Api.User) {
              const senderUsername = sender.username?.toLowerCase();
              const expectedUsername = botUsername.toLowerCase().replace('@', '');
              if (senderUsername !== expectedUsername) {
                // Это не от нужного бота, пропускаем
                continue;
              }
            }
          } catch (e) {
            // Если не удалось получить информацию об отправителе, продолжаем проверку
          }
        }

        // Проверяем, есть ли видео
        if (message.media) {
          if (message.media instanceof Api.MessageMediaDocument) {
            const document = message.media.document;
            if (document instanceof Api.Document) {
              for (const attr of document.attributes) {
                if (attr instanceof Api.DocumentAttributeVideo) {
                  // Проверяем, что это видео не было уже использовано
                  if (usedVideoMessageIds && usedVideoMessageIds.has(message.id)) {
                    console.log(`[Syntx] Пропускаем уже использованное видео с message ID: ${message.id}`);
                    continue;
                  }
                  videoMessages.push(message as Api.Message);
                  break;
                }
              }
            }
          } else if (message.media instanceof Api.MessageMediaPhoto) {
            // Пропускаем фото
            continue;
          }
        }
      }

      // Сортируем видео по ID (более новые первыми)
      videoMessages.sort((a, b) => b.id - a.id);

      // Ищем видео, которое является ответом на наш запрос
      for (const message of videoMessages) {
        const replyTo = message.replyTo;
        
        // Приоритет 1: Проверяем reply_to для точного сопоставления
        if (replyTo && replyTo.replyToMsgId) {
          const replyToMsgId = replyTo.replyToMsgId;
          if (replyToMsgId === requestMessageId) {
            console.log(`[Syntx] ✅ Видео найдено по reply_to: message ID: ${message.id}, reply_to: ${replyToMsgId}`);
            const document = (message.media as Api.MessageMediaDocument).document as Api.Document;
            for (const attr of document.attributes) {
              if (attr instanceof Api.DocumentAttributeVideo) {
                console.log(`[Syntx] Video info: duration=${attr.duration}s, size=${document.size} bytes`);
                return message;
              }
            }
          }
        }
      }

      // Приоритет 2: Если не нашли по reply_to, используем временную логику для параллельных генераций
      // Берем самое новое видео, которое новее нашего запроса и еще не использовано
      // Это работает только если сообщение новее запроса (message.id > requestMessageId)
      // и если нет других активных задач, ожидающих видео
      for (const message of videoMessages) {
        if (message.id > requestMessageId) {
          // Проверяем, что это видео не слишком старое (не более 20 минут назад)
          // Это помогает избежать присвоения старых видео новым запросам
          // message.date - это Unix timestamp в секундах, умножаем на 1000 для миллисекунд
          const messageDate = message.date ? message.date * 1000 : 0;
          const maxAge = 20 * 60 * 1000; // 20 минут
          if (Date.now() - messageDate > maxAge) {
            console.log(`[Syntx] Пропускаем слишком старое видео: message ID: ${message.id}, возраст: ${Math.round((Date.now() - messageDate) / 1000 / 60)} минут`);
            continue;
          }

          // Если у сообщения нет reply_to, но оно новее запроса и не использовано,
          // это может быть ответ на наш запрос (если бот не использует reply_to)
          console.log(`[Syntx] ⚠️  Видео ${message.id} не имеет reply_to, но новее запроса ${requestMessageId}. Используем как fallback.`);
          const document = (message.media as Api.MessageMediaDocument).document as Api.Document;
          for (const attr of document.attributes) {
            if (attr instanceof Api.DocumentAttributeVideo) {
              console.log(`[Syntx] Video info: duration=${attr.duration}s, size=${document.size} bytes`);
              return message;
            }
          }
        }
      }

      // Ждём перед следующей проверкой
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error("Ошибка при ожидании видео:", error);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error(
    `Таймаут ожидания видео от бота ${botUsername} для запроса ${requestMessageId} (${timeoutMs / 1000} секунд)`
  );
}

/**
 * Получить множество уже использованных video message IDs из Firestore
 * Это предотвращает скачивание одного и того же видео для разных задач
 */
async function getUsedVideoMessageIds(): Promise<Set<number>> {
  try {
    const jobs = await getAllJobs();
    const usedIds = new Set<number>();
    
    for (const job of jobs) {
      if (job.telegramVideoMessageId) {
        usedIds.add(job.telegramVideoMessageId);
      }
    }
    
    console.log(`[Syntx] Найдено ${usedIds.size} уже использованных video message IDs`);
    return usedIds;
  } catch (error) {
    console.error("[Syntx] Ошибка при получении использованных video message IDs:", error);
    // В случае ошибки возвращаем пустое множество, чтобы не блокировать процесс
    return new Set<number>();
  }
}

