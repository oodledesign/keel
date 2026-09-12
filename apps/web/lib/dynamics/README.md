# Dynamics 365 / Dataverse (mailing-list sync)

Ozer owns the marketing list. On mailing-list subscribe (and unsubscribe / resubscribe), Ozer **upserts a Dataverse Contact or Lead** and writes marketing-consent flags. Dynamics is **not** the source of truth for email consent.

MVP is **Ozer → Dynamics only**. Live OAuth / Dataverse calls are **not** exercised in CI (client + mapper tests use mocked `fetch`).

## Why Dataverse Web API (not Dynamics Marketing)

Arcanum-style orgs typically already have **Sales / Customer Service Contacts** in Dataverse. Customer Insights – Journeys (Dynamics Marketing) stores consent on a separate consent-point model that varies by environment. The Dataverse Contact (`donotemail` / `donotbulkemail`) is the stable, documented surface and works with an application user.

Token audience is the **environment URL**, not Microsoft Graph:

`POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`  
`scope={environmentUrl}/.default`  
`{environmentUrl}/api/data/v9.2/contacts`

## What Dan pastes in Settings → Integrations → Dynamics 365

Create these in **the customer’s Entra ID + Dataverse environment** (not Ozer’s). Do not commit secrets.

| Settings field              | Where to copy it                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Directory (tenant) ID**   | Entra admin → Microsoft Entra ID → Overview                                                                                          |
| **Environment URL**         | Power Platform admin → Environments → the org → Environment URL, e.g. `https://arcanum.crm11.dynamics.com` (https, no trailing path) |
| **Application (client) ID** | Entra → App registrations → the app → Overview                                                                                       |
| **Client secret**           | App registration → Certificates & secrets → **Value** of a new client secret (shown once). Not the Secret ID.                        |

### Azure app registration

1. Entra ID → **App registrations** → New registration.
2. Name e.g. `Ozer Campaigns (Arcanum)`. Single tenant. **No redirect URI** (client credentials).
3. Certificates & secrets → New client secret → copy the **Value**.
4. API permissions → Add a permission → **Dynamics CRM** → Delegated `user_impersonation`. Admin consent is optional for this app-user path; Dataverse authorization is the application user below.
5. Power Platform admin → Environment → Settings → Users + permissions → **Application users** → New app user.
   - App: the registration from step 1
   - Business unit: root
   - Security role: a role with **Create / Write / Read** on Contact (and Account if company lookup is on; Lead if entity = Lead). A custom “Ozer integration” role is better than System Administrator.

Ozer stores the client secret with **AES-256-GCM** using `TOKEN_ENCRYPTION_KEY` (same key as Bunny / Feedflow / GSC tokens). The secret never returns to the browser.

## Default field mapping (configurable)

| Ozer                | Dataverse Contact (default)                                                   | Dataverse Lead  |
| ------------------- | ----------------------------------------------------------------------------- | --------------- |
| Email               | `emailaddress1`                                                               | `emailaddress1` |
| First name          | `firstname`                                                                   | `firstname`     |
| Last name           | `lastname`                                                                    | `lastname`      |
| Company             | Find/create **Account** by `name`, bind `parentcustomerid_account@odata.bind` | `companyname`   |
| Marketing opted in  | `donotemail = false`, `donotbulkemail = false`                                | same            |
| Marketing opted out | `donotemail = true`, `donotbulkemail = true`                                  | same            |

Optional **extra consent field**: a custom boolean on Contact/Lead (e.g. `new_ozerconsent` or a publisher prefix). Set it in Settings → Integrations → Dynamics 365. Customer Insights option-set fields are **not** auto-mapped — create a boolean if Arcanum needs an explicit flag besides `donotemail`.

Consent modes:

- `donotemail_inverted` (default) — fields starting with `donot` are **false** when the person is emailable.
- `boolean_opt_in` — non-`donot` fields are **true** when subscribed; `donot*` fields still invert.

## Sync behaviour

1. Public form subscribe → Ozer preference (source of truth) → enqueue `workspace_dynamics_sync_jobs`.
2. `after()` on the public submit + cron `GET /api/cron/dynamics-contact-sync` (Bearer `CRON_SECRET`) process due jobs.
3. Dynamics downtime **does not** fail the public form. Jobs retry with backoff (8 attempts). Settings → Retry failed jobs.

Unsubscribe / resubscribe from `/unsubscribe/mailing-list` also enqueue a one-way upsert so Dynamics flags stay aligned with Ozer.

Lookup is `$filter={emailField} eq '…'` then `PATCH` or `POST`. Email is **not** assumed to be an alternate key.

## Future (not in this PR)

Inbound “Contact `donotemail` in Dynamics → pause Ozer preference” is stubbed in `inbound.ts`. Do not treat Dynamics as consent source of truth until that lands with an audit trail.
