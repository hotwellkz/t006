import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { sendPromptToSyntx } from "../telegram/syntxService";
import { uploadFileToDrive } from "../googleDrive/driveService";
import {
  createJob,
  getJob,
  updateJob,
  getAllJobs,
  countActiveJobs,
  VideoJobStatus,
  deleteJobCascade,
} from "../models/videoJob";
import { getChannelById } from "../models/channel";
import { getSafeFileName } from "../utils/fileNameSanitizer";
import * as admin from "firebase-admin";

const router = Router();

const MAX_ACTIVE_JOBS = 2;

/**
 * Асинхронная функция для обработки генерации видео
 */
async function processVideoGeneration(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    console.error(`[VideoJob] Job ${jobId} not found for processing`);
    return;
  }

  try {
    // Статус: sending - отправка промпта
    await updateJob(jobId, { status: "sending" });
    console.log(`[VideoJob] Job ${jobId}: sending prompt to Syntx`);

    // Формируем безопасное имя файла из videoTitle
    const safeFileName = job.videoTitle ? getSafeFileName(job.videoTitle) : undefined;

    // Статус: waiting_video - ожидание видео
    updateJob(jobId, { status: "waiting_video" });
    console.log(`[VideoJob] Job ${jobId}: waiting for video from Syntx`);

    // Отправляем промпт в Syntx AI и ждём видео
    // Используем существующий requestMessageId, если он есть (для повторных попыток)
    const existingRequestMessageId = job.telegramRequestMessageId;
    const syntxResult = await sendPromptToSyntx(job.prompt, safeFileName, existingRequestMessageId);

    // Сохраняем requestMessageId для связи с ответом
    await updateJob(jobId, { telegramRequestMessageId: syntxResult.requestMessageId });
    console.log(`[VideoJob] Job ${jobId}: saved telegramRequestMessageId: ${syntxResult.requestMessageId}`);

    // Статус: downloading - скачивание
    await updateJob(jobId, { status: "downloading" });
    console.log(`[VideoJob] Job ${jobId}: downloading video`);

    // Проверяем, что файл существует
    if (!fs.existsSync(syntxResult.localPath)) {
      throw new Error(`File does not exist after download: ${syntxResult.localPath}`);
    }

    const fileStat = fs.statSync(syntxResult.localPath);
    console.log(`[VideoJob] Job ${jobId}: file verified, size: ${fileStat.size} bytes`);

    // Статус: ready - готово
    const updatedJob = await updateJob(jobId, {
      status: "ready",
      localPath: syntxResult.localPath,
    });

    console.log(`[VideoJob] Job ${jobId} completed successfully`);

    // Отправляем FCM уведомление о готовности видео
    if (updatedJob) {
      const { notifyVideoReady } = await import("../firebase/fcmService");
      const videoTitle = updatedJob.videoTitle || updatedJob.prompt.substring(0, 60) + (updatedJob.prompt.length > 60 ? '...' : '');
      await notifyVideoReady(jobId, videoTitle, updatedJob.channelId).catch((err) => {
        console.error(`[VideoJob] Failed to send FCM notification for job ${jobId}:`, err);
        // Не пробрасываем ошибку, чтобы не ломать основной процесс
      });
    }
  } catch (error: any) {
    console.error(`[VideoJob] Job ${jobId} error:`, error);
    const errorMessage = error?.message || error?.toString() || "Неизвестная ошибка";
    await updateJob(jobId, {
      status: "error",
      errorMessage,
    });
  }
}

