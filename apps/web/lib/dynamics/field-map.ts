import {
  DATAVERSE_LOGICAL_NAME,
  type DynamicsEntity,
  type DynamicsFieldMapping,
  type DynamicsSubscriber,
} from './types';

export const DEFAULT_CONTACT_CONSENT_FIELDS = [
  'donotemail',
  'donotbulkemail',
] as const;

export function defaultDynamicsFieldMapping(
  entity: DynamicsEntity = 'contact',
): DynamicsFieldMapping {
  if (entity === 'lead') {
    return {
      email: 'emailaddress1',
      firstName: 'firstname',
      lastName: 'lastname',
      company: 'companyname',
      companyStrategy: 'contact_field',
      consentMode: 'donotemail_inverted',
      consentFields: [...DEFAULT_CONTACT_CONSENT_FIELDS],
      extraConsentField: null,
    };
  }

  return {
    email: 'emailaddress1',
    firstName: 'firstname',
    lastName: 'lastname',
    company: null,
    companyStrategy: 'account_lookup',
    consentMode: 'donotemail_inverted',
    consentFields: [...DEFAULT_CONTACT_CONSENT_FIELDS],
    extraConsentField: null,
  };
}

export function splitPersonName(name: string): {
  firstName: string;
  lastName: string | null;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Contact', lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(' '),
  };
}

export function assertDataverseLogicalName(value: string, label: string) {
  if (!DATAVERSE_LOGICAL_NAME.test(value)) {
    throw new Error(
      `${label} must be a Dataverse logical name (letters, digits, underscore)`,
    );
  }
}

export function normalizeDynamicsFieldMapping(
  raw: unknown,
  entity: DynamicsEntity,
): DynamicsFieldMapping {
  const fallback = defaultDynamicsFieldMapping(entity);
  if (!raw || typeof raw !== 'object') return fallback;

  const row = raw as Record<string, unknown>;
  const email = readLogical(row.email, fallback.email);
  const firstName = readLogical(row.firstName, fallback.firstName);
  const lastName = readLogical(row.lastName, fallback.lastName);
  const companyRaw =
    typeof row.company === 'string' ? row.company.trim() : null;
  const company =
    companyRaw && DATAVERSE_LOGICAL_NAME.test(companyRaw) ? companyRaw : null;
  const companyStrategy =
    row.companyStrategy === 'contact_field' ||
    row.companyStrategy === 'none' ||
    row.companyStrategy === 'account_lookup'
      ? row.companyStrategy
      : fallback.companyStrategy;
  const consentMode =
    row.consentMode === 'boolean_opt_in' ||
    row.consentMode === 'donotemail_inverted'
      ? row.consentMode
      : fallback.consentMode;
  const consentFields = Array.isArray(row.consentFields)
    ? row.consentFields
        .filter(
          (field): field is string =>
            typeof field === 'string' && DATAVERSE_LOGICAL_NAME.test(field),
        )
        .slice(0, 8)
    : fallback.consentFields;
  const extraRaw =
    typeof row.extraConsentField === 'string'
      ? row.extraConsentField.trim()
      : null;
  const extraConsentField =
    extraRaw && DATAVERSE_LOGICAL_NAME.test(extraRaw) ? extraRaw : null;

  return {
    email,
    firstName,
    lastName,
    company:
      companyStrategy === 'contact_field'
        ? (company ?? (entity === 'lead' ? 'companyname' : null))
        : company,
    companyStrategy,
    consentMode,
    consentFields:
      consentFields.length > 0 ? consentFields : fallback.consentFields,
    extraConsentField,
  };
}

function readLogical(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return DATAVERSE_LOGICAL_NAME.test(trimmed) ? trimmed : fallback;
}

