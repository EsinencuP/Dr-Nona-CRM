import { createTelegramWebhookHandler } from "../../../../server/api/telegram-webhook-handler";

const handleTelegramWebhook = createTelegramWebhookHandler();

export async function POST(request: Request) {
  return handleTelegramWebhook(request);
}