/**
 * POST /api/video-jobs
 * Создать новую задачу генерации видео
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { prompt, channelId, channelName, ideaText, videoTitle } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Требуется поле prompt (непустая строка)" });
    }

    // Проверяем лимит активных задач
    const activeCount = await countActiveJobs(channelId);
    if (activeCount >= MAX_ACTIVE_JOBS) {
      return res.status(429).json({
        error: "MAX_ACTIVE_JOBS_REACHED",
        message: `Можно генерировать не более ${MAX_ACTIVE_JOBS} видео одновременно.`,
        activeCount,
        maxActiveJobs: MAX_ACTIVE_JOBS,
      });
    }

    // Создаём задачу
    const job = await createJob(
      prompt.trim(),
      channelId,
      channelName,
      ideaText,
      videoTitle
    );

    console.log(`[VideoJob] Created job ${job.id}, channelId: ${channelId || "не указан"}, videoTitle: ${videoTitle || "не указано"}`);

    // Запускаем асинхронную обработку (не ждём завершения)
    processVideoGeneration(job.id).catch((error) => {
      console.error(`[VideoJob] Unhandled error in processVideoGeneration for job ${job.id}:`, error);
    });

    // Возвращаем информацию о созданной задаче
    res.status(201).json({
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
    });
  } catch (error: any) {
    console.error("[VideoJob] Error creating job:", error);
    const errorMessage = error?.message || error?.toString() || "Неизвестная ошибка";
    res.status(500).json({
      error: "Внутренняя ошибка сервера",
      message: errorMessage,
    });
  }
});

/**
 * GET /api/video-jobs
 * Получить список задач (опционально отфильтрованных по channelId)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.query;
    const channelIdStr = channelId ? String(channelId) : undefined;

    const jobs = await getAllJobs(channelIdStr);
    
    // Сортируем по createdAt (новые сверху) и ограничиваем последними 20
    const sortedJobs = jobs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
      .map(job => ({
        id: job.id,
        prompt: job.prompt,
        channelId: job.channelId,
        channelName: job.channelName,
        videoTitle: job.videoTitle,
        status: job.status,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        previewUrl: (job.status === "ready" || job.status === "uploaded") && job.localPath
          ? `/api/video-jobs/${job.id}/preview`
          : undefined,
        driveFileId: job.driveFileId,
        webViewLink: job.webViewLink,
        webContentLink: job.webContentLink,
      }));

    res.json({
      jobs: sortedJobs,
      activeCount: await countActiveJobs(channelIdStr),
      maxActiveJobs: MAX_ACTIVE_JOBS,
    });
  } catch (error: any) {
    console.error("[VideoJob] Error getting jobs:", error);
    res.status(500).json({
      error: "Внутренняя ошибка сервера",
      message: error?.message || "Неизвестная ошибка",
    });
  }
});

/**
 * GET /api/video-jobs/:id/preview
 * Получить превью видео (стриминг файла)
 * ВАЖНО: Этот маршрут должен быть определён ПЕРЕД общим маршрутом /:id
 */
router.get("/:id/preview", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await getJob(id);

    if (!job) {
      return res.status(404).json({ error: "Job не найден" });
    }

    if (job.status !== "ready" && job.status !== "uploaded") {
      return res.status(400).json({
        error: "Видео ещё не готово или было отклонено",
      });
    }

    if (!job.localPath || !fs.existsSync(job.localPath)) {
      return res.status(404).json({ error: "Файл видео не найден" });
    }

    const fileStat = fs.statSync(job.localPath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", fileStat.size);
    fs.createReadStream(job.localPath).pipe(res);
  } catch (error) {
    console.error("Ошибка при стриминге видео:", error);
    res.status(500).json({ error: "Ошибка при загрузке видео" });
  }
});

/**
 * POST /api/video-jobs/:id/approve
 * Одобрить и загрузить видео в Google Drive
 * ВАЖНО: Этот маршрут должен быть определён ПЕРЕД общим маршрутом /:id
 */
