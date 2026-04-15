# Login Page — API Wiring Plan

Both features implemented. This doc tracks what was done.

---

## 1. Remember Me (Session Persistence)

### Implemented

Better Auth's `/sign-in/username` endpoint natively accepts `rememberMe` in the request body. When `rememberMe === false`, Better Auth creates a browser-session cookie (deleted on close). When `true` (or omitted), the cookie is persistent with the configured 7-day expiry + 1-day rolling refresh.

### Changes

| File | Change |
|------|--------|
| `src/stores/auth.ts` | `login()` now accepts `rememberMe?: boolean`, passes it in the POST body |
| `src/pages/auth/login.tsx` | `handleSignIn` passes `rememberMe` state to `login()` |
| `src/lib/api.ts` | Added `/auth/request-password-reset` and `/auth/reset-password` to the auth endpoint whitelist (for 401 interceptor) |

### Flow

1. User toggles "Remember me" checkbox on login page
2. On submit, `login(username, password, rememberMe)` is called
3. `login()` POSTs to `/api/auth/sign-in/username` with `{ username, password, rememberMe }`
4. Better Auth creates session with appropriate cookie persistence

---

## 2. Forgot Password (Password Reset Flow)

### Implemented

Full password reset flow using Better Auth's built-in `sendResetPassword` / `requestPasswordReset` / `resetPassword` APIs. SMTP is optional — if not configured, emails are skipped with a console warning.

### Changes

| File | Change |
|------|--------|
| `server/lib/email.ts` | **New** — nodemailer transport, `sendEmail()`, `sendPasswordResetEmail()`. SMTP optional via env vars |
| `server/lib/auth.ts` | Added `sendResetPassword` callback + `onPasswordReset` (audit log) to `emailAndPassword` config |
| `server/plugins/auth.ts` | Added `/api/auth/request-password-reset` to rate-limited sign-in paths |
| `src/pages/auth/reset-password.tsx` | **New** — token-based password reset page (reads `?token=` from URL) |
| `src/pages/auth/login.tsx` | Forgot-password form now calls `POST /api/auth/request-password-reset` with `{ email, redirectTo }` |
| `src/App.tsx` | Added `/reset-password` route |
| `src/lib/api.ts` | Added auth endpoint whitelist entries for reset-password flow |
| `src/i18n/locales/en.json` | Added 10 new keys (`auth_reset_invalid_token`, `auth_reset_expired`, `auth_reset_success`, etc.) |
| `.env.example` | Added optional SMTP env vars |

### Flow

1. User clicks "Forgot password" → enters email
2. Frontend POSTs to `/api/auth/request-password-reset` with `{ email, redirectTo }` where `redirectTo` = `${origin}/reset-password`
3. Better Auth generates a verification token, calls `sendResetPassword` callback
4. `sendPasswordResetEmail()` sends an email with a link to `/api/auth/reset-password/TOKEN?callbackURL=REDIRECT`
5. User clicks the link → Better Auth validates the token and redirects to `${REDIRECT}?token=TOKEN` (or `?error=INVALID_TOKEN`)
6. Frontend `/reset-password` page reads token from URL, shows password form
7. On submit, POSTs to `/api/auth/reset-password` with `{ newPassword, token }`
8. Better Auth updates the password, calls `onPasswordReset` callback (creates audit log)
9. Frontend shows success → redirects to login

### SMTP Configuration (optional)

Set these environment variables to enable email delivery:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
EMAIL_FROM="Reparilo <noreply@reparilo.com>"
```

If SMTP is not configured, `sendEmail()` logs a warning and skips sending. The password reset endpoint still returns success (to avoid leaking whether an email exists).