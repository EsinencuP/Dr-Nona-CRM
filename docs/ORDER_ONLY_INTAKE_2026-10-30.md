# Order-only public intake — 2026-10-30

The owner's latest decisions for the separate catalogue retire public consultation/masterclass submissions and require a confirmed CRM receipt. The public handler accepts only selected-product orders. Historical records, internal CRM UI, schema and migrations are preserved.

Origin checks, signed proxy verification, distributed rate limit, server validation, database transaction, idempotency and Telegram outbox remain. Product names/SKUs are server-resolved; localized links use the verified catalogue origin. Order notifications include links, quantities and order references.

`accepted: true` is emitted only after the order transaction commits or an existing persisted order is recovered by idempotency. HTTP 201 means a committed order with a sent notification; HTTP 202 also confirms a committed order while its notification is pending/failed. A failed write has no accepted receipt; payload conflicts remain 409. The catalogue requires explicit `ok`, `accepted`, a nonempty ID and valid delivery state before showing thanks or clearing its form/selection. Release both repositories together; no production release has been performed.

Database-backed tests exercise both locales, failed writes, notification failure after commit, three concurrent submissions, a lost-response retry and one persisted order. Browser verification uses real catalogue proxy/HMAC/CRM/PostgreSQL with a test notification provider. Production data and live Telegram delivery were not used. PostgreSQL 17 runs only in an isolated disposable local Docker database; no production schema migration was applied. Existing SMS templates remain externally configured; no email transport or new provider is added.

Verification: db:generate, typecheck, lint, check and production build PASS; 308 tests in 40 files PASS against disposable PostgreSQL. The catalogue has 238 unit tests PASS, 57 related UI tests PASS (5 intentional skips), and 4 additional real-database browser flows PASS across RU/RO and desktop/mobile. Runtime reports/screenshots and disposable credentials are excluded from Git.
