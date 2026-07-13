# Supabase Auth email templates (Ozer)

Local CLI uses `content_path` in `../config.toml`.

Hosted projects: paste each HTML file into
[Auth → Email Templates](https://supabase.com/dashboard/project/_/auth/templates).
Dashboard templates do **not** pick up these files automatically.

| Template | File | Notes |
|----------|------|--------|
| Confirm sign up | `confirm-email.html` | |
| Invite user | `invite-user.html` | Mostly redundant — Ozer uses custom admin/workspace invite emails. Keep for `inviteUserByEmail`. |
| Magic Link / OTP | `magic-link.html` | Button + `{{ .Token }}` code |
| Change email | `change-email-address.html` | Uses `{{ .Email }}` → `{{ .NewEmail }}` |
| Reset password | `reset-password.html` | |
| Reauthentication | `reauthentication.html` | Code-only (`{{ .Token }}`) |

Buttons use Makerkit’s `/auth/confirm?token_hash=…` links so sessions verify server-side.
`{{ .ConfirmationURL }}` is included as a text fallback.

Ensure Auth **Site URL** points at the app origin that serves `/brand/ozer-wordmark-dark.png`.
