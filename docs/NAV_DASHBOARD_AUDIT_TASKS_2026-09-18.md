# CRM navigation, dashboard and diagnostics — task workflow

**Created:** 2026-09-18  
**Source audit:** `C:\Users\User.DESKTOP\.gemini\antigravity\brain\7737fd0e-b347-42b1-a5fd-897f24963d07\nav_dashboard_audit.md`  
**Repository:** `EsinencuP/Dr-Nona-CRM`  
**State:** execution active. Blocks 0–1 completed with scoped verification on 2026-09-18; Block 2 has not started.

## Execution ledger

| Block | Tasks | Status | Evidence | Next permitted task |
|---|---:|---|---|---:|
| 0. Contract and evidence | 1–3 | `PASS` | [`NAV_DASHBOARD_BLOCK_0_2026-09-18.md`](NAV_DASHBOARD_BLOCK_0_2026-09-18.md) | 4 |
| 1. Status and dashboard | 4–10 | `PASS` (scoped verification) | [`NAV_DASHBOARD_BLOCK_1_2026-09-18.md`](NAV_DASHBOARD_BLOCK_1_2026-09-18.md) | 11 |
| 2. Results information architecture | 11–17 | `OPEN` | Not started | 11 |
| 3. Administrative infrastructure | 18–26 | `DECISION_REQUIRED` / `BLOCKED` | Separate authorization remains required | 18 |

Tasks 1–10 are complete. “Scoped verification” means the changed status/dashboard surface passed its focused tests, formatting and local browser check. Full repository checks were intentionally not run at the owner’s request. Two pre-existing database-migration mismatches in unrelated Block 5 work still prevent `/orders` and `/clients` from rendering against the current local database; they are recorded in both Block 0 and Block 1 evidence and do not change the route contract or the Block 1 implementation result.

## Fixed architecture contract

The CRM keeps exactly these five working page routes:

1. `/dashboard`
2. `/results`
3. `/orders`
4. `/clients`
5. `/catalog`

This workflow does not add `/status`, `/debug`, `/results/sales`, `/results/forecast`, or `/results/promotion`.

- System status details open in an accessible Sheet/Dialog owned by the existing CRM shell.
- The three result contexts are tabs within `/results`; the selected tab may be represented by a validated `view` search parameter.
- Future administrator diagnostics, if authorized, remain inside `/dashboard` as a separately loaded admin panel. They do not become a sidebar item and do not change the five-route navigation.
- API handlers and Server Actions do not count as page routes, but any new external API remains subject to the repository approval rules.

## Scope separation

The work is divided into independent streams. A commit or pull request must not combine tasks from different streams.

| Stream | Tasks | Scope | May change sidebar navigation? | May add persistence or admin capabilities? |
|---|---:|---|---|---|
| 0. Contract and evidence | 1–3 | Baseline, ownership, acceptance | No | No |
| 1. Status and dashboard | 4–10 | Global status presentation and dashboard hierarchy | Only presentation of the existing five items | No |
| 2. Results information architecture | 11–17 | Tabs and content organization inside `/results` | No | No |
| 3. Administrative infrastructure | 18–26 | Roles, audit events and diagnostics | No | Only after explicit decisions |

Stream 3 cannot start automatically when Streams 1–2 pass. It has its own security, privacy, database and operations decisions. Navigation work must not create placeholder administrator links or inactive menu entries.

## Status labels

- `OPEN` — confirmed planning task that can be started after its dependencies.
- `VERIFY_FIRST` — the audit claim must be checked against the current code and runtime before editing.
- `DECISION_REQUIRED` — a product, security, privacy, database, provider or operational decision is required.
- `BLOCKED` — a dependency or required decision is unresolved.
- `PASS` — acceptance criteria are met and evidence is recorded.

## Execution rules

1. Start one numbered task only when the owner explicitly requests that task or its whole block.
2. Query the merged Graphify map before opening broad source scope. Record the owning modules and affected interfaces before editing.
3. Reverify the audit statement. The audit is an input, not proof of a current defect.
4. Do not move business calculations between dashboard and results as part of visual restructuring.
5. Do not fabricate health, SLA, event, Telegram, customer, order or inventory data.
6. Do not expose request bodies, Telegram tokens, chat identifiers, complete phone numbers or other customer PII in diagnostics.
7. Keep page files as Server Components. Isolate interactive tabs, dialogs and polling in dedicated Client Components.
8. Run the checks relevant to the selected task and record evidence. Rebuild the merged graph after architecture or source changes.
9. Finish every task with: status, evidence, files changed, tests, deployment state, remaining risk and next permitted task.

