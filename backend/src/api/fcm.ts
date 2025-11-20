import { Router, Request, Response } from "express";
import { saveFCMToken, deleteFCMToken } from "../firebase/fcmService";

const router = Router();

/**
 * POST /api/fcm/register
 * Регистрация FCM токена устройства
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { token, userId } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        error: "FCM token is required",
      });
    }

    await saveFCMToken(token, userId || undefined);

    res.json({
      success: true,
      message: "FCM token registered successfully",
    });
  } catch (error: any) {
    console.error("[FCM API] Error registering token:", error);
    res.status(500).json({
      error: "Ошибка регистрации FCM токена",
      message: error.message,
    });
  }
});

/**
 * POST /api/fcm/unregister
 * Удаление FCM токена устройства
 */
router.post("/unregister", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        error: "FCM token is required",
      });
    }

    await deleteFCMToken(token);

    res.json({
      success: true,
      message: "FCM token unregistered successfully",
    });
  } catch (error: any) {
    console.error("[FCM API] Error unregistering token:", error);
    res.status(500).json({
      error: "Ошибка удаления FCM токена",
      message: error.message,
    });
  }
});

export default router;

