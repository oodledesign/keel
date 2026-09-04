# SES identity admin IAM (custom sending domains)

The Vercel AWS IAM user used by Ozer needs these actions to create and manage
workspace sending domains (`@kit/ses` identity admin + `SendingDomainService`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "OzerSesSendingDomains",
      "Effect": "Allow",
      "Action": [
        "ses:CreateEmailIdentity",
        "ses:GetEmailIdentity",
        "ses:DeleteEmailIdentity",
        "ses:PutEmailIdentityMailFromAttributes",
        "ses:CreateConfigurationSet",
        "ses:GetConfigurationSet",
        "ses:CreateConfigurationSetEventDestination",
        "ses:GetConfigurationSetEventDestinations",
        "ses:PutConfigurationSetTrackingOptions",
        "ses:CreateTenant",
        "ses:DeleteTenant",
        "ses:CreateTenantResourceAssociation",
        "ses:DeleteTenantResourceAssociation",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

Notes:

- **Required for create:** identity create/get/delete, mail-from attributes,
  configuration set create (and get if you add lookups), plus
  `sts:GetCallerIdentity` **or** set `AWS_ACCOUNT_ID`.
- **Tenant actions are optional:** if CreateTenant / tenant association is
  denied, the app soft-fails, stores a null `ses_tenant_name`, and sending
  still works without `X-SES-TENANT` (no per-workspace reputation isolation).
- AccessDenied on CreateEmailIdentity or PutEmailIdentityMailFromAttributes
  remains a hard error with an operator-facing message listing these actions.


## Event destination / open-click tracking (workspace analytics)

Set these on Vercel (Production) so `ensureConfigurationSet` wires analytics:

```bash
# SNS topic that fans out to https://app.ozer.so/api/webhooks/ses
SES_EVENTS_SNS_TOPIC_ARN=arn:aws:sns:eu-west-2:ACCOUNT_ID:ozer-ses-events

# Optional HTTPS custom redirect domain for SES click tracking
# SES_TRACKING_DOMAIN=track.yourdomain.com
```

Console steps if env is unset / IAM cannot create destinations:

1. Create SNS topic (e.g. `ozer-ses-events`) in the SES region.
2. Subscribe HTTPS endpoint `https://app.ozer.so/api/webhooks/ses` (confirm via webhook).
3. On configuration set `ozer-custom-domains` (or `SES_CONFIGURATION_SET`), add event destination → SNS with event types: send, delivery, bounce, complaint, open, click (plus reject / rendering failure / delivery delay optional).
4. Enable open and click tracking on that configuration set (SES rewrites links / injects pixel when the set is used on send).
5. Grant the Vercel IAM user the Create/Get event-destination + Put tracking-options actions above, plus `sns:Publish` on the topic for SES service (usually via SES→SNS console wiring).
