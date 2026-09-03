import { createTelegramWebhookHandler } from "../../../../api/telegram-webhook";

const handleTelegramWebhook = createTelegramWebhookHandler();

export async function POST(request: Request) {
  return handleTelegramWebhook(request);
}
