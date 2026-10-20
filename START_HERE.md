# Open Temple BEI in VS Code

This folder contains the latest published source, including login, directory, profiles, newsletters, hours, shifts, and the supplied Temple BEI mascot.

## Run the complete app locally on your Mac

Install Node.js 22.12 or later (Node 24 also works). Extract the ZIP, open the **Temple_BEI_VSCode** folder in VS Code, and open Terminal → New Terminal.

Run these commands one at a time:

```bash
npm install
npm run db:local
npm run dev:local
```

Open the localhost address printed by Wrangler. The site begins at the login screen. Click **Continue to your dashboard**.

The local server uses a test administrator identity (`local-admin@example.test`) so you can work without production sign-in. Its database starts empty and is stored locally under `.wrangler/`. This does not copy, connect to, or modify the live club database. The local wrapper blocks non-localhost requests and must never be deployed as production authentication.

After editing React, CSS, or API files, stop the server with Control+C and rerun `npm run dev:local` to rebuild. For rapid frontend styling with hot reload, `npm run dev` starts Vite, but its API/database routes are not connected; use the full local command for functional testing.

## Where to edit

- `src/App.jsx`: pages, forms, navigation, member directory, login.
- `src/styles.css`: colors, typography, spacing, responsive layouts.
- `src/routing.js`: login and dashboard routing.
- `public/assets/`: logos and images.
- `worker/index.js`: production API and authorization.
- `worker/local.js`: isolated localhost test-identity wrapper.
- `db/schema.ts` and `drizzle/`: database schema and migration history.
- `tests/`: API, security, hosting, and routing checks.

## Checks

```bash
npm run build
npm test
```

For database schema changes, append migrations with `npm run db:generate`, then apply the new migration locally with `npm run db:local`. Do not edit migrations already applied to the live site.

## Live deployment

Editing this download does not automatically update your hosted Site. The existing `.openai/hosting.json` identifies your Site, but publishing still requires an authorized Sites source/deployment workflow.

Production authentication is supplied by Sites. Production `ADMIN_EMAIL` and `EBOARD_PASSWORD_SHA256` values are configured in hosted secrets and are deliberately absent from this ZIP. The local configuration uses a test administrator and does not need either production password.

The export contains source and assets, not production member records, credentials, Git history, node_modules, or build output. Run npm install after extracting.

## Export verification
The production build, all 22 automated checks, and local database migration completed successfully. The full Wrangler development server could not start inside the export environment because its network-interface discovery returned an operating-system error. Full local server startup on your Mac has not been verified here.