export function validateDynamicsFieldMapping(mapping: DynamicsFieldMapping) {
  assertDataverseLogicalName(mapping.email, 'Email field');
  assertDataverseLogicalName(mapping.firstName, 'First name field');
  assertDataverseLogicalName(mapping.lastName, 'Last name field');
  if (mapping.company) {
    assertDataverseLogicalName(mapping.company, 'Company field');
  }
  if (mapping.companyStrategy === 'contact_field' && !mapping.company) {
    throw new Error(
      'Company field is required when mapping company onto the record',
    );
  }
  for (const field of mapping.consentFields) {
    assertDataverseLogicalName(field, 'Consent field');
  }
  if (mapping.extraConsentField) {
    assertDataverseLogicalName(
      mapping.extraConsentField,
      'Extra consent field',
    );
  }
}

/**
 * Dataverse navigation bind for linking a Contact/Lead to an Account.
 * Contact uses the Customer lookup; Lead uses parentaccountid.
 */
export function accountBindAttribute(entity: DynamicsEntity): string {
  return entity === 'lead'
    ? 'parentaccountid@odata.bind'
    : 'parentcustomerid_account@odata.bind';
}

/**
 * Build a Dataverse create/update body. Company Account bind is applied
 * separately via `accountBindAttribute` when strategy is account_lookup.
 */
export function buildDataverseAttributes(
  mapping: DynamicsFieldMapping,
  subscriber: DynamicsSubscriber,
): Record<string, unknown> {
  validateDynamicsFieldMapping(mapping);

  const attributes: Record<string, unknown> = {
    [mapping.email]: subscriber.email,
    [mapping.firstName]: subscriber.firstName,
  };

  if (subscriber.lastName) {
    attributes[mapping.lastName] = subscriber.lastName;
  }

  if (
    mapping.companyStrategy === 'contact_field' &&
    mapping.company &&
    subscriber.companyName
  ) {
    attributes[mapping.company] = subscriber.companyName;
  }

  Object.assign(
    attributes,
    consentAttributes(mapping, subscriber.marketingOptedIn),
  );

  return attributes;
}

export function consentAttributes(
  mapping: DynamicsFieldMapping,
  marketingOptedIn: boolean,
): Record<string, boolean> {
  const attributes: Record<string, boolean> = {};

  for (const field of mapping.consentFields) {
    attributes[field] = consentValueForField(
      field,
      mapping.consentMode,
      marketingOptedIn,
    );
  }

  if (mapping.extraConsentField) {
    attributes[mapping.extraConsentField] = marketingOptedIn;
  }

  return attributes;
}

function consentValueForField(
  field: string,
  mode: DynamicsFieldMapping['consentMode'],
  marketingOptedIn: boolean,
): boolean {
  const inverted = field.toLowerCase().startsWith('donot');
  if (mode === 'donotemail_inverted' || inverted) {
    return !marketingOptedIn;
  }
  return marketingOptedIn;
}

export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

export function normalizeDynamicsEnvironmentUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      'Environment URL must be an https Dataverse address, e.g. https://org.crm11.dynamics.com',
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Environment URL must use https');
  }

  return `${parsed.protocol}//${parsed.host}`;
}

export function dataverseApiRoot(environmentUrl: string): string {
  return `${normalizeDynamicsEnvironmentUrl(environmentUrl)}/api/data/v9.2`;
}

export function dataverseTokenScope(environmentUrl: string): string {
  return `${normalizeDynamicsEnvironmentUrl(environmentUrl)}/.default`;
}

export function entitySetName(entity: DynamicsEntity): string {
  return entity === 'lead' ? 'leads' : 'contacts';
}

export function entityIdField(entity: DynamicsEntity): string {
  return entity === 'lead' ? 'leadid' : 'contactid';
}

export function parseDataverseEntityId(
  entityIdHeader: string | null,
  fallback?: string | null,
): string | null {
  if (fallback?.trim()) return fallback.trim();
  if (!entityIdHeader) return null;
  const match = entityIdHeader.match(/\(([^)]+)\)\s*$/);
  return match?.[1] ?? null;
}