---

# Block 0 — Freeze the contract and current evidence

This block produces the baseline shared by the two UI streams and the later administrator stream. It changes no production UI.

## Task 1 — Verify the five-route contract

**Starting state:** `VERIFY_FIRST`  
**Completion:** `PASS` — exact page tree, href set, forbidden-route 404 behavior and focused regression test recorded in Block 0 evidence.  
**Likely owners:** `AGENTS.md`, `src/app/(crm)/_components/crm-shell.tsx`, app route tree, route tests

### Subtasks

1. Inventory all page routes and confirm that only the five approved CRM destinations are exposed.
2. Record current desktop and mobile navigation behavior, active-item matching and menu focus restoration.
3. Verify that no historical `/status`, `/debug` or nested `/results/*` route remains accessible.
4. Add or update a route-contract assertion only if current automated coverage is insufficient.
5. Record the verified route list as the acceptance baseline for Tasks 4–26.

### Acceptance

- The five approved routes are the only CRM page destinations.
- Deep links, mobile navigation and active states are documented.
- No production feature is implemented in this task.

## Task 2 — Capture dashboard and results baselines

**Starting state:** `OPEN`  
**Completion:** `PASS` — detached-HEAD/current screenshots and CDP geometry captured at 1440×900 and 390×844.  
**Dependencies:** Task 1  
**Likely owners:** `src/app/(crm)/dashboard/page.tsx`, `src/app/(crm)/results/page.tsx`, their colocated components

### Subtasks

1. Capture desktop and mobile screenshots of `/dashboard` and `/results` using production-shaped data with PII removed.
2. Record first-viewport content order, scroll depth, loading behavior, empty states and failure states.
3. Measure the rendered footprint of `ApplicationHealthCard`, `SlaCard`, KPI blocks and each results section.
4. Confirm which data is live operational state and which is period analytics.
5. Record accessibility behavior for headings, landmarks, focus order and reduced motion.

### Acceptance

- Before evidence exists for every surface that later tasks may change.
- Operational health, SLA and analytics data are not conflated.
- No code is changed except optional diagnostic assertions or screenshot tooling.

## Task 3 — Freeze module ownership and non-bundling rules

**Starting state:** `OPEN`  
**Completion:** `PASS` — shell, dashboard, results and separately gated administrative owners/data boundaries are frozen in Block 0 evidence.  
**Dependencies:** Tasks 1–2

### Subtasks

1. Map the shell, health service, dashboard data, results service, result components and relevant tests through Graphify.
2. Define the read-only status summary boundary consumed by the shell.
3. Define the existing results data boundary consumed by the tab presentation.
4. List files owned by Streams 1, 2 and 3 and identify shared files that require extra review.
5. Record that Stream 3 may not be bundled with navigation or results work.

### Acceptance

- Each stream has named owners, data boundaries and tests.
- Shared-file edits have an explicit reason and cannot silently merge scopes.
- The task produces documentation only.

---

# Block 1 — Global status presentation and dashboard hierarchy

This block improves the existing shell and dashboard without creating a status page, administrator tooling, roles or event storage.

## Task 4 — Define the global status summary contract

**Starting state:** `OPEN`  
**Dependencies:** Task 3  
**Likely owners:** `src/server/application-health.ts`, dashboard SLA types, a new shell-facing read model

### Subtasks

1. Define `healthy`, `warning`, `critical` and `unknown` states from existing verified health and SLA data.
2. Specify the precedence rule when Telegram and SLA states differ.
3. Include calculation timestamp, stale-data threshold and a safe explanation without PII.
4. Define polling failure and recovery behavior without claiming that a failed request means the whole system is down.
5. Keep the contract read-only; do not add event history, roles, mutations or database tables.

### Acceptance

