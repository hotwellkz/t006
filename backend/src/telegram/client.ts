import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import * as readline from "readline";

let client: TelegramClient | null = null;

export async function getTelegramClient(): Promise<TelegramClient> {
  if (client) {
    // Проверяем, что клиент все еще авторизован
    const isAuthorized = await client.checkAuthorization();
    if (!isAuthorized) {
      console.warn("⚠️  Существующий клиент не авторизован, пересоздаем...");
      client = null;
      // Продолжаем создание нового клиента
    } else {
      return client;
    }
  }

  const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const stringSession = process.env.TELEGRAM_STRING_SESSION || "";

  if (!apiId || !apiHash) {
    throw new Error("TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть заданы в .env");
  }

  const session = new StringSession(stringSession);
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.connect();
  } catch (error: any) {
    throw new Error(`Ошибка подключения к Telegram: ${error.message}`);
  }

  if (!(await client.checkAuthorization())) {
    console.log("Требуется авторизация в Telegram...");

    const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER || "";

    if (!phoneNumber) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (query: string): Promise<string> => {
        return new Promise((resolve) => {
          rl.question(query, resolve);
        });
      };

      const phone = await question("Введите номер телефона: ");
      await client.start({
        phoneNumber: phone,
        password: async () => {
          const password = await question("Введите пароль 2FA: ");
          return password;
        },
        phoneCode: async () => {
          const code = await question("Введите код из Telegram: ");
          return code;
        },
        onError: (err) => console.error("Ошибка авторизации:", err),
      });

      rl.close();
    } else {
      await client.start({
        phoneNumber: phoneNumber,
        password: async () => {
          return process.env.TELEGRAM_2FA_PASSWORD || "";
        },
        phoneCode: async () => {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          const code = await new Promise<string>((resolve) => {
            rl.question("Введите код из Telegram: ", resolve);
          });
          rl.close();
          return code;
        },
        onError: (err) => console.error("Ошибка авторизации:", err),
      });
    }

    // Проверяем, что авторизация завершена
    if (!(await client.checkAuthorization())) {
      throw new Error("Авторизация не завершена. Проверьте введенные данные.");
    }

    const sessionSaver = client.session.save as unknown;
    const rawSession =
      typeof sessionSaver === "function" ? (sessionSaver as () => unknown).call(client.session) : "";
    const newSession = typeof rawSession === "string" ? rawSession : "";

    if (newSession) {
      console.log("\n=== ВАЖНО: Сохраните эту строку в .env ===\n");
      console.log(`TELEGRAM_STRING_SESSION=${newSession}\n`);
      console.log("✅ Авторизация в Telegram завершена успешно");
    } else {
      console.warn("⚠️  Не удалось сохранить TELEGRAM_STRING_SESSION автоматически. Скопируйте строку из консоли GramJS.");
    }
  } else {
    console.log("✅ Telegram клиент авторизован");
  }

  return client;
}

if (require.main === module) {
  getTelegramClient()
    .then(() => {
      console.log("✅ Telegram клиент готов. Если это была интерактивная авторизация, скопируйте TELEGRAM_STRING_SESSION из вывода выше.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Ошибка при инициализации Telegram клиента:", error);
      process.exit(1);
    });
}

