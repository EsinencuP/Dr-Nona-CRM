# Customer workflows — Block 5, Tasks 24–26

Date: 2026-09-17

## Task 24 — consultation slots

The implementation uses explicit manager-created slots instead of an inferred recurring calendar.

- Timezone: `Europe/Chisinau`.
- Capacity: one reservation per slot.
- Duration: stored per slot; CRM accepts 15–240 minutes and presents common 30–120 minute choices.
- Working hours, buffers and holidays: no values are invented. A time is public only when a manager creates that exact slot.
- Public access: the catalogue calls its same-origin `/api/consultation-slots` proxy. The proxy signs the request; the CRM verifies origin, HMAC signature and persistent rate limit before returning only future `OPEN` slots.
- Reservation: the order, idempotency record, slot claim and slot audit are written in one database transaction. The conditional `OPEN` update prevents concurrent double booking.
- Cancellation: cancelling or deleting the linked application releases the slot and writes an audit event. A reserved slot cannot be changed directly; the manager must act on the linked application.
- Rollback: apply `database/migrations/20260917010000_customer_workflows/rollback.sql`. This removes workflow data, so it is an emergency rollback requiring a database backup.

The catalogue confirms that the selected slot is reserved only after the CRM transaction succeeds. A 409 conflict refreshes availability and asks the customer to select another slot.

## Task 25 — status SMS

The integration target is the Moldova-capable SMS.MD REST API v1 example in the [official provider documentation](https://sms.md/developers). The code is fail-closed and production delivery is disabled until all required approvals and a provider contract are configured. A successful provider response records `ACCEPTED`, not `DELIVERED`: the published example returns a queued message ID, while actual delivery needs a separately verified delivery report.

Required production decisions and values:

1. Signed provider contract and funded SMS.MD account.
2. Registered sender ID and `SMS_MD_API_TOKEN`.
3. Legal approval that `transactional_status` is the applicable basis.
4. Approved Russian and Romanian `PROCESSING` templates. The only supported placeholder is `{requestId}`.
5. Approved quiet hours in `HH-HH` Moldova time.
6. Confirmed delivery-report authentication contract. The public provider page describes DLR payloads but does not document a verifiable webhook signature, so inbound DLR is deliberately not exposed.

Activation requires all of the following environment variables:

```text
CUSTOMER_STATUS_NOTIFICATIONS_ENABLED=true
CUSTOMER_STATUS_NOTIFICATION_LEGAL_BASIS=transactional_status
CUSTOMER_STATUS_QUIET_HOURS=20-09
CUSTOMER_STATUS_TEMPLATE_PROCESSING_RU=...
CUSTOMER_STATUS_TEMPLATE_PROCESSING_RO=...
SMS_MD_API_TOKEN=...
SMS_MD_SENDER=...
```

The outbox is idempotent on `(orderId, status)`, stores attempts, provider message ID, accepted cost/currency and failure code, and respects a client opt-out recorded with an audit entry. It sends only for the valid transition to `PROCESSING`. Missing approval or configuration produces no external request. A network failure or provider 5xx is `NEEDS_REVIEW`, never an automatic retry, because the provider may have accepted the request. Quiet-hours deferral remains pending and requires an approved retry scheduler before production activation.

## Task 26 — enriched client profile

The client detail sheet now separates calculated facts from manager-authored notes.

- `Постоянный` is calculated only after three or more `DONE` applications.
- Preferred products use unit counts from `DONE` orders only; cancelled and unfinished requests cannot inflate the result.
- Preferred contact time uses the most frequent non-empty submitted value, with most-recent use as a tie breaker. The UI shows the evidence count.
- Completed value excludes cancelled/open requests and reports missing-price lines separately.
- Manager notes are internal, immutable journal entries with author and timestamp.
- Contact edits, notification opt-out changes and notes remain behind CRM authentication and have durable audit records.
- Empty history produces explicit “insufficient data” states rather than unsupported inference.

## Verification status

The owner explicitly requested that tests and validation not be run for this change. Code, migrations, tests and documentation were added, but the following remain intentionally unverified in this working session:

- Prisma migration deployment;
- unit/integration suites, including concurrent reservation against PostgreSQL;
- catalogue and CRM builds;
- browser accessibility and RU/RO end-to-end flows;
- production SMS provider credentials and delivery receipt behavior.
