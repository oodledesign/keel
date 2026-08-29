# Amazon SES for commercial circulation

Ozer uses **ZeptoMail** for transactional email and **Amazon SES** for commercial circulation (matching-opportunity blasts).

## Env vars

```bash
# Already used for other AWS features; SES reuses these
AWS_REGION=eu-west-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Optional override if SES region differs from AWS_REGION
# SES_REGION=eu-west-2

# HMAC secret for circulation unsubscribe tokens (required in production)
CIRCULATION_UNSUBSCRIBE_SECRET=

NEXT_PUBLIC_SITE_URL=https://app.ozer.so
```

IAM user needs at least `ses:SendRawEmail` (and typically `ses:SendEmail`) on the sending identity.

## Production access retry checklist

SES sandbox only delivers to verified emails. For production:

1. Public company/product website (not behind auth, bot blocks, or empty holding page).
2. Application use case text, e.g.  
   *“UK B2B commercial property applicants who registered requirements with an agency workspace; every email includes unsubscribe; no purchased lists.”*
3. Live privacy policy URL and unsubscribe URL (`/unsubscribe/circulation`).
4. Sample circulation email content (agency brand, matching opportunity only).
5. Sending domain verified (SPF + DKIM) before or during the request.
6. Start with sandbox verified recipients, then request production access.

## Domain auth (per agency)

1. Verify the agency domain (or subdomain) in SES.
2. Publish DKIM CNAMEs / SPF as instructed by SES.
3. Use that domain in the Circulate dialog **From email**.

## Code entry points

| Concern | Path |
|---------|------|
| SES raw mailer (+ List-Unsubscribe) | `packages/mailers/ses` |
| Force SES for circulation | `apps/web/lib/commercial/circulation/circulation.service.ts` → `sendCirculationEmailViaSes` |
| Workspace-branded HTML | `apps/web/lib/commercial/circulation/circulation-email.ts` |
| Circulate action | `apps/web/app/home/[account]/listings/_lib/server/circulation-actions.ts` |
| Auto-circulate cron | `apps/web/app/api/cron/commercial-match-digest` → `runCommercialAutoCirculation` |
| Bounce/complaint (future) | Mirror Zepto webhook pattern into `commercial_marketing_preferences.marketing_status = suppressed` |

Do **not** route circulation through `getMailer()` while `ZEPTOMAIL_TOKEN` is set — that prefers Zepto and violates Zepto’s marketing ToS.