router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { videoTitle } = req.body;
    const job = await getJob(id);

    if (!job) {
      return res.status(404).json({ error: "Job не найден" });
    }

    if (job.status !== "ready") {
      return res.status(400).json({
        error: "Можно одобрить только job со статусом 'ready'",
      });
    }

    if (!job.localPath) {
      console.error(`[VideoJob] Job ${id} has no localPath for approval`);
      return res.status(404).json({ error: "Файл видео не найден (localPath не задан)" });
    }

    if (!fs.existsSync(job.localPath)) {
      console.error(`[VideoJob] File not found for approval (job ${id}): ${job.localPath}`);
      return res.status(404).json({
        error: "Файл видео не найден",
        path: job.localPath,
      });
    }

    const fileStat = fs.statSync(job.localPath);
    console.log(`[VideoJob] Approving job ${id}, file: ${job.localPath}, size: ${fileStat.size} bytes`);

    // Обновляем title в job, если передан новый
    const finalTitle = videoTitle && videoTitle.trim() ? videoTitle.trim() : job.videoTitle;
    if (finalTitle && finalTitle !== job.videoTitle) {
      await updateJob(id, { videoTitle: finalTitle });
      console.log(`[VideoJob] Updated title for job ${id}: ${finalTitle}`);
    }

    // Обновляем статус на uploading
    await updateJob(id, { status: "uploading" });

    try {
      // Генерируем имя файла из videoTitle или используем дефолтное
      const fileName = finalTitle
        ? getSafeFileName(finalTitle)
        : `video_${job.id}_${Date.now()}.mp4`;
      console.log(`[VideoJob] Uploading to Google Drive: ${fileName}`);

      // Определяем папку Google Drive: сначала из канала, затем из .env
      let targetFolderId: string | null | undefined = null;
      if (job.channelId) {
        const channel = await getChannelById(job.channelId);
        if (channel && channel.gdriveFolderId) {
          targetFolderId = channel.gdriveFolderId;
          console.log(`[VideoJob] Using folder from channel ${job.channelId}: ${targetFolderId}`);
        } else {
          console.log(`[VideoJob] Channel ${job.channelId} has no gdriveFolderId, using default from .env`);
        }
      } else {
        console.log(`[VideoJob] No channelId, using default folder from .env`);
      }

      // Загружаем в Google Drive
      const driveResult = await uploadFileToDrive(job.localPath, fileName, targetFolderId);

      console.log(`[VideoJob] Successfully uploaded to Google Drive: ${driveResult.fileId}`);

      // Обновляем job
      await updateJob(id, {
        status: "uploaded",
        driveFileId: driveResult.fileId,
        webViewLink: driveResult.webViewLink,
        webContentLink: driveResult.webContentLink,
      });

      res.json({
        status: "uploaded",
        googleDriveFileId: driveResult.fileId,
        googleDriveWebViewLink: driveResult.webViewLink,
        googleDriveWebContentLink: driveResult.webContentLink,
      });
    } catch (error: any) {
      await updateJob(id, { status: "ready" }); // Откатываем статус
      throw error;
    }
  } catch (error: any) {
    console.error("Ошибка при одобрении видео:", error);
    res.status(500).json({
      error: "Ошибка при загрузке в Google Drive",
      message: error?.message || "Неизвестная ошибка",
    });
  }
});

/**
 * POST /api/video-jobs/:id/reject
 * Отклонить видео
 * ВАЖНО: Этот маршрут должен быть определён ПЕРЕД общим маршрутом /:id
 */
router.post("/:id/reject", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    console.log(`[VideoJob] Reject request received for job ${id}`);

    const job = await getJob(id);

    if (!job) {
      console.error(`[VideoJob] Job ${id} not found for rejection`);
      return res.status(404).json({
        error: "Job не найден",
        jobId: id,
      });
    }

    console.log(
      `[VideoJob] Rejecting job ${id}, current status: ${job.status}, localPath: ${job.localPath || "не указан"}`
    );

    const removedFiles: string[] = [];
    const fileCandidates = collectAllFilePaths(job);
    for (const candidate of fileCandidates) {
      const deleted = deleteLocalFileSafe(candidate);
      if (deleted) {
        removedFiles.push(candidate);
      }
    }

    const deletedFromDb = await deleteJobCascade(id);
    if (!deletedFromDb) {
      console.error(`[VideoJob] ⚠️  deleteJobCascade returned false for job ${id}`);
      return res.status(404).json({
        error: "Job не найден в базе данных",
        jobId: id,
      });
    }

    console.log(
      `[VideoJob] ✅ Job ${id} deleted completely (doc + subcollections + files: ${removedFiles.length})`
    );

    res.json({
      status: "deleted",
      jobId: id,
      deletedFiles: removedFiles,
    });
  } catch (error: any) {
    console.error(`[VideoJob] ❌ Error rejecting job ${id}:`, error);
    console.error(`[VideoJob] Error stack:`, error?.stack);
    const errorMessage = error?.message || error?.toString() || "Неизвестная ошибка";
    res.status(500).json({
      error: "Ошибка при отклонении видео",
      message: errorMessage,
      jobId: id,
    });
  }
});

function collectAllFilePaths(job: any): string[] {
  const paths = new Set<string>();

  if (job.localPath) paths.add(job.localPath);
  if (job.previewPath) paths.add(job.previewPath);
  if (job.thumbnailPath) paths.add(job.thumbnailPath);
  if (Array.isArray(job.storagePaths)) {
    job.storagePaths.forEach((p: string | undefined) => p && paths.add(p));
  }

  return Array.from(paths);
}

function deleteLocalFileSafe(filePath?: string): boolean {
  if (!filePath) {
    return false;
  }

  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      console.log(`[VideoJob] ⚠️  File does not exist, skip delete: ${absolutePath}`);
      return false;
    }

    fs.unlinkSync(absolutePath);
    console.log(`[VideoJob] 🧹 Deleted file: ${absolutePath}`);
    return true;
  } catch (error) {
    console.error(`[VideoJob] ⚠️  Failed to delete file ${filePath}:`, error);
    return false;
  }
}

export default router;

