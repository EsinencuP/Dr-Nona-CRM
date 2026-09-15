# Application intake monitoring runbook

The authenticated CRM dashboard is the approved operator destination for application-delivery alerts. It shows an alert when three consecutive delivery attempts fail within the latest 15-minute window or when at least one delivery remains in `DELIVERY_STARTED` for more than two minutes. A successful `DELIVERED` record clears the consecutive-failure condition.

## Failure classes

| Event | Failure class | Meaning |
| --- | --- | --- |
| `application.db.write` | `database_write` | The application was not persisted, so Telegram was skipped. |
| `application.delivery.completed` | `telegram_delivery` | Persistence succeeded but Telegram delivery failed. |
| `application.delivery.completed` | `delivery_state_persistence` | Telegram accepted the message, but CRM could not confirm the delivered state. |
| `webhook.status_update` | `database_status_update` | A manager command was received, but the matching CRM order was not updated. |
| `webhook.uncaught` | none | The webhook ignored an unexpected processing failure and returned a safe response to Telegram. |

Every application event includes a request ID where one exists. Logs must contain metadata only: never payloads, phone numbers, names, bot tokens, proxy secrets, chat IDs, or complete outbound URLs.

## Response

1. Open the CRM dashboard and identify whether the database is unavailable, Telegram deliveries failed, or deliveries are stuck.
2. Search Vercel logs by the event and request ID.
3. For `DELIVERY_FAILED`, correct the provider or database condition and allow an idempotent retry with the original key.
4. For `DELIVERY_STARTED`, check Telegram and the CRM order before retrying. A message may already exist, so an automatic retry can create a duplicate.
5. Confirm recovery when a later `DELIVERED` record appears and the dashboard returns to the healthy state.

The regression tests simulate alert triggering and recovery using injected records. They do not send customer-facing Telegram messages.
