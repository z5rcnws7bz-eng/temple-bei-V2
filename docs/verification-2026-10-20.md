# Verification status — October 20, 2026

## Completed locally

- 50 Node tests pass, including authorization, account profile isolation, hours, scheduling, directory, availability, newsletter link safety/edit controls, authenticated RPC routing, and expired-session renewal.
- Production Vite build and Sites packaging pass; all five Sites packaging checks pass.
- Real browser check of the shared newsletter editor: uploaded the existing chapter mascot PNG, resized/re-encoded it, saved to an isolated local preview, and verified a decoded 1280-pixel image renders in the article.
- Verified title link, Markdown body link, and pasted URL become HTTPS anchors opening in a new tab with `noopener noreferrer`.
- Extracted newsletter editor/article and link parsing into shared modules; reused the profile image preparation code. Existing site layout remains in place.

## Production database verification passed

- `20261020_newsletter_publish.sql`: immutable author account attribution; admin/author-only edits; officer/admin creation; validated image data; title links; clients cannot read drafts or bypass writes through direct table access.
- `20261020_member_bookings.sql`: member pickup/drop with identity, overlapping booking, capacity, and four-hour drop checks.
- `supabase/tests/newsletter_booking_flows.sql`: rollback-only fixtures test creation/assignment, independent member state reloads, pickup/drop, draft privacy, publication with images/links, non-author denial, and admin override.
- Installed both migrations and ran all seven SQL regression fixtures in the production database; all completed successfully. The final result confirmed shift assignment persistence across independent account state loads, pickup/drop, draft privacy, image/link publication, author-only edits, and admin override.

Production database verification completed after Firefox became available. The newsletter/booking version is deployed. A signed-in production browser walkthrough loaded all nine main navigation pages without workflow errors. The live newsletter editor exposes image uploads and title/body link support.

## Scope of claims

Database state reload tests switch authenticated database identity; they do not simulate entering passwords in the browser. No real member account, newsletter, hour record, or shift has been modified for this batch's local checks. A signed-in production browser walkthrough of all main navigation pages has now passed. No real member password was changed during testing.

## Password recovery and onboarding readiness

- Added Forgot password, email-only reset requests, verified recovery-link reset mode, confirmation of the new password, 12-character minimum, resend cooldown, and actionable email-limit errors.
- Recovery redirects use the existing allowlisted production /login URL.
- Supabase accepted one real recovery-email request to the registered Jace account (HTTP 200). Inbox delivery and a real password replacement were not exercised; the password update request is covered with an isolated mocked recovery session.
- Confirmed in the production Supabase dashboard that custom SMTP is OFF. The default sender is unsuitable for onboarding seven users together: documented shared limit is two auth emails per hour, with recipient restrictions. Configure custom SMTP before treating multi-user email onboarding as ready.
