# Temple BEI Volunteer Hub

Cherry-and-cream React dashboard with a Cloudflare Worker API and Sites D1 database.

## Accounts and access
Sites owns authentication. Individual users sign in with ChatGPT; profiles are created from the trusted dispatch identity headers. The site audience remains owner-private until the owner grants members access in Sites.

The administrator is the identity matching the server-only ADMIN_EMAIL secret. No client-side toggle grants privileges. E-board members first sign into their own account, then unlock chapter management with the shared `bei-eboard` username and the separately delivered password. The server checks its SHA-256 digest on every privileged request. Passwords are held only in page memory, never localStorage. Five failures lock the individual account's e-board attempts for 15 minutes.

## Workflows
- Individual profiles: name, major, year, bio.
- User-owned hour logs, approval status, edits reset to pending, removal/restoration, CSV export.
- Shared shifts with capacity checks, booking conflict prevention and pickup/drop.
- Per-user weekly availability.
- Server-protected e-board hour approvals and returns, shift creation, newsletter drafts/publication.
- Newsletter section for published chapter posts; does not send email.
- Owner-only member listing and disable/enable controls.

## Data
No demo records are imported. Original browser-local sample data is not uploaded or treated as official records. Production migrations are under drizzle/. D1 is bound as DB. No schema changes run during requests.

## Runtime secrets
ADMIN_EMAIL, EBOARD_PASSWORD_SHA256. Configure with Sites environment-variable tools; never commit values.

## Verification
`npm run test:auth`: 12 API/auth/data-isolation tests using SQLite.
`npm run test:sites`: 4 hosting and packaging tests.
`npm run build`: production client and Worker packaging.
Browser verification remains unavailable under the browser service access policy.

## Member directory
Signed-in members can search saved profiles by name, major, and year, then open each profile's current bio and academic details. Directory API responses exclude emails, availability, hour logs, and account-management fields. Disabled members are omitted; member profiles are read from D1 at each open. Members edit their own information under Profile.

## Vercel account access (October 20, 2026)

Vercel uses Supabase email/password authentication. Set `VITE_SUPABASE_URL` to
the project origin (without `/rest/v1/`) and set `VITE_SUPABASE_ANON_KEY` to the
publishable key. `/login` and `/app` are client routes served by the Vercel rewrite.
Email confirmation and invitation links return to `/login`; invitations provide
a password setup form. Production never uses the local simulated accounts or
email verification helper.

Apply `supabase/migrations/20261020_portal_account_access.sql` for the authenticated
account API. This migration was applied to production. Admin roles are assigned
by a trusted operator in Auth app metadata (`portal_role: admin`); email names,
user-editable metadata, and browser identity headers cannot grant admin access.
The account API checks verified membership and serves state, profile, directory,
availability, admin member management, and board reads. Hours, shift mutations,
and newsletter publication still require migration from the Sites Worker; those
unsupported actions return an explicit error instead of pretending to save.

Aganiele Cetoute was invited separately through Supabase Authentication and
assigned the approved admin role. Passwords are chosen by the account owner.
Do not store account passwords or privileged Supabase keys in this repository.

## Directory synchronization

`supabase/migrations/20261020_directory_sync.sql` backfills missing account profiles
and keeps account emails synchronized after registration or account updates.
`portal_directory` joins profiles to existing Supabase Auth accounts by immutable
user ID; disabled accounts and orphaned profiles are excluded. Profile names,
majors, years, and bios come from the saved profile. Directory results omit private
account fields. Accounts with matching names remain separate. The frontend uses
this one authenticated source and refreshes it on entry and tab focus; errors are
shown explicitly instead of falling back to stale data.
