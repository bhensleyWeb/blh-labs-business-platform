# Architecture

## Trust boundaries

- The Vite/React browser application only calls `/api`; it never receives Google OAuth client secrets or refresh tokens.
- The Express backend owns authentication, validates request bodies, performs Google API calls, and persists CRM data.
- The administrator session is an HMAC-signed, `HttpOnly`, `SameSite=Lax` cookie. Production cookies are also `Secure`.
- Google OAuth uses a random state cookie to prevent request forgery. Stored Google credentials are encrypted with AES-256-GCM using `TOKEN_ENCRYPTION_KEY`.
- Calendar, Drive, and Docs screens have no demo response layer. They report setup/disconnection until a real Google account has authorized the requested scopes.

## Data and portability

The default persistence adapter is an atomically-written JSON file at `DATA_FILE`. It makes local use and small single-instance deployments simple and portable. Mount `/app/data` as persistent storage when using the Docker image.

For multi-instance or high-volume hosting, keep the API contracts and replace `server/store.ts` with a managed database adapter. Stable client, customer number, and tier IDs avoid coupling the UI to a particular database.

The frontend and backend are served by one Node process in production. Any host that supports Node 22 or Docker, HTTPS, persistent storage, and environment variables can run the application.

## Google scopes

- Calendar: read and create events on the authorized account.
- Drive: browse folders, create client folders, and move generated documents.
- Docs: create and populate proposal documents.

The Drive scope is intentionally broad because the requested product includes a Drive browser. If the product is narrowed to app-created files only, reduce it to `drive.file` before Google verification.
