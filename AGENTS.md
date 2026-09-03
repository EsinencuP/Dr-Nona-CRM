# Repository rules for Dr. Nona CRM Moldova

This repository is the autonomous Next.js 16 internal CRM and application backend for Dr. Nona Moldova.

## Product boundaries

- Keep exactly four working routes: `/dashboard`, `/orders`, `/clients`, and `/catalog`.
- Do not restore demo routes or template brands.
- Internal prices must never be exposed by the public Vite application.
- Do not invent client, order, attribution, price, or profitability data.
- Treat all Server Actions as untrusted entry points and validate every mutation.
- Production access must fail closed when CRM credentials are absent.
- Keep `/api/applications` public only through its validation, origin and rate-limit guards.
- Keep `/api/telegram-webhook` public only through Telegram's secret-token verification.

## Architecture

- Keep route-specific components colocated under the owning route.
- Keep `page.tsx` as a Server Component and move interaction into dedicated Client Components.
- Reuse intact primitives from `src/components/ui/`; do not edit those wrappers.
- Use Prisma through `src/lib/prisma.ts` and serialize records before passing them to Client Components.
- `database/` owns the Prisma schema and migrations.
- Run `npm run sync:catalog` after the separate e-catalog product data or brand assets change.

## Verification

For every change run:

```bash
npm run db:generate
npm run typecheck
npm run lint
npm run check
npm run test
npm run build
```

Do not commit `.env`, `.next`, local SQLite databases, reports, screenshots, or secrets.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
