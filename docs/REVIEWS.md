# Customer review moderation — owner decision 2026-10-21

`/reviews` is the sixth authorized CRM section. It has pending, published and rejected views, pagination, thumbs-up approval, thumbs-down rejection and moderation history. Every read and Server Action requires existing CRM administrator access. No customer authentication is added.

`Review` and `ReviewModerationAudit` live only in the CRM PostgreSQL database. Apply additive migration `20261021000000_moderated_reviews` to the intended environment before use. Production migration and deployment were not performed by this local implementation. Rollback should disable the route first and preserve the review/audit tables; dropping them destroys customer history.

The catalogue calls `/api/reviews` through its same-origin proxy. Both projects use the existing `CONTACT_PROXY_SHARED_SECRET` and exact `CONTACT_ALLOWED_ORIGINS`. Signed review requests use the purpose key `${secret}:reviews:${method}:${url.search}`. GET returns a bounded page of approved public fields only; POST validates a published/ready product slug or null, name, text, RU/RO locale, explicit consent and a honeypot, then persists `PENDING`. The existing persistent rate guard protects writes. A stable idempotency key prevents retry duplication; payload mismatch returns 409.

Approval/rejection and an audit record are committed atomically. A version check prevents stale decisions overwriting another administrator. Rejection preserves the row and removes it from subsequent public responses, which use `no-store`. Review text is rendered as plain text. No prices, private audits or internal keys are returned publicly, and no verified-purchase label is inferred from the catalogue's post-application invitation.

Legal controller, retention and publication-consent wording remain **PENDING APPROVAL**. Administrators must not approve private customer data or unapproved medical/scientific claims. No fabricated reviews are included. The catalogue's existing release blockers remain in force.

## Owner-requested local demonstration seed

The owner subsequently authorized 4 public test reviews and 6 additional pending test reviews for manual moderation. All 10 explicitly identify themselves as test data, not real client testimonials. They cover Russian/Romanian, published SKU selections and general reviews. Initial approved examples have a `demo-seed` audit entry; pending examples use the normal administrator buttons.

Commands: `npm run demo:reviews:plan`, `npm run demo:reviews:seed`, `npm run demo:reviews:cleanup`. Set `DATABASE_URL` to the intended isolated local review database first. The seed refuses production, remote hosts, unrelated database names and non-UTF8 encoding. Supported database names are `drnona_reviews` and `drnona_reviews_utf8`. No production data or credentials are used.

Keys `demo-reviews-v1-01` through `demo-reviews-v1-10` make the seed idempotent: running it again preserves existing records and administrator decisions. Cleanup removes only these exact fixture keys and their audits; it is an explicit separate command. It does not remove visitor reviews.

Current local preview uses the separate UTF8 database `drnona_reviews_utf8` on loopback port 55439. The former WIN1251 QA database was preserved. The catalogue refreshes approved reviews every 3 seconds while visible and immediately on focus/visibility return, including previously opened pages. Rejection removes an already published example on the next automatic read. Draft form text and the selected filter survive refreshes.
