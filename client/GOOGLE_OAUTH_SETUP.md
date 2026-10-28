# Google sign-in setup status

The application now supports Google Identity Services ID-token login through `POST /api/auth/google`. The client renders Google's own button when `VITE_GOOGLE_CLIENT_ID` is present, and demo mode never loads Google Identity Services. The backend verifies ID tokens with Google's Node.js auth library and `GOOGLE_CLIENT_ID`. Google login is limited to accounts already provisioned by an administrator; it links the verified Google subject to that existing account and does not create users.

Before enabling it:

1. Create a **Web application** OAuth client in Google Cloud. `VITE_GOOGLE_CLIENT_ID` is a public client identifier and may be supplied to the frontend; never put the client secret in a `VITE_*` variable.
2. Add the exact deployed frontend origin to the OAuth client's authorized JavaScript origins.
3. Set `GOOGLE_CLIENT_ID` on the Express server to the same OAuth web client ID. It is not a secret, but must match the frontend audience. No redirect URI is used by the GIS popup credential flow; configure the authorized JavaScript origins instead.
4. Deploy the schema migration (`20261024_google_identity`) before enabling Google login. The `googleSubject` column binds a verified Google identity to a pre-provisioned BharatSatya account.
5. Set `VITE_GOOGLE_CLIENT_ID` in the frontend build environment. Never expose a Google client secret in a `VITE_*` value. No client secret is needed for this ID-token verification flow.
6. For local API development, set `VITE_DEMO_MODE=false` in `client/.env.local` and use `http://localhost:5173` as the authorized JavaScript origin. The Vite development proxy forwards `/api` to the local Express server. For deployment, add the exact production frontend origin too.
7. Verify sign-in on each allowed origin and confirm an administrator-provisioned account's email is verified by Google. Closing the Google popup leaves the user signed out; new account signup remains unavailable in API mode.

Official Google sign-in button guidance: https://developers.google.com/identity/branding-guidelines
Official backend verification guidance: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