- Every visible status is derived from existing authoritative data.
- Unknown and stale states are explicit.
- The contract contains no sensitive payloads or administrator-only fields.

## Task 5 — Build the shell status indicator

**Starting state:** `OPEN`  
**Dependencies:** Task 4  
**Likely owner:** `src/app/(crm)/_components/crm-shell.tsx` plus a dedicated colocated component

### Subtasks

1. Add a compact status indicator available on all five routes.
2. Keep it outside primary content flow without covering actions, tables, dialogs or mobile safe areas.
3. Provide text and icon semantics in addition to color.
4. Use restrained opacity/transform feedback; do not blink or play sound.
5. Respect `prefers-reduced-motion` and keyboard/touch operation.

### Acceptance

- Status remains discoverable on desktop and mobile without obstructing work.
- All three states plus unknown are understandable without color.
- The five navigation destinations remain unchanged.

## Task 6 — Add status details in an accessible overlay

**Starting state:** `OPEN`  
**Dependencies:** Task 5  
**Likely owners:** shell status component, existing health and SLA presentation components

### Subtasks

1. Open details in a Sheet/Dialog from the global indicator.
2. Present current Telegram delivery health, SLA counts, timestamps and recovery guidance.
3. Reuse or extract existing presentation responsibly without coupling the shell to the dashboard page.
4. Implement focus trapping, close behavior, Escape handling and focus restoration.
5. Avoid a `/status` link, event history and administrator controls.

### Acceptance

- The overlay contains all information required before removing static dashboard cards.
- Keyboard and screen-reader behavior is verified.
- No new route or persistence layer exists.

## Task 7 — Move dashboard health content only after parity

**Starting state:** `BLOCKED` until Task 6 passes  
**Dependencies:** Task 6  
**Likely owners:** `src/app/(crm)/dashboard/page.tsx`, `application-health-card.tsx`, `sla-card.tsx`

### Subtasks

1. Compare overlay content with both existing dashboard cards field by field.
2. Remove the static cards from dashboard only when no operational information is lost.
3. Remove obsolete imports and components only if Graphify and source search prove they have no other owners.
4. Preserve existing data-fetch failure behavior.
5. Capture before/after evidence for the first viewport.

### Acceptance

- KPI content becomes visible earlier.
- Health and SLA information remains reachable globally.
- No status data or error state disappears.

## Task 8 — Recompose the dashboard first viewport

**Starting state:** `OPEN`  
**Dependencies:** Task 7  
**Likely owners:** `src/app/(crm)/dashboard/page.tsx`, dashboard CSS and colocated components

### Subtasks

1. Place the most actionable KPI and current-order information in the first viewport.
2. Preserve the distinction between period metrics and current operational statuses.
3. Prevent the incomplete-price warning from obscuring the entire overview while keeping it visible.
4. Check 320, 375, 768, 1024 and wide desktop layouts.
5. Preserve calculation semantics and data sources.

### Acceptance

- A manager can identify the current operational state without scrolling through persistent healthy-state cards.
- KPI hierarchy is coherent at mobile and desktop widths.
- No analytics formula changes.

## Task 9 — Refine the existing five-item navigation presentation

**Starting state:** `VERIFY_FIRST`  
**Dependencies:** Task 8  
**Likely owner:** `src/app/(crm)/_components/crm-shell.tsx`

### Subtasks

1. Verify label width, descriptions, active states and sidebar density.
2. Refine spacing or visual hierarchy only where baseline evidence shows a problem.
3. Preserve current hrefs, labels and route count.
4. Verify drawer focus, backdrop behavior, close-on-navigation and scroll locking.
5. Do not add status, debug or results-child navigation items.

### Acceptance

- Navigation remains five items and works at every supported viewport.
- Active states are unambiguous.
- Mobile behavior is keyboard and touch accessible.

## Task 10 — Validate Block 1 independently

**Starting state:** `BLOCKED` until Tasks 4–9 pass  
**Dependencies:** Tasks 4–9

### Subtasks

1. Run focused unit/component tests for the status model, indicator and overlay.
2. Verify all five routes with healthy, warning, critical, unknown and polling-failure states.
3. Verify mobile, reduced motion, keyboard and screen-reader semantics.
4. Compare dashboard screenshots against Task 2 baseline.
5. Record performance impact and confirm that polling stops or backs off appropriately when hidden.

