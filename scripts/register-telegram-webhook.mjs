#!/usr/bin/env node

/**
 * One-time script to register the Telegram webhook URL.
 *
 * Usage:
 *   node scripts/register-telegram-webhook.mjs <webhook-url>
 *
 * Example:
 *   node scripts/register-telegram-webhook.mjs https://your-domain.vercel.app/api/telegram-webhook
 *
 * Environment variables (from .env.local or shell):
 *   TELEGRAM_BOT_TOKEN    — Bot API token
 *   TELEGRAM_WEBHOOK_SECRET — Secret token for webhook verification
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local if available
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env.local is optional
}

const webhookUrl = process.argv[2];
if (!webhookUrl) {
  console.error("Usage: node scripts/register-telegram-webhook.mjs <webhook-url>");
  console.error(
    "Example: node scripts/register-telegram-webhook.mjs https://your-site.vercel.app/api/telegram-webhook",
  );
  process.exit(1);
}

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!botToken) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}
if (!webhookSecret) {
  console.error("Error: TELEGRAM_WEBHOOK_SECRET is not set.");
  process.exit(1);
}

console.log(`\nRegistering Telegram webhook...`);
console.log(`  URL: ${webhookUrl}`);
console.log(`  Secret: ${"*".repeat(webhookSecret.length)}\n`);

const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ["message"],
  }),
});

const result = await response.json();

if (result.ok) {
  console.log("✅ Webhook registered successfully!");
  console.log(`   ${result.description}`);
} else {
  console.error("❌ Failed to register webhook:");
  console.error(`   ${result.description || JSON.stringify(result)}`);
  process.exit(1);
}

// Verify by fetching webhook info
console.log("\nVerifying webhook info...");
const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
const info = await infoResponse.json();

if (info.ok) {
  console.log(`  URL:              ${info.result.url}`);
  console.log(`  Has secret:       ${info.result.has_custom_certificate ? "yes" : "no"}`);
  console.log(`  Pending updates:  ${info.result.pending_update_count}`);
  if (info.result.last_error_message) {
    console.log(`  Last error:       ${info.result.last_error_message}`);
  }
}

console.log("\n🎉 Done! The bot will now receive updates at the webhook URL.");
