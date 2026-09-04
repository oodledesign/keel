/**
 * IAM actions the Vercel AWS user needs for custom sending-domain setup.
 *
 * See packages/mailers/ses/IAM.md for the full policy JSON.
 *
 * Tenant actions (CreateTenant / associations) are optional for basic sending;
 * without them the app soft-fails and stores a null tenant (no X-SES-TENANT).
 * Set AWS_ACCOUNT_ID to skip sts:GetCallerIdentity.
 */
export const SES_IDENTITY_ADMIN_IAM_ACTIONS = [
  'ses:CreateEmailIdentity',
  'ses:GetEmailIdentity',
  'ses:DeleteEmailIdentity',
  'ses:PutEmailIdentityMailFromAttributes',
  'ses:CreateConfigurationSet',
  'ses:GetConfigurationSet',
  'ses:CreateConfigurationSetEventDestination',
  'ses:GetConfigurationSetEventDestinations',
  'ses:PutConfigurationSetTrackingOptions',
  'ses:CreateTenant',
  'ses:DeleteTenant',
  'ses:CreateTenantResourceAssociation',
  'ses:DeleteTenantResourceAssociation',
  'sts:GetCallerIdentity',
] as const;

export function sesAccessDeniedUserMessage() {
  return (
    'The Vercel AWS IAM user is missing SES identity permissions required to create sending domains. ' +
    `Allow: ${SES_IDENTITY_ADMIN_IAM_ACTIONS.join(', ')}. ` +
    'Optionally set AWS_ACCOUNT_ID to skip sts:GetCallerIdentity. ' +
    'Tenant permissions are optional; without them domains still send but without X-SES-TENANT reputation isolation.'
  );
}

export function isSesAccessDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as {
    name?: string;
    Code?: string;
    code?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };

  const name = err.name ?? err.Code ?? err.code ?? '';
  if (
    name === 'AccessDeniedException' ||
    name === 'AccessDenied' ||
    name === 'UnauthorizedException' ||
    name === 'UnauthorizedOperation'
  ) {
    return true;
  }

  if (err.$metadata?.httpStatusCode === 403) {
    return true;
  }

  const message = err.message ?? '';
  return /access denied|not authorized|is not authorized to perform|unauthorized/i.test(
    message,
  );
}

/**
 * Map SES/STS AccessDenied (and similar) into a clear operator-facing Error.
 * Non-authorization errors are returned unchanged (or wrapped if non-Error).
 */
export function mapSesIdentityAdminError(error: unknown): Error {
  if (isSesAccessDeniedError(error)) {
    const mapped = new Error(sesAccessDeniedUserMessage());
    mapped.name = 'SesAccessDeniedError';
    mapped.cause = error;
    return mapped;
  }

  return error instanceof Error ? error : new Error(String(error));
}
