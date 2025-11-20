import * as admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;

/**
 * Инициализирует Firebase Admin SDK
 */
export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Получаем credentials из переменных окружения
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
      token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || "googleapis.com",
    };

    // Проверяем обязательные поля
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error(
        "FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY и FIREBASE_CLIENT_EMAIL должны быть заданы в .env"
      );
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });

    console.log("[Firebase] ✅ Firebase Admin SDK инициализирован");
    return firebaseApp;
  } catch (error: unknown) {
    console.error("[Firebase] ❌ Ошибка инициализации Firebase:", error);
    throw error;
  }
}

/**
 * Получить экземпляр Firestore
 * @throws Error если Firebase не инициализирован
 */
export function getFirestore(): admin.firestore.Firestore {
  if (!firebaseApp) {
    try {
      initializeFirebase();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Firebase] ❌ Не удалось инициализировать Firebase:", errorMessage);
      throw new Error(
        `Firebase не инициализирован. Проверьте переменные окружения FIREBASE_*. Ошибка: ${errorMessage}`
      );
    }
  }
  
  if (!firebaseApp) {
    throw new Error("Firebase не инициализирован. Установите переменные окружения FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL");
  }
  
  return admin.firestore();
}

