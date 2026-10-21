# Mobile, iPad and security verification — October 21, 2026

Production: https://temple-bei-v2.vercel.app
Implementation commit: af524ef

## Live workflow results

Two disposable chapter-controlled Gmail alias accounts were created through the public Supabase signup API with random credentials. Actual confirmation emails were received and their links opened in the browser. Existing-credential login and application workflows were exercised at 390×844 (phone) and 768×1024 (iPad). These are browser viewport tests, not physical iOS hardware tests. The browser signup password-entry form was not submitted; signup API, actual email confirmation and subsequent browser login were tested.

- Confirmed accounts could log in and appeared in account state/member data. Profile updates persisted to the authenticated account.
- Member hours saved as Pending: 0.25 for phone and 0.5 for iPad. An officer entry of 0.25 was automatically Approved. Database owners matched authenticated account IDs.
- Both officers created a shift and assigned the other test member. Fresh logins/account-state reads showed the correct assignment for each account. Rosters and capacity counts matched.
- Both officers published a newsletter with an uploaded image and clickable HTTPS links. A private draft was absent from the other account's public feed until publication. General-member and fresh iPad views displayed the content and decoded images.
- Other members had no Edit controls; forged non-author edits returned 403. Literal script/HTML attack strings rendered as text without creating script or event-handler elements. External links retained safe rel attributes.
- Database audits attributed shift, booking, newsletter and profile changes to the actual account ID and name.
- An expired-link error remained visible with an existing signed-in session. Cross-tab login changes refreshed displayed identity.

## Security changes and probes

Legacy direct table grants and permissive policies exposed prototype tables independently of guarded portal RPCs. Grants and policies were removed for profiles, hours, shifts, bookings, newsletters and attempts. RLS remains enabled; guarded server RPCs provide application access. Anonymous direct REST probes now return 401 and authenticated direct-table probes return 403.

Legacy profile/availability/directory routes delegate to validated RPCs. Client-supplied IDs and role fields cannot select a different profile or grant admin rights. Self-escalation, cross-account hour edits, non-author newsletter edits, member publishing and non-admin audit access were denied. Spoofed signup metadata did not grant admin access.

Atomic database write throttling limits each authenticated account to 120 changed rows/minute and 1,000/hour. Exceeding the live test quota returned 429 and committed neither the profile change nor its audit record. This limits authenticated write abuse; it is not CAPTCHA or edge-level DDoS defense.

Added enforced CSP, anti-framing, nosniff, HSTS, referrer/permissions policies and no-store caching on login/app routes. Deployed headers were verified and workflows passed under CSP. Account refreshes reject stale responses; mutations reject a displayed-user/session mismatch.

Vite updated to 6.4.5 with patched transitive dependencies. Production dependency audit: zero known vulnerabilities. The full development dependency tree retains four moderate notices involving Drizzle Kit's legacy esbuild chain. The proposed forced downgrade was not applied. Those development servers are not shipped in the static frontend.

## Automated checks

57 Node tests passed, including account isolation and security-header tests. Production build passed. Twelve SQL regression suites passed: admin audit, shift creation, member deletion, directory/title/availability, disabled visibility, hours audit, leadership audit, newsletter/booking flows, profile totals, photo, roster actions and security hardening. The latter checks privileges, private helpers, legacy validation, state access and atomic quotas using rollback fixtures.

## Cleanup and remaining limits

The two QA profiles were archived and disabled, temporary officer access revoked, three test hour rows soft-deleted, and the two test shifts/bookings/newsletters removed. Audit history remains. Both archived accounts' existing tokens were denied portal access with 403. Temporary credential files were deleted. Real member content and balances were unchanged.

No CAPTCHA provider is configured. Supabase leaked-password protection remains disabled. Guarded SECURITY DEFINER RPCs and intentional RPC-only RLS tables produce expected advisor notices. These checks do not establish immunity to bots or attacks; no load or physical-device testing was performed.
