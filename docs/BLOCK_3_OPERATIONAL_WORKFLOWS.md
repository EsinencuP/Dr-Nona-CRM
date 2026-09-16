# Block 3 operational workflows

**Date:** 2026-09-16  
**Scope:** business-logic Tasks 14–18  
**Timezone:** `Europe/Chisinau`

## Order status contract

The database order ID is the stable, non-PII reference. Telegram cards contain both `ID заявки: <uuid>` and the machine marker `Ref: order:<uuid>`. Mutations never parse localized card text. A reply resolves the order only through the unique stored `telegramMessageId`; the readable status line is presentation.

Allowed transitions are:

- `NEW → PROCESSING | CANCELLED`
- `PROCESSING → DELIVERY | DONE | CANCELLED`
- `DELIVERY → DONE | CANCELLED`
- repeating the current status is idempotent
- `DONE` and `CANCELLED` are terminal

Every actual transition writes `OrderStatusAudit` and the first transition away from `NEW` records `firstActionAt`. Edited card wording is repaired or receives an appended status line after the database transition. A missing mapping, stale reply, illegal transition, duplicate Telegram update, or competing write causes no unrelated mutation.

## Durable Telegram outbox

`Order`, `ApplicationSubmission`, and `TelegramOutbox` are created in one Prisma transaction. The outbox owns the exact payload and progresses through `PENDING`, `SENDING`, `DELIVERED`, `NEEDS_REVIEW`, `TERMINAL`, or `CANCELLED`.

- A row is acquired atomically before sending.
- Explicit Telegram `429` and `5xx` failures retry at bounded 1-minute, 5-minute, and 30-minute intervals, with three total attempts.
- Network timeout or unknown transport result becomes `NEEDS_REVIEW`; it is never retried automatically because Telegram might already have accepted the message.
- A stale `SENDING` lock older than five minutes becomes `NEEDS_REVIEW`.
- A delivered row cannot be acquired again, so replaying an idempotency key cannot duplicate a card.
- New application traffic drains one due retry. An authenticated operator can inspect, retry immediately, or cancel a pending/review/terminal delivery from the order drawer.
- A Telegram outage does not turn a persisted application into a false rejection. The catalogue receives `201` for a newly accepted record or `202` for an already accepted in-progress idempotent request. Public RU/RO wording says the application was accepted and saved, without claiming provider delivery.

## Attribution contract

Attribution is versioned analytics input and never participates in authentication, authorization, pricing, order identity, or status transitions.

- First touch is written once per browser session. A session beginning without UTM is `direct`.
- Last touch changes only when a later URL contains UTM input.
- Normalized dimensions use Unicode NFKC, collapsed whitespace, lowercase, no control characters, and a 100-character maximum.
- Optional raw dimensions retain the bounded submitted spelling for editorial analysis, with control characters removed and a 200-character maximum.
- Entry point stores only the route path, never query data. Its locale must equal the request locale (`ru-MD` or `ro-MD`).
- Session history contains at most 20 approved published product slugs. Malformed storage and unknown slugs are discarded.
- Session storage is isolated to the browser session. Attribution is attached to the persisted application only after the application consent checkbox is accepted.
- CRM report columns use normalized last-touch dimensions. The structured JSON keeps first/last/raw/entry/history semantics distinguishable.

## SLA indicator

The internal operational baseline is 60 elapsed minutes from `NEW` creation to the first valid manager transition, continuously, in `Europe/Chisinau`. It is not a public customer promise and does not model office hours. The dashboard shows atomic live counts for today, the local week beginning Monday, overdue `NEW`, and the five oldest overdue references. Analytical charts remain period aggregates and are labelled separately. Existing loading and error routes remain the accessible fallback; an empty SLA list explicitly states that no overdue applications exist.

## Telegram manager commands

There is one role: `manager`. A command is accepted only when all four checks pass: Telegram webhook secret, configured chat, sender ID in `TELEGRAM_MANAGER_USER_IDS`, and the durable 12-commands-per-minute rate limit.

- `/status processing|delivery|done|cancelled` must reply to a bot application card. Existing short reply keywords remain aliases.
- `/order <full UUID>` returns type, status, creation time, and product slugs/quantities only. It excludes name, phone, email, comment, and address data.
- `/overdue` returns count and up to five order references with age.
- `/help` returns the exact command list.

`TelegramCommandAudit.updateId` deduplicates webhook retries. Every accepted status mutation also has `OrderStatusAudit`. Unauthorized chats or senders get no CRM data and cause no mutation. Production manager IDs are derived from the configured Telegram supergroup administrators and stored as a Vercel secret, never in Git.

## Migration and rollback

Migration `20260916010000_operational_workflows` is additive. It was first applied to the expiring Neon branch `block3-operational-rehearsal-2026-09-16`, created from `development`. The rehearsal then executed `rollback.sql`, removed only the rehearsal migration ledger row, reapplied the forward migration, and verified an up-to-date Prisma migration state. The same forward migration was then applied to `development`. `rollback.sql` removes only Block 3 tables, enum, and nullable columns; use it only after reverting code that reads them.

Before production deployment, the expiring Neon branch `block3-pre-migration-2026-09-16` (`br-square-mode-aya0xt3k`) was created from `main`; it expires on 2026-09-23. This branch is the production rollback point and contains no credentials in repository documentation.

## Validation evidence

- `npm run check`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run test`: 22 files and 236 tests PASS, including database integration.
- The paired catalogue suite reports 201 unit tests and 364 full desktop/mobile E2E tests PASS, with 18 intentionally skipped cases.
- The merged cross-repository Graphify map was rebuilt after the final catalogue and CRM changes.

## Operator response

1. `PENDING`: wait for the scheduled attempt or use retry when immediate delivery is required.
2. `TERMINAL`: correct configuration/provider rejection, then retry.
3. `NEEDS_REVIEW`: first search Telegram for the order reference; retry only when no card exists.
4. `CANCELLED`: the CRM application remains valid; delivery is intentionally stopped.
5. SLA overdue: open the `NEW` list and perform a valid state transition. Editing Telegram text alone never counts as first action.
