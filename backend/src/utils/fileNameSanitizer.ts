/**
 * Утилита для безопасного именования файлов
 * Удаляет недопустимые символы и ограничивает длину
 */

/**
 * Очищает название видео от недопустимых символов для использования в имени файла
 * @param title - Название видео
 * @param maxLength - Максимальная длина (по умолчанию 80)
 * @returns Безопасное имя файла
 */
export function sanitizeFileName(title: string, maxLength: number = 80): string {
  if (!title || typeof title !== "string") {
    return `video_${Date.now()}`;
  }

  // Удаляем недопустимые символы для файловых систем
  // Windows: / \ : * ? " < > |
  // Unix: / и null
  let sanitized = title
    .replace(/[/\\:*?"<>|]/g, "_") // Заменяем недопустимые символы на подчёркивание
    .replace(/\s+/g, "_") // Заменяем пробелы на подчёркивание
    .replace(/_{2,}/g, "_") // Убираем множественные подчёркивания
    .replace(/^_+|_+$/g, ""); // Убираем подчёркивания в начале и конце

  // Ограничиваем длину
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    // Убираем возможное подчёркивание в конце после обрезки
    sanitized = sanitized.replace(/_+$/, "");
  }

  // Если после очистки строка пустая, используем дефолтное имя
  if (!sanitized || sanitized.trim().length === 0) {
    return `video_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Формирует полное имя файла с расширением
 * @param title - Название видео
 * @param extension - Расширение файла (по умолчанию .mp4)
 * @returns Полное имя файла
 */
export function getSafeFileName(title: string, extension: string = ".mp4"): string {
  const sanitized = sanitizeFileName(title);
  return `${sanitized}${extension}`;
}

