# Google OAuth setup (GLS TV)

Email/password is the **default and primary** auth UI. Google is behind an **admin feature flag** (`oauth_google`, default **off**). Apple Sign-In is **deferred** (Apple Developer paid account not ready) — the UI does not show an Apple button; `oauth_apple` exists in `feature_flags` for later but stays unused in the UI while false.

When Google is enabled in admin **and** Supabase Google is configured, `/auth` shows **Continue with Google** via Supabase `signInWithOAuth`. Buttons work for both sign-in and sign-up (Supabase creates the user if new).

**TV devices keep QR pairing as primary** — OAuth (when enabled) is for phone/desktop `/auth` and the phone pairing page (`/auth/tv-pair`).

## App behavior (already in code)

| Flow | Redirect |
|------|----------|
| Desktop/phone `/auth` | `/auth/callback?next=/profiles` (or safe `?next=` from the URL) |
| Phone TV pair | Returns to `/auth/tv-pair?code=…` after OAuth |
| TV shell | QR first; optional “use email” shows email (+ Google only if admin-enabled) |

Public visibility: `GET /api/auth/oauth-status` → `{ google: boolean }` (no secrets). AuthPanel hides the OAuth section entirely when `google` is false.

Post-login uses a hard navigation to Who’s watching (`/profiles`) so the page does not stick on `/auth` with Message GLS visible.

## 0. Admin: enable Google in the product UI

1. Apply migration `supabase/migrations/20260718220000_oauth_google_feature_flag.sql` (or your usual migrate path).
2. Sign in as an **owner** with MFA (AAL2).
3. Open **Admin → Access** (`/admin/access`) → **Feature kill switches**.
4. Toggle **Enable Google sign-in** (`oauth_google`) to **Enabled**.

Until this is on, users only see email/password — no Google button and no “provider not enabled” noise from a visible OAuth control.

Also configure Supabase Google (below) before enabling the flag in production.

## 1. Supabase Auth

1. Open **Authentication → Providers** in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Enable **Google** (leave Apple off until you intentionally ship Apple later).
3. **Authentication → URL configuration**
   - **Site URL**: production origin (e.g. `https://glstv.site`)
   - **Redirect URLs** allow-list must include:
     - `https://glstv.site/auth/callback`
     - `http://127.0.0.1:3010/auth/callback` (local `npm run dev`)
     - Preview origins if you use Vercel previews (`https://*.vercel.app/auth/callback` if supported, or add each preview URL)

No extra app env vars are required for OAuth beyond existing:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://glstv.site   # used in redirectTo origin
```

## 2. Google Cloud (Web client)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create **OAuth client ID** → application type **Web application**.
3. **Authorized JavaScript origins**: your site (`https://glstv.site`, local `http://127.0.0.1:3010`).
4. **Authorized redirect URIs**: Supabase’s callback only (not the Next.js route):

   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`

   (Shown on the Google provider page in Supabase. Local Supabase: `http://127.0.0.1:54321/auth/v1/callback`.)

5. Copy **Client ID** and **Client Secret** into Supabase → Authentication → Providers → Google.
6. Consent screen: add scopes `openid`, `email`, `profile` (or the Google userinfo equivalents). Brand verification is optional but recommended for production.

Docs: [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)

## 3. Apple Developer (deferred)

Apple Sign-In is **not** offered in the GLS TV UI for now. When you later enable it:

1. Paid Apple Developer account + App ID / Services ID / Key (see [Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)).
2. Enable Apple in Supabase → Providers.
3. Turn on `oauth_apple` in Admin → Access **and** restore the Apple button in `AuthPanel` (currently removed from UI).

## 4. Verify

1. With `oauth_google` **disabled**: `/auth` shows email only (no Google / Apple buttons).
2. Configure Google in Supabase → enable `oauth_google` in Admin → Access.
3. **Continue with Google** → provider consent → land on **Who’s watching** (`/profiles`).
4. New accounts appear under Authentication → Users with the Google identity.
5. On a TV UA / `?tv=1`, confirm QR is still primary.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| No Google button | `oauth_google` feature flag is off (default) |
| “That sign-in option isn’t available yet” | Google disabled or misconfigured in Supabase (flag on, provider off) |
| Redirect error from Google | Wrong redirect URI (must be Supabase `/auth/v1/callback`) |
| Lands on wrong page after OAuth | `next` not allow-listed / unsafe path rejected → defaults to `/profiles` |
