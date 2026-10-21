# PHP advisory applicability — October 21, 2026

Reviewed the PHP maintainers' critical remote-code-execution advisories:
- https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w
- https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp

They concern PHP runtime vulnerabilities, with complete fixes in PHP 8.2.35, 8.3.36, 8.4.27 and 8.5.12. They do not mean every organization or every website is affected. Where an affected PHP runtime exists, upgrading to a patched runtime and restarting workers is required; rewriting application code alone is not a replacement.

The Temple BEI application repository contains no PHP source or Composer manifests. Its deployment configuration is Vite/static assets on Vercel, with React/JavaScript frontend code. Database logic is Postgres SQL/PLpgSQL on Supabase, and the reminder function uses TypeScript/Deno. No PHP runtime is configured in this application's deployment. Therefore no application PHP upgrade or language migration is indicated by these advisories. This conclusion concerns the configured application stack; provider-internal infrastructure and unrelated organization systems were not inspected.

Current npm production dependency audit: zero known vulnerabilities. Full development dependency audit: four moderate notices in the Drizzle Kit/esbuild toolchain. The suggested fix is a breaking downgrade and was not applied; these development servers are not deployed as the production website. Dependency audits do not establish immunity to attacks.

Existing protections remain: restricted database table grants, server-side account/role/ownership checks, immutable admin audit history, account write throttling, safe newsletter rendering/links, CSP, anti-framing, nosniff, HSTS and secret isolation. CAPTCHA remains disabled by the user's prior instruction. No exploit attempts or penetration test were performed.

For organization-wide readiness, maintain MFA on GitHub/Vercel/Supabase/Google, verify backup and restore procedures, review security alerts and access logs, and rotate credentials exposed outside their intended secret stores. These operational items were not silently changed or claimed complete by this review.

The requested slideshow change removes only the middle slide selector. Previous/Next controls, first/last boundary disabling, keyboard navigation, slide text and downloads remain. Browser checks confirmed Next moves to slide 2, Previous returns to slide 1, and no select element remains in the controls.
