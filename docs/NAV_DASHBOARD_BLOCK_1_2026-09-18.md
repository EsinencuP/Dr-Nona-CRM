# Navigation/dashboard audit — Block 1 evidence

**Date:** 2026-09-18  
**Tasks:** 1–10  
**Result:** `PASS` with scoped verification  
**Next task:** 11 (`/results` tab contract)

## Delivered behavior

- The CRM still exposes exactly five navigation destinations: `/dashboard`, `/results`, `/orders`, `/clients`, and `/catalog`.
- A compact global status indicator now lives in the shared CRM header on all five page routes.
- The indicator derives `healthy`, `warning`, `critical`, and `unknown` from the existing application-health and SLA sources. It does not create diagnostics storage, roles, mutations, or a new route.
- Its accessible right-side Sheet shows Telegram delivery health, database reachability, NEW-order SLA counts, the calculation timestamp, safe shortened order references, recovery guidance, and a link to filtered orders.
- The Sheet was verified to open, trap interaction through the existing Base UI dialog primitive, close, and restore focus to the indicator.
- Polling runs every 60 seconds only while the document is visible. Returning to a visible tab refreshes an old snapshot. A failed refresh or a snapshot older than 150 seconds is explicitly shown as unknown rather than as a system outage.
- The former dashboard-only health and SLA cards were removed after content parity. Dashboard KPI and current-order content now enters the first useful viewport earlier.
- Navigation labels, hrefs, active matching and the five-item count were preserved. Existing mobile drawer focus trap, Escape close, backdrop close, close-on-navigation and focus restoration remain owned by `CrmShell`.

## Scope boundaries preserved

- No `/status`, `/debug`, or nested `/results/*` page was added.
- No role model, audit-event table, persistence migration, Telegram test action, or administrator panel was added.
- No analytics formula or dashboard data-source semantics were changed.
- Block 2 and Block 3 code was not started.

## Focused verification

| Check | Result | Evidence |
|---|---|---|
| Status model + existing health/SLA unit tests | `PASS` | 3 files, 10 tests |
| Changed-file Biome check | `PASS` | Focused files only |
| Browser: dashboard first viewport | `PASS` | KPI cards replace persistent health/SLA cards above the fold |
| Browser: status Sheet | `PASS` | Real warning state, delivery/SLA details, close and focus restoration verified at `localhost:3001` |
| Shared shell status | `PASS` | `/dashboard`, `/results`, and `/catalog` returned 200 with the global indicator; shared layout owns all five routes |
| Five-route source contract | `PASS` | Five unchanged hrefs in `crm-shell.tsx`; no new page destination |
| Full repository suite | `NOT RUN` | Explicit owner request to avoid full checks for this block |

## Repository conditions outside Block 1

The existing dirty Block 5 customer-workflow work is not part of this block and was not modified to force a green result.

- `/orders` currently returns 500 because the local database lacks `Order.locale` and `ConsultationSlot` expected by the uncommitted Block 5 schema/code.
- `/clients` currently returns 500 because the local database lacks `Client.customerNotificationsOptOutAt` expected by the uncommitted Block 5 schema/code.
- Repository-wide `typecheck` remains red in unrelated Block 5 edits: the `sessionHistory` result union in `src/app/(crm)/actions.ts` and missing `NODE_ENV` fields in `tests/unit/customer-status-notifications.test.ts` fixtures.

These conditions block a claim that the whole repository is green. They do not originate from the global status/dashboard changes. Applying the pending Block 5 database migration and completing that block’s typing fixes belongs to its own workstream.

## Files owned by Block 1

- `src/server/crm-status.ts`
- `src/app/(crm)/_components/status-actions.ts`
- `src/app/(crm)/_components/crm-status-widget.tsx`
- `src/app/(crm)/_components/crm-shell.tsx`
- `src/app/(crm)/layout.tsx`
- `src/app/(crm)/dashboard/page.tsx`
- `tests/unit/crm-status.test.ts`
- removed: `src/app/(crm)/dashboard/_components/application-health-card.tsx`
- removed: `src/app/(crm)/dashboard/_components/sla-card.tsx`

## Remaining risk

The global widget was visually checked on desktop in the local browser. Responsive behavior is based on intrinsic Tailwind layout and the existing verified shell drawer; a full viewport/e2e matrix was intentionally deferred with the rest of the full suite. The next authorized UI work starts at Task 11 and must stay inside `/results`.