### Acceptance

- Block 1 is `PASS` without relying on any Stream 3 capability.
- No new page route, role model, debug event or database table was introduced.
- Remaining issues are recorded before Block 2 begins.

---

# Block 2 — Results information architecture inside `/results`

This block reorganizes existing analytics. It does not change the sidebar, add nested routes or alter formulas.

## Task 11 — Define the `/results` tab contract

**Starting state:** `OPEN`  
**Dependencies:** Task 3  
**Likely owners:** `src/app/(crm)/results/page.tsx`, a new colocated tabs component

### Subtasks

1. Define three values: `sales`, `forecast`, and `promotion`.
2. Use a validated `view` search parameter so a selected tab can be bookmarked without creating a route.
3. Define the default and fallback for missing or invalid values.
4. Preserve the current `period` parameter where it is relevant.
5. Define heading, landmark and focus behavior when the tab changes.

### Acceptance

- All result contexts resolve through `/results` only.
- Invalid input falls back safely and deterministically.
- Browser history and deep links behave predictably.

## Task 12 — Extract presentation sections without moving calculations

**Starting state:** `OPEN`  
**Dependencies:** Task 11  
**Likely owners:** `src/app/(crm)/results/page.tsx`, `src/app/(crm)/results/components/*`

### Subtasks

1. Group existing components into sales, forecast and promotion presentation sections.
2. Keep `getResultsData()` and existing calculation services authoritative.
3. Keep the page as a Server Component and isolate only tab interaction where needed.
4. Preserve incomplete-price, demo-data and empty-state disclosures in the relevant context.
5. Avoid duplicate headings and repeated explanatory copy.

### Acceptance

- No formula, price interpretation, forecast model or recommendation logic changes.
- Each component has one clear tab owner.
- Existing warning semantics remain visible.

## Task 13 — Compose the Sales tab

**Starting state:** `OPEN`  
**Dependencies:** Task 12

### Subtasks

1. Place KPI, regional distribution and operational intelligence in a coherent sales narrative.
2. Keep current comparison periods and completeness disclosures.
3. Ensure the primary financial summary appears before secondary detail.
4. Verify empty and partial-data behavior.
5. Preserve export access for sales-relevant fields.

### Acceptance

- The tab answers what happened in the selected period.
- Partial monetary data cannot be mistaken for complete reporting.
- Existing calculations remain byte-for-byte equivalent for the same input fixture where practical.

## Task 14 — Compose the Forecast tab

**Starting state:** `OPEN`  
**Dependencies:** Task 12

### Subtasks

1. Make `LogisticsForecastTable` the primary surface.
2. Keep the 90-day model explanation and last-calculation timestamp near the table.
3. Preserve the warning that stock on hand and inbound supply are not modeled.
4. Verify wide-table behavior on small screens without hiding meaningful columns.
5. Do not add inventory mutations, purchase orders or supplier workflows.

### Acceptance

- The tab explains future demand assumptions and limitations.
- No forecast is presented as confirmed stock need.
- Mobile users can inspect all meaningful values.

## Task 15 — Compose the Promotion tab

**Starting state:** `OPEN`  
**Dependencies:** Task 12

### Subtasks

1. Make `PromotionAdviceCards` the primary surface.
2. Add category filtering only from existing verified catalogue categories.
3. Link recommendations to existing `/catalog` content without adding catalogue routes.
4. Preserve the distinction between analytical advice and approved campaigns.
5. Verify empty, sparse and many-recommendation states.

### Acceptance

- Recommendations are scannable and traceable to existing data.
- No marketing claim, discount or campaign is fabricated.
- The tab does not introduce a new page destination.

## Task 16 — Define shared filters and export behavior

**Starting state:** `VERIFY_FIRST`  
**Dependencies:** Tasks 13–15  
**Likely owners:** results period filter, export dialog, results page

### Subtasks

1. Decide which tabs use `period` and make irrelevant controls absent or clearly explained.
2. Preserve the existing configurable Excel/CSV export contract and approved field selection.
3. Ensure export labels describe the active report rather than the visual tab alone.
4. Preserve selected `view` when changing period and selected period when changing view.
5. Verify refresh, back/forward and copied URLs.

