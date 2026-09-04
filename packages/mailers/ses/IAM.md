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
