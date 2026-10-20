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
