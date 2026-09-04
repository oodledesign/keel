# Workspace email analytics (SES)

Tracks delivery / bounce / complaint / open / click for:

- Workspace campaigns (`workspace_email_campaigns`)
- Commercial circulation (`commercial_circulation_*`)

Uses the SES configuration set already attached to custom sending domains
(`ozer-custom-domains` / `SES_CONFIGURATION_SET`), **not** admin Zeptomail
(`email_events` / `/api/webhooks/zeptomail` / `/api/track/*`).

## Pipeline

1. Sends include `ConfigurationSetName` / `X-SES-CONFIGURATION-SET`.
2. SES publishes events to SNS (`SES_EVENTS_SNS_TOPIC_ARN`).
3. SNS HTTPS subscription hits `/api/webhooks/ses` (signature verified).
4. Events are stored in `workspace_email_events` and denormalized onto
   recipient + campaign/send summary columns.

## Env (Vercel)

```bash
SES_EVENTS_SNS_TOPIC_ARN=arn:aws:sns:REGION:ACCOUNT:ozer-ses-events
# optional custom click domain
# SES_TRACKING_DOMAIN=track.example.com
```

`ensureConfigurationSet` attaches the SNS destination when the ARN is set.

## Day-one vs later

| Event | Day-one once SNS wired |
|-------|-------------------------|
| send, delivery, bounce, complaint | Yes |
| open, click | Yes if config set has open/click tracking enabled |
| reject / rendering_failure / delivery_delay | Logged only |

Local: `SES_SNS_SKIP_VERIFY=1` skips SNS signature checks (never in production).
