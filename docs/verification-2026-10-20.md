# Verification status — October 20, 2026

## Completed locally

- 51 Node tests pass, including authorization, account profile isolation, hours, scheduling, directory, availability, newsletter link safety/edit controls, authenticated RPC routing, and expired-session renewal.
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

## Approved hour credits and profile totals

- Added an idempotent historical approved credit of 97.85 hours to Aganiele's confirmed account and 115.65 hours to Jace's account. Each credit generated one hours audit record.
- Existing approved entries were retained: Aganiele had 1.00 hour, yielding 98.85 approved hours; Jace had 1.50 hours, yielding 117.15 approved hours at verification time.
- Personal profile totals use the same ledger as Overview; directory/profile-detail totals sum nonremoved approved records in Supabase. The hours table now preserves two decimal places rather than rounding to one.
- The production rollback-only fixture confirmed a new 1.25-hour officer submission adds to a 97.85-hour historical balance and that directory, profile, Overview state, and removed-entry totals agree.

## Gmail SMTP verification — October 21, 2026

- Verified custom SMTP is ON in the production dashboard, with sender/username templeuni.bei@gmail.com, host smtp.gmail.com and port 465. No credential was read or stored in source.
- Verified saved limits: 30 auth emails/hour, 30 signup/sign-in requests per five minutes per IP, and a 60-second minimum interval between messages to the same user.
- Live Auth settings endpoint confirmed signup enabled, email provider enabled, and email confirmation required.
- Sent one authorized recovery request to the registered Jace account at 2026-10-21 04:03:19 UTC (October 21, 12:03 AM Eastern). Auth returned HTTP 200; the auth log recorded user_recovery_requested and request completed with status 200.
- A rollback-only database test initialized seven confirmed member identities and verified each account's state/profile ID and ordinary-member privileges. No test users were retained and no seven-email signup burst was sent.
- Seven signup confirmations fit within the configured limits. The user confirmed receipt of the test email at the registered Jace inbox. Seven complete signup/email-confirmation flows and spam placement across the members' mailboxes have not been exercised; the configured limits permit the seven-member onboarding group.
- SMTP is a live Supabase configuration change; no frontend deployment is required for it to take effect.

## Real new-member onboarding — October 21, 2026

- Created one labeled QA member through the public production Auth signup endpoint, using the same email/password/name payload and production /login redirect as the website. This was a real signup, not an admin-confirmed database fixture.
- Signup returned HTTP 200 and required email confirmation. A password sign-in before confirmation correctly failed with Email not confirmed.
- Received the actual confirmation email in the chapter Gmail inbox for the authorized plus-address alias. Clicked its confirmation link; the production callback opened the ordinary member dashboard successfully without admin/eboard privileges.
- In the production browser, saved major, class year, bio, Monday 14:00–17:00 availability, and a clearly labeled 0.25-hour QA entry. The entry correctly remained Pending. Verified the directory matched the saved profile and showed zero approved hours.
- Signed out, signed in again through the Member login form, and verified profile fields, availability, and pending hours in the production UI. Also verified the same stored values through authenticated RPCs and a direct database read. Hours insertion produced an audit record.
- Soft-removed the test hours through the normal member RPC and disabled the test profile reversibly. It no longer appears in the member directory or contributes active hours; both insertion/removal audit records remain. Real members and their balances were unchanged.
- No application defects were found in this flow; no implementation changes were needed. All 51 automated tests and the production build passed again. This verifies one complete email-confirmation onboarding flow, not seven simultaneous inbox deliveries. Earlier SMTP-off and untested-delivery observations above describe the initial state and are superseded by the October 21 verification sections.

## Disabled member visibility and restoration — October 21, 2026

- Disabled, nondeleted accounts remain in the signed-in directory and profile detail with a pale red tint and an explicit Disabled label. Deleted/archived accounts remain excluded.
- Admin and E-board member-access controls show Re-enable for disabled accounts. E-board access uses a narrow server-checked toggle; role grants and deletion remain admin-only, officers cannot change administrator access, and self-disable is rejected.
- The new rollback-only production database regression verified both leadership roles can disable/re-enable permitted targets, disabled portal access is denied, re-enabled portal access is restored, directory/detail flags change, and archived accounts cannot be restored through this control.
- All 52 automated tests and the production build passed. Security advisor review found no anonymous exposure on the new RPC; authenticated execution is intentional and guarded by current database roles/status. Existing unrelated handle_new_user advisor notices remain outside this change.

## Leadership identity and activity history — October 21, 2026

- Both leadership banners use the currently authenticated user's name, with their email as fallback. The production account identity comes from the server's state RPC. A Jace session correctly displays Jace; it is not a shared officer identity.
- Existing hour_audit already records actual actor UUID/name/role and before/after values for hour creation, editing, approval, removal and restoration.
- Added private portal_activity_audit with database triggers for profiles (including E-board grants, suspension, profile and availability), shifts, bookings/assignments, and newsletters. Records include actor UUID/name/email/current role, timestamp, operation, resource and before/after values. Database operations without a user JWT are explicitly marked database, not attributed to Jace.
- Audit history has no cascading account foreign keys; website roles cannot select, insert, edit or delete it. Database project administrators can review it in Supabase. It starts with this migration; no past events were reconstructed or invented.
- Image changes retain fingerprints rather than copying image payloads into audit history.
- Rollback-only tests used two officer identities and a member, attempted forged Jace attribution, and verified actor separation, access changes, shifts, assignments, newsletter publication/deletion, profile/availability changes, role grants and audit restrictions. Existing hours, newsletter/booking and disabled-account database regressions passed. All 52 automated tests and the production build passed.

## Admin audit log interface — October 21, 2026

- Added an Audit log section to the Admin page, combining hours and management history. Shows actor name/account, role, action, resource, Eastern timestamp, and expandable before/after fields with stable actor and resource IDs.
- Member filtering matches either the actor or the affected profile/hour/assignment owner. Added action and inclusive Eastern date filters, Clear, Refresh, and 25-event pagination. Deleted/retained profiles remain available in the member selector.
- The read-only portal_admin_audit RPC checks a current, confirmed, active administrator in the database on every request. Website/table grants remain unchanged; no direct audit-table access was granted.
- Production rollback-only tests passed admin reads; anonymous, member, E-board, and disabled-admin denial; unified hour entries; actor/affected-member filtering; action filters; Eastern daylight-saving date boundaries; pagination and invalid date rejection.
- All 55 automated tests and the production build passed. Browser-tested the actual shared AuditLog component with labeled local sample records, including member/action filtering and expanded before/after details. New audit RPC security-definer execution is intentional and server-authorized.
