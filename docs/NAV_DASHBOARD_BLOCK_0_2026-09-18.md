# Navigation/dashboard audit — Block 0 evidence

**Date:** 2026-09-18  
**Tasks:** 1–3  
**Result:** `PASS` for the contract, baseline and ownership scope  
**Production UI changes:** none  
**Diagnostic change:** one route-contract unit test

## Task 1 — five-route contract

The App Router contains the root redirect and exactly five CRM page files:

| Route | Navigation label | Source | Runtime result |
|---|---|---|---|
| `/dashboard` | Дашборд | `src/app/(crm)/dashboard/page.tsx` | 200 |
| `/results` | Результаты | `src/app/(crm)/results/page.tsx` | 200 |
| `/orders` | Заказы и заявки | `src/app/(crm)/orders/page.tsx` | 500: unrelated pending Block 5 database migration |
| `/clients` | Клиентская база | `src/app/(crm)/clients/page.tsx` | 500: unrelated pending Block 5 database migration |
| `/catalog` | Каталог и цены | `src/app/(crm)/catalog/page.tsx` | 200 |

`/` returns a 307 redirect to `/dashboard`. `/status`, `/debug`, `/results/sales`, `/results/forecast`, and `/results/promotion` return 404. No other `page.tsx` exists in the application tree.

The shared navigation keeps exactly the five approved hrefs. Active state uses `aria-current="page"`. The mobile drawer:

- disables the hidden sidebar with `inert` and `aria-hidden`;
- moves focus to its close button when opened;
- traps Tab/Shift+Tab inside the drawer;
- closes on Escape, backdrop click and route selection;
- returns focus to the menu button after closing.

`tests/unit/crm-route-contract.test.ts` now verifies the exact page-tree set, root redirect, sidebar href set and absence of forbidden navigation destinations. Focused result: 2/2 tests passed.

### Runtime blocker outside Block 0

The two 500 responses do not represent extra or missing routes. They come from schema drift in the existing uncommitted customer-workflow work:

- `/orders`: local database lacks `Order.locale` and `ConsultationSlot`;
- `/clients`: local database lacks `Client.customerNotificationsOptOutAt`.

Block 0 does not apply or disguise that migration because it belongs to a separate persistence workstream.

## Task 2 — dashboard and results baseline

The pre-Block-1 state was reconstructed from detached `HEAD` (`37fc752`) in a temporary worktree. The current state was captured from the working tree. Both used the same production-shaped demo dataset without exposed customer PII.

Eight screenshots were captured locally at 1440×900 and 390×844 for `/dashboard` and `/results`, before/current. They are stored under the Git-ignored directory `test-results/nav-dashboard-block0-2026-09-18/`; runtime evidence is intentionally not committed.

### Dashboard measurements

| Measurement | Before Block 1 | Current | Delta |
|---|---:|---:|---:|
| Desktop KPI top | 529 px | 196 px | −333 px |
| Desktop main scroll height | 2340 px | 2007 px | −333 px |
| Mobile KPI top | 867 px | 286 px | −581 px |
| Mobile main scroll height | 5598 px | 5017 px | −581 px |
| Mobile document scroll width | 390 px | 390 px | no horizontal overflow |

Before Block 1, delivery health occupied 110 px and SLA occupied 183 px on desktop before KPI content. On mobile these sections occupied 206 px and 335 px. Current order is: page header → KPI → current order statuses → revenue chart/top products → regional/source/hour analytics → period totals → recent orders.

Operational status and period analytics remain distinct: the global shell widget owns live health/SLA; the page owns selected-period KPI and the current order-status snapshot.

### Results baseline for Block 2

Current `/results` order is:

1. title and explanatory header;
2. Excel export action;
3. period navigation;
4. demo/price completeness disclosures;
5. period timestamp;
6. KPI grid;
7. calculation explanation;
8. promotion advice;
9. logistics forecast;
10. regional and operational detail.

At 1440×900 the KPI grid begins at 498 px and finishes at 658 px. At 390×844 it begins at 559 px and finishes at 1235 px. Total content height is about 6400 px on desktop and 8275 px on mobile. These measurements establish the shortening target for Tasks 11–17 without changing formulas.

Both routes stay within the viewport width at 390 px. Dashboard and Results provide `role="status"` loading states with reduced-motion-safe skeletons. Results failure uses `role="alert"`; both error boundaries expose a real retry action.

## Task 3 — frozen ownership

| Stream | Owners | Data boundary | Tests/evidence |
|---|---|---|---|
| Block 0 | this document, workflow document, `crm-route-contract.test.ts` | read-only route/source inspection and local screenshots | route-contract test and captured measurements |
| Block 1 | `crm-shell.tsx`, `crm-status-widget.tsx`, `status-actions.ts`, `src/server/crm-status.ts`, `src/server/application-health.ts`, dashboard page/components | `getCrmStatusSnapshot()` for global operational health; `getDashboardStats(range)` for dashboard analytics | status, application-health, SLA and dashboard tests |
| Block 2 | `results/page.tsx`, `results/components/*`, `server/analytics/results-service.ts`, `results-calculations.ts`, `operational-results.ts`, shared export dialog | `getResultsData(period)` remains authoritative; tabs may reorganize presentation only | results-service and operational-results tests |
| Block 3 | future server-only diagnostics modules, `crm-auth.ts`, and Prisma migration only after decisions | separate roles/privacy/retention/persistence boundary | not authorized and not implemented |

### Shared-file review rules

- `src/app/(crm)/actions.ts` currently owns dashboard, orders, clients and catalogue actions. Any Block 2 edit to it requires an explicit data-boundary reason; presentation work should use `getResultsData()` instead.
- `src/app/(crm)/_components/crm-shell.tsx` owns navigation and the global status mount. Results tabs cannot add sidebar destinations.
- `database/schema.prisma` is outside Blocks 0–2. Navigation and results work cannot add persistence.
- Block 3 cannot be included in a Block 1 or Block 2 commit, even if the UI could be placed inside `/dashboard`.

## Verification performed

- Graphify query and ownership traversal against the merged catalogue/CRM graph.
- Source inventory of every App Router `page.tsx`.
- Focused route-contract unit test: 2 passed.
- Runtime HTTP route sweep for the root, five approved routes and five forbidden routes.
- Before/current screenshots and CDP geometry at desktop and mobile widths.
- Manual inspection of loading, error, navigation focus and responsive ownership code.

The full repository suite was not run, following the owner’s instruction to keep this workflow focused. The next permitted task remains Task 11 in Block 2.
