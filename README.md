# BLH Labs Business Platform

A reusable Vite back office for BLH Labs: authenticated CRM, live Google Calendar scheduling, Google Drive browsing and client folders, and proposal creation in Google Docs.

The repository contained only this README before this branch; no production site, route, CRM, or funnel code existed here to modify. The back office is therefore additive and uses its own API boundary.

## What is included

- Persistent CRM with clients, sequential customer numbers, activities, opportunities, service tiers, and configurable brand theme.
- Cedar & Stone Landscaping seeded once as demo customer `#BLH-0001`, `demo@blhlabs.com`, Starter tier, with an explicit `DEMO` flag in the UI and data.
- Backend-owned Google OAuth with encrypted token storage and CSRF state validation.
- Live Calendar event listing/creation, Drive browsing/client-folder creation, and Docs proposal generation. There are no mock Google responses.
- Responsive UI, installable anywhere Node 22 or Docker is available.
- Health endpoint, request validation, atomic local persistence, tests, and production build.

## Local run

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env`.
3. Replace `ADMIN_PASSWORD`, `SESSION_SECRET`, and `TOKEN_ENCRYPTION_KEY`. Both secrets should be different random values of at least 32 characters.
4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:5173` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

The CRM works without Google. Google-backed pages clearly remain disconnected until OAuth is configured.

## Google Cloud configuration

1. Create or select a Google Cloud project.
2. Enable Google Calendar API, Google Drive API, and Google Docs API.
3. Configure the OAuth consent screen. For external/testing apps, add the Workspace account as a test user.
4. Create a **Web application** OAuth client.
5. Add the exact local redirect URI: `http://localhost:8787/api/google/callback`.
6. Fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env`.
7. Restart the development server, sign in, and choose **Settings → Connect Google**.

For production, use `https://YOUR_HOST/api/google/callback` in both Google Cloud and `GOOGLE_REDIRECT_URI`, and set `APP_ORIGIN=https://YOUR_HOST`.

## Validate

```bash
npm run test
npm run build
# or both:
npm run check
```

## Production deployment

### Docker (portable default)

```bash
docker build -t blh-labs-platform .
docker run -p 8787:8787 --env-file .env -e NODE_ENV=production \
  -v blh-data:/app/data blh-labs-platform
```

Point the host at port `8787`, terminate HTTPS at the platform/load balancer, and persist `/app/data`. Do not commit `.env` or `data/platform.json`.

### Node host

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

Set all environment variables in the hosting control panel and attach persistent storage for `DATA_FILE`. The production server serves both `dist/` and `/api`, so no separate static host is required.

## Operational notes

- Change the default development administrator password before any shared or public deployment.
- Back up the file at `DATA_FILE` and keep `TOKEN_ENCRYPTION_KEY` stable; changing that key invalidates stored Google credentials.
- A single persistent instance is supported by the included store. For horizontal scaling, replace `server/store.ts` with a transactional database adapter as described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Add or update tiers through `PUT /api/settings/tiers/:id`; clients reference stable tier IDs.
- Google connection can be revoked from Settings. The backend deletes its stored credentials immediately.
