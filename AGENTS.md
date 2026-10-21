# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## User design decisions
- Use the supplied Temple BEI brain-with-weights PNG for the top-right mascot and dedicated login page; keep its full aspect ratio without cropping.
- Provide /login with member, e-board, and admin entry choices; retain Sites-owned ChatGPT authentication and server-enforced roles.
- The root / and /login must show the login landing page even for an authenticated visitor. The dashboard lives at /app; continue/sign-in actions target /app and preserve the selected portal.

- Save member photo, class year, major, and bio to their Supabase account profile; restore them on every sign-in and use the same saved photo in the directory.

- Keep the Temple BEI design while supporting phone and iPad browsers: use a touch-friendly navigation drawer through 1024px, preserve page width, scroll wide data tables inside their panels, and use safe-area spacing and readable form inputs.
