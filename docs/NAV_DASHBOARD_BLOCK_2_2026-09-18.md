# Navigation/dashboard audit — Block 2 evidence

**Date:** 2026-09-18  
**Tasks:** 11–17  
**Result:** `PASS`  
**Next task:** 18, only after explicit authorization for the separate administrator-infrastructure stream

## Delivered behavior

- `/results` now has three task-oriented views: `sales`, `forecast`, and `promotion`.
- The selected view is represented by the validated `view` search parameter. Missing, repeated-array, or invalid values fall back to `sales` without throwing or creating another route.
- Tabs are accessible links with tab semantics, visible focus, selected state, named tab panels, and left/right/Home/End keyboard handling. Link navigation preserves browser history and copied URLs.
- The current `period` survives view changes. View selection survives period changes.
- `sales` contains the period filter, financial KPIs, completeness and demo disclosures, regional distribution, operational intelligence, methodology, and the configurable Excel export.
- `forecast` makes the logistics table the primary surface. It states the 90-day calculation window, calculation time, 15% buffer rule, and the absence of stock-on-hand, inbound-supply, returns, and supplier-lead-time inputs. It does not show the unrelated sales-period control.
- `promotion` contains period-dependent analytical recommendations, demo disclosure, filtering by categories already present in the catalogue, and links to the existing `/catalog` search. It does not create discounts, campaigns, claims, or product routes.
- `getResultsData()` and the existing calculation modules remain authoritative. No formula, price interpretation, forecast model, data query, or export schema was moved or altered.

## Task ledger

| Task | Result | Evidence |
|---:|---|---|
| 11. `/results` tab contract | `PASS` | Three validated values, deterministic `sales` fallback, stable query-string helpers |
| 12. Presentation sections | `PASS` | Server page retained; sales, forecast, and promotion presentation extracted into colocated sections |
| 13. Sales tab | `PASS` | Primary financial summary precedes regional and operational detail; warnings and export preserved |
| 14. Forecast tab | `PASS` | Fixed 90-day assumptions and limitations adjacent to the horizontally inspectable table |
| 15. Promotion tab | `PASS` | Verified catalogue categories, empty-state handling, and catalogue links |
| 16. Shared filters and export | `PASS` | URL state is preserved in both directions; irrelevant period control absent from forecast; Excel field-selection contract unchanged |
| 17. Independent validation | `PASS` | Focused tests, static checks, build, route contract, and responsive browser evidence recorded below |

## Scope boundaries preserved

- The page-route set remains `/dashboard`, `/results`, `/orders`, `/clients`, and `/catalog`.
- No `/results/sales`, `/results/forecast`, `/results/promotion`, `/status`, or `/debug` page exists.
- Sidebar destinations and labels were not changed.
- No administrator role, diagnostics event, database migration, API endpoint, inventory mutation, purchase-order flow, or supplier workflow was added.
- Block 3 remains `DECISION_REQUIRED` / `BLOCKED` until separately authorized.

## Verification evidence

| Check | Result | Evidence |
|---|---|---|
| View and period URL contract | `PASS` | Missing/valid/invalid/array views and cross-filter query preservation covered by unit tests |
| Category presentation | `PASS` | Category derivation, source immutability, filtered and unmatched states covered by unit tests |
| Existing analytical truth | `PASS` | Results calculations, operational intelligence, export data, and route-contract fixtures unchanged and green |
| Full Vitest suite | `PASS` | 36 files, 285 tests |
| TypeScript | `PASS` | Next route type generation and `tsc --noEmit` |
| Biome lint/check | `PASS` | No lint, accessibility, or formatting findings |
| Production build | `PASS` | Next.js compiled successfully and emitted only the root redirect plus five approved CRM pages |
| Local browser: URL fallback | `PASS` | `?period=bad&view=unknown` renders Sales + 30 days deterministically |
| Local browser: route preservation | `PASS` | No rendered link begins with `/results/` |
| Local browser: responsive | `PASS` | Results content checked at 320, 390, 768, and 1440 px; Block 2 content does not create document overflow |
| Local browser: keyboard/history | `PASS` | ArrowLeft moved Promotion → Forecast with focus retained; period/view survived navigation and browser Back |
| Local browser: forecast | `PASS` | Period controls and export absent; 90-day warning and all meaningful table columns available through horizontal scrolling |
| Local browser: promotion | `PASS` | Live `Кремы` filtering reduced recommendations to matching catalogue products; catalogue search links remained intact |

## Files owned by Block 2

- `src/app/(crm)/results/page.tsx`
- `src/app/(crm)/results/results-view.ts`
- `src/app/(crm)/results/components/results-tabs.tsx`
- `src/app/(crm)/results/components/results-sections.tsx`
- `src/app/(crm)/results/components/period-filter.tsx`
- `src/app/(crm)/results/components/logistics-forecast-table.tsx`
- `src/app/(crm)/results/components/promotion-advice-cards.tsx`
- `src/app/(crm)/results/components/promotion-filter.ts`
- `src/app/(crm)/_components/export-dialog.tsx`
- `tests/unit/results-view.test.ts`
- `tests/unit/promotion-filter.test.ts`

## Remaining risk

The shared mobile header from Block 1 exceeds a synthetic 320 px layout viewport by approximately 7 px because of its status control. Block 2 tabs originally exposed a larger overflow during verification and were corrected to a three-column intrinsic grid. The remaining header condition predates and is outside the Results information-architecture stream; Results content itself stays within its container.

Block 3 is intentionally unfinished. Its role model, diagnostics retention, privacy rules, migrations, operational actions, and security review require separate owner decisions and must not be inferred from this PASS.
