# Coverage, waitlists, reminders and training

## Behavior

Scheduling shows upcoming shift count, open spots, full shifts and waitlist entries. Members can join or leave a full future shift's waitlist. A released spot is assigned to the first active, confirmed waiting member without a conflicting assignment. Ineligible/conflicting members remain waiting. Shift row locks serialize capacity changes; member advisory locks protect against overlapping assignments. A five-minute scheduled retry handles promotions skipped due to a concurrent member lock.

Admins and E-board can cancel a shift with confirmation. Cancellation closes booking, removes assignments and the waitlist, and saves notices for affected members. Assignment additions/removals create notices automatically. A database job creates deduplicated upcoming-shift reminders within 24 hours and again within 2 hours of start; it runs every five minutes, even when nobody is logged in. Manual reminders are limited to one per shift/member/hour.

Notifications are visible only to the owning active account. Read status persists. Notices are queued for email and display delivery status. The SMTP sender is the chapter Gmail account. Supabase Edge Function secret PORTAL_SMTP_PASSWORD is required separately from Auth SMTP. No secret is bundled into the frontend. Missing credentials leave messages queued and return 503. The private scheduler key is stored in Vault; the worker authenticates it in a service-role-only RPC. Queue claiming uses SKIP LOCKED, leases, bounded retries and attempt-aware acknowledgements. SMTP is at-least-once delivery: a crash after SMTP acceptance but before acknowledgement may cause a duplicate despite a stable Message-ID.

Training is visible to members. Leadership can publish HTTPS resources and instructions, edit to create a new version, or archive. Completion is self-reported, saved only for the authenticated member, and tied to the version read. Editing requires members to complete the updated version. Completion does not grant permissions or certify qualifications. Leadership sees saved completion records; other members do not.

New records and updates are captured by the existing immutable admin-only audit ledger, with actor ID/name and before/after data. Member filtering includes waitlist, notification and training progress owners. Background changes are identified as database/system operations. New tables have RLS and no direct client grants; guarded RPCs are the public interface.

Jania King (registered account tut37872@temple.edu) now has the Newsletter Chair title. This title uses a blue badge on the profile, directory, member details and admin member list. Existing E-board access is unchanged.

## Verification — October 21, 2026

- 57 Node tests and production build passed.
- All 12 prior database regression suites passed, plus new coverage/training and reminder-delivery suites (14 total).
- New database checks cover ownership, duplicate waitlist prevention, capacity, automatic promotion, cancellation, member/leadership authorization, training versions, audit records, scheduled reminder deduplication, worker authentication, queue retry and stale acknowledgement protection. Fixtures roll back.
- Production-build preview at 390×844 and 768×1024 used two disposable real Auth accounts with temporary officer access for one. Test users were confirmed for the fixture through the database; this was not an email-confirmation-flow test.
- On phone: officer published a required training resource, member joined the full shift waitlist, saved completion, and was denied editing controls. After the officer dropped the shift, the database promoted the member.
- On iPad: fresh page load showed the promoted assignment under the correct account, the saved training completion, account-owned assignment notice, and persisted read state. Officer cancelled the shift and the roster was removed. Database records and audit actor IDs matched the two test accounts. A real concurrent API race for the last slot produced exactly one successful booking. Anonymous invocation of the email worker returned 401.
- Jania's directory card and profile showed Newsletter Chair with the expected blue badge. Measured page widths had no horizontal overflow at the tested phone and iPad sizes.
- Physical device and load tests were not performed. The SMTP secret was subsequently configured and an actual delivery test passed: worker HTTP 200, sent=1, failed=0, first attempt, database delivery status sent. The test was addressed to the chapter Gmail inbox through its controlled coverage-member alias. Inbox receipt is not independently confirmed. The temporary account was archived/disabled again; test notice and audit history remain. Both background schedules are active.


## Automatic email verification — October 21, 2026

The chapter confirmed receiving the initial SMTP delivery test. Live follow-up used two chapter-controlled Gmail aliases and temporary shifts assigned through the protected roster RPC. Assignment emails were sent by the normal minute-by-minute delivery job. A roster removal generated a cancellation email, and reassignment generated a fresh assignment email. At 6:10 PM Eastern, the normal five-minute reminder job generated both the 24-hour-window and 2-hour-window reminders, and the normal delivery job sent each to the matching account. Each delivery succeeded on its first attempt.

Hardened delivery auditing to retain the exact destination address and SMTP-accepted timestamp in notification records and their append-only audit snapshots. Existing deliveries preceding these columns are intentionally not backfilled with invented addresses or timestamps. Fixed stale-queue handling so upcoming reminders are suppressed once their shift has started. The regression test verifies suppression, exact recipients, timestamps, worker authorization, retry behavior and stale acknowledgement protection. All 14 database suites pass after these changes. These database fixes are already installed live; no frontend changes or Vercel rebuild are required.

Full-shift cancellation was then tested for both accounts. Both cancellation emails were sent by the normal job at 6:12 PM Eastern. Across the live test, eight emails were sent on their first attempt; six created after the audit enhancement include exact recipient and sent timestamp in the audit ledger. Zero recipient mismatches were found. Temporary shifts were removed and both test profiles archived/disabled again. Delivery and audit records remain. The member-facing website did not require a rebuild for these database-only fixes.
