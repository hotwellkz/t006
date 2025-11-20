import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

export interface DriveUploadResult {
  fileId: string;
  webViewLink?: string;
  webContentLink?: string;
}

/**
 * Инициализирует OAuth2 клиент для Google Drive
 */
function getDriveAuth(): OAuth2Client {
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;

  console.log("[Drive] Initializing OAuth2 client...");
  console.log("[Drive] Env GDRIVE_CLIENT_ID =", clientId ? "SET" : "NOT SET");
  console.log("[Drive] Env GDRIVE_CLIENT_SECRET =", clientSecret ? "SET" : "NOT SET");
  console.log("[Drive] Env GDRIVE_REFRESH_TOKEN =", refreshToken ? "SET" : "NOT SET");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET и GDRIVE_REFRESH_TOKEN должны быть заданы в .env"
    );
  }

  const oauth2Client = new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri: "http://localhost:3000/oauth2callback",
  });

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

export async function uploadFileToDrive(
  localPath: string,
  fileName?: string,
  folderId?: string | null // Если передан, используется этот folderId, иначе GDRIVE_FOLDER_ID из .env
): Promise<DriveUploadResult> {
  // Определяем папку: сначала используем переданный folderId, затем из .env
  const targetFolderId = folderId || process.env.GDRIVE_FOLDER_ID;

  console.log("[Drive] Target folder ID =", targetFolderId);
  console.log("[Drive] Source:", folderId ? "channel.gdriveFolderId" : "GDRIVE_FOLDER_ID from .env");

  if (!targetFolderId) {
    throw new Error("GDRIVE_FOLDER_ID должен быть задан в .env или в настройках канала");
  }

  // Авторизация через OAuth2
  const auth = getDriveAuth();
  const drive = google.drive({ version: "v3", auth });

  // Определяем имя файла
  const finalFileName = fileName || path.basename(localPath);

  console.log("[Drive] Uploading to folder:", targetFolderId, "file:", finalFileName);
  console.log("[Drive] Local file path:", localPath);

  // Проверяем, что файл существует
  if (!fs.existsSync(localPath)) {
    throw new Error(`Файл не найден: ${localPath}`);
  }

  const fileStats = fs.statSync(localPath);
  console.log("[Drive] File size:", fileStats.size, "bytes");

  // Загружаем файл
  try {
    console.log("[Drive] Creating file with parents:", [targetFolderId]);
    
    const res = await drive.files.create({
      requestBody: {
        name: finalFileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: "video/mp4",
        body: fs.createReadStream(localPath),
      },
      fields: "id, name, parents, webViewLink, webContentLink",
      supportsAllDrives: true, // Для поддержки Shared Drives
    });

    console.log("[Drive] Uploaded file info:", {
      id: res.data.id,
      name: res.data.name,
      parents: res.data.parents,
      webViewLink: res.data.webViewLink,
    });

    if (!res.data.id) {
      throw new Error("Не удалось загрузить файл в Google Drive");
    }

    return {
      fileId: res.data.id,
      webViewLink: res.data.webViewLink || undefined,
      webContentLink: res.data.webContentLink || undefined,
    };
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown }; message?: string };
    
    console.error("[Drive] Upload error status:", err.response?.status);
    console.error("[Drive] Upload error data:", JSON.stringify(err.response?.data, null, 2));
    console.error("[Drive] Used folderId:", targetFolderId);
    console.error("[Drive] Error message:", err.message || String(error));

    throw error;
  }
}

