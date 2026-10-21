# Development dependency remediation — October 21, 2026

The four moderate npm notices were one vulnerable esbuild 0.18.20 instance and its parent dependency chain: @esbuild-kit/core-utils → @esbuild-kit/esm-loader → drizzle-kit. The advisory is https://github.com/advisories/GHSA-67mh-4wv8-2f99; patched versions start at 0.25.0.

Added a scoped npm override requiring @esbuild-kit/core-utils to use esbuild 0.25.12, the patched version already used by Vite and Drizzle. Removed the obsolete nested esbuild and platform binaries from the lockfile using a clean dependency resolution. Kept existing unrelated locked package versions and Drizzle Kit 0.31.11; did not take npm's suggested breaking downgrade to 0.18.1. A clean npm ci succeeds and npm ls confirms the loader resolves esbuild 0.25.12.

Full npm audit: zero known vulnerabilities, including development dependencies. The loader packages still carry upstream deprecation warnings, which are distinct from security advisories. Keep the scoped override until an upstream supported release removes the legacy dependency chain.

Validation:
- Clean npm ci and npm ls esbuild: successful, no invalid dependencies.
- Full npm audit: zero known vulnerabilities.
- Drizzle loads the real TypeScript config/schema and generates all six SQLite tables in a disposable directory. A second generation correctly reports no schema changes. Original migration history and live databases are unchanged.
- Direct legacy TypeScript loader test imports all six schema exports using the patched dependency.
- All 57 application tests pass.
- All 14 Supabase database regression suites pass with rollback fixtures, covering account access, profiles/photos, hours, rosters, newsletters, availability, audit, waitlists, training and reminder delivery.
- Production build passes. Browser smoke checks render sign-in, signup and reset forms with the updated development server. Local and hosted bundle hashes differ, so byte-for-byte identity is not claimed. No application source was changed.

No application source, schema, role, data, training content or website design changes were required.
