# Verification status — October 20, 2026

## Completed locally

- 46 Node tests pass, including authorization, account profile isolation, hours, scheduling, directory, availability, newsletter link safety/edit controls, authenticated RPC routing, and expired-session renewal.
- Production Vite build and Sites packaging pass; all five Sites packaging checks pass.
- Real browser check of the shared newsletter editor: uploaded the existing chapter mascot PNG, resized/re-encoded it, saved to an isolated local preview, and verified a decoded 1280-pixel image renders in the article.
- Verified title link, Markdown body link, and pasted URL become HTTPS anchors opening in a new tab with `noopener noreferrer`.
- Extracted newsletter editor/article and link parsing into shared modules; reused the profile image preparation code. Existing site layout remains in place.

## Implemented, production verification pending

- `20261020_newsletter_publish.sql`: immutable author account attribution; admin/author-only edits; officer/admin creation; validated image data; title links; clients cannot read drafts or bypass writes through direct table access.
- `20261020_member_bookings.sql`: member pickup/drop with identity, overlapping booking, capacity, and four-hour drop checks.
- `supabase/tests/newsletter_booking_flows.sql`: rollback-only fixtures test creation/assignment, independent member state reloads, pickup/drop, draft privacy, publication with images/links, non-author denial, and admin override.
- After installing both migrations, run the new fixture and the existing `supabase/tests/*.sql` regression fixtures. These tests must pass before deployment.

Firefox controls were repeatedly interrupted by active tab changes. Neither new migration has been installed, the new SQL fixture has not run, and this batch has not been deployed. Local tests do not establish production end-to-end success. The last live version remains the preceding deployment.

## Scope of claims

Database state reload tests switch authenticated database identity; they do not simulate entering passwords in the browser. No real member account, newsletter, hour record, or shift has been modified for this batch's local checks. A full authenticated production browser walkthrough remains outstanding.