### Acceptance

- Filters never imply that the forecast window equals the sales reporting window when it does not.
- Export output remains deliberate, labeled and privacy-safe.
- URL state is stable without nested routes.

## Task 17 — Validate Block 2 independently

**Starting state:** `BLOCKED` until Tasks 11–16 pass  
**Dependencies:** Tasks 11–16

### Subtasks

1. Test valid, invalid and missing `view`/`period` combinations.
2. Verify keyboard tab semantics, focus visibility, headings and screen-reader names.
3. Check desktop, tablet, mobile and long table/card content.
4. Compare calculations and exports against pre-refactor fixtures.
5. Confirm that sidebar navigation and all five route paths are unchanged.

### Acceptance

- Block 2 is `PASS` independently of Block 3.
- `/results` is shorter and task-oriented without changing analytical truth.
- No nested results route or administrator capability exists.

---

# Block 3 — Administrative infrastructure, separately authorized

This block is a separate product and security initiative. It must not be included in navigation/dashboard polish commits. Tasks 18–26 remain gated until the owner explicitly starts this block and approves the required decisions.

## Task 18 — Decide the administrator access model

**Starting state:** `DECISION_REQUIRED`  
**Dependencies:** Blocks 1–2 may pass without this task

### Subtasks

1. Decide whether Basic Auth remains sufficient or authenticated sessions and roles are required.
2. Define administrator, manager and read-only capabilities.
3. Define server-side authorization for reads and mutations; hiding UI is not authorization.
4. Define session expiry, revocation, audit actor identity and production fail-closed behavior.
5. Document migration and rollback without changing the five page routes.

### Acceptance

- The owner approves one access model.
- Every proposed diagnostic capability has a server-enforced role.
- No admin UI is implemented before this task passes.

## Task 19 — Approve the diagnostics privacy and retention policy

**Starting state:** `DECISION_REQUIRED`  
**Dependencies:** Task 18

### Subtasks

1. Define allowed event fields and prohibited payload content.
2. Define masking rules for phones, email, Telegram identifiers and order metadata.
3. Define retention, deletion, export and incident-access rules.
4. Explicitly prohibit storage or display of full request/response bodies and secrets.
5. Decide whether any PII reveal is necessary; default is no reveal.

### Acceptance

- A written policy identifies data purpose, access and retention.
- Logs remain useful without containing customer payloads or credentials.
- Full-phone reveal is absent unless separately justified and approved.

## Task 20 — Design the structured audit-event model

**Starting state:** `BLOCKED` until Tasks 18–19 pass  
**Dependencies:** Tasks 18–19  
**Likely owners:** `database/schema.prisma`, a new server-only audit module, migration

### Subtasks

1. Define a minimal event taxonomy for application intake, persistence, Telegram delivery and status changes.
2. Store identifiers, timestamps, result classes and sanitized metadata rather than payload bodies.
3. Define actor identity and correlation/request identifiers.
4. Specify indexes, retention enforcement and migration rollback.
5. Review write amplification and failure behavior so audit failure cannot corrupt the primary transaction.

### Acceptance

- The schema follows the approved privacy policy.
- Events support operational diagnosis without becoming a duplicate customer database.
- Migration and rollback are rehearsed before production.

## Task 21 — Implement authorized read-only diagnostics queries

**Starting state:** `BLOCKED` until Task 20 passes  
**Dependencies:** Task 20

### Subtasks

1. Add server-only queries for recent sanitized events with bounded pagination.
2. Add filters for event class, outcome and time window.
3. Enforce administrator authorization at the server boundary.
4. Prevent arbitrary field selection, unbounded exports and cache leakage.
5. Test unauthorized, expired-session, empty, high-volume and database-failure states.

### Acceptance

- Non-administrators cannot infer event existence or contents.
- Queries are bounded and PII-safe.
- No new page or public API route is introduced.

## Task 22 — Implement read-only data-integrity checks

**Starting state:** `BLOCKED` until Task 21 passes  
**Dependencies:** Task 21

### Subtasks

1. Verify each proposed check against the actual Prisma relations and business rules.
2. Implement bounded read-only checks for orphaned relations, missing order items, invalid lifecycle values, duplicate normalized identities and stale `NEW` records where meaningful.
3. Distinguish a data-quality warning from a database or query failure.
4. Return counts and safe record references, not customer details.
5. Keep repair actions outside this task.

### Acceptance

- Checks cannot mutate production data.
- Every finding has a documented rule and safe follow-up path.
- False positives are covered by fixtures.

## Task 23 — Implement a safe system snapshot

**Starting state:** `BLOCKED` until Task 21 passes  
**Dependencies:** Task 21

### Subtasks

1. Expose safe build revision and deployment timestamp from approved environment metadata.
2. Measure bounded database availability/latency without exposing connection details.
3. Report sanitized table counts only where the privacy policy permits them.
4. Report the last known successful persistence and Telegram delivery timestamps from authoritative events.
5. Distinguish unknown, stale and failed states.

### Acceptance

- The snapshot contains no secrets, internal URLs or customer data.
- Health checks are bounded and cannot overload dependencies.
- Values are timestamped and their source is documented.

## Task 24 — Design Telegram diagnostics without side effects

**Starting state:** `DECISION_REQUIRED`  
**Dependencies:** Tasks 19–21

### Subtasks

1. Present sanitized recent delivery outcomes and webhook processing classes.
2. Never expose bot tokens, full chat identifiers or raw Telegram payloads.
3. Keep the initial diagnostics view read-only.
4. Specify a separately authorized test-message action with destination allowlisting, confirmation, rate limiting and audit evidence.
5. Do not implement the test-message action as part of this task.

### Acceptance

- Read-only diagnostics work without contacting Telegram on page load.
- Sending a test message remains a distinct explicitly authorized mutation task.
- Production customer chats cannot be selected arbitrarily.

## Task 25 — Build the administrator diagnostics panel inside `/dashboard`

**Starting state:** `BLOCKED` until Tasks 18–24 pass  
**Dependencies:** Tasks 18–24  
**Likely owners:** a separately loaded dashboard admin panel and server-only diagnostic services

### Subtasks

1. Load the panel only after server authorization.
2. Represent the panel through validated dashboard state such as `panel=diagnostics`, not `/debug`.
3. Keep the standard manager dashboard unchanged for unauthorized users.
4. Present events, integrity checks, Telegram diagnostics and system snapshot as separate sections.
5. Do not add a sidebar item or modify the navigation work from Block 1.

### Acceptance

- The five-route contract remains intact.
- Unauthorized users cannot load diagnostic data even by crafting a URL.
- Navigation refactoring and administrator infrastructure remain separate commits and review units.

## Task 26 — Validate and operationalize administrator diagnostics

**Starting state:** `BLOCKED` until Task 25 passes  
**Dependencies:** Task 25

### Subtasks

1. Run authorization, privacy, retention, pagination and failure-mode tests.
2. Verify sanitized production-shaped events without sending customer-facing messages.
3. Rehearse migration rollback and event-retention cleanup.
4. Write an operator runbook for interpreting states and escalating incidents.
5. Perform security review before deployment and record remaining risks.

### Acceptance

- Stream 3 can pass without modifying sidebar navigation or adding page routes.
- No PII, credential or raw payload exposure is present.
- Deployment, rollback and incident procedures are reproducible.

---

# Final dependency map

```text
Block 0: 1 → 2 → 3

Block 1: 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

Block 2: 3 → 11 → 12 → (13, 14, 15) → 16 → 17

Block 3: explicit owner authorization
          18 → 19 → 20 → 21 → (22, 23, 24) → 25 → 26
```

Blocks 1 and 2 may be implemented and accepted independently after Block 0. Block 3 does not block their release unless an actual current security defect is separately confirmed.

## Completion definition

The audit is not considered fully implemented merely because the dashboard looks cleaner. Completion requires:

- Tasks 1–17 are `PASS` for the approved UI scope.
- The five-route contract remains true.
- Dashboard status presentation and `/results` tabs retain all verified information and calculation semantics.
- Tasks 18–26 remain honestly marked `DECISION_REQUIRED` or `BLOCKED` until administrator infrastructure is separately approved and implemented.
- Repository release status continues to report unrelated blockers independently.
