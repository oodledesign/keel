export type ExistingClientSnapshot = {
  id: string;
  displayName: string;
  email: string | null;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  clientType: string | null;
};

export type ClientImportDraft = {
  rowIndex: number;
  clientType: 'individual' | 'business';
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  contact: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
  } | null;
  errors: string[];
};

export type ClientDuplicateMatch = {
  rowIndex: number;
  existing: ExistingClientSnapshot;
  matchReason: 'email' | 'company_name' | 'name_email';
  suggestedAction: 'keep';
};

export function normalizeImportEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function normalizeImportName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function inferClientType(raw: {
  clientType?: string | null;
  companyName?: string | null;
  firstName?: string | null;
}): 'individual' | 'business' {
  const type = (raw.clientType ?? '').trim().toLowerCase();
  if (
    type === 'individual' ||
    type === 'person' ||
    type === 'personal' ||
    type === 'contact'
  ) {
    return 'individual';
  }
  if (
    type === 'business' ||
    type === 'company' ||
    type === 'organisation' ||
    type === 'organization' ||
    type === 'org'
  ) {
    return 'business';
  }
  if (raw.companyName?.trim()) return 'business';
  if (raw.firstName?.trim()) return 'individual';
  return 'business';
}

export function validateClientImportDraft(
  draft: Omit<ClientImportDraft, 'errors'>,
): string[] {
  const errors: string[] = [];
  if (draft.clientType === 'business') {
    if (!draft.companyName?.trim()) {
      errors.push('Company name is required for business clients');
    }
  } else if (!draft.firstName?.trim()) {
    errors.push('First name is required for individual clients');
  }

  const email = draft.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email');
  }

  const contactEmail = draft.contact?.email?.trim();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.push('Invalid contact email');
  }

  return errors;
}

export function findClientDuplicate(
  draft: ClientImportDraft,
  existing: ExistingClientSnapshot[],
): ClientDuplicateMatch | null {
  const email = normalizeImportEmail(draft.email);
  if (email) {
    const byEmail = existing.find(
      (c) => normalizeImportEmail(c.email) === email,
    );
    if (byEmail) {
      return {
        rowIndex: draft.rowIndex,
        existing: byEmail,
        matchReason: 'email',
        suggestedAction: 'keep',
      };
    }
  }

  if (draft.clientType === 'business') {
    const company = normalizeImportName(draft.companyName);
    if (company) {
      const byCompany = existing.find(
        (c) => normalizeImportName(c.companyName) === company,
      );
      if (byCompany) {
        return {
          rowIndex: draft.rowIndex,
          existing: byCompany,
          matchReason: 'company_name',
          suggestedAction: 'keep',
        };
      }
    }
  }

  if (draft.clientType === 'individual' && email) {
    const first = normalizeImportName(draft.firstName);
    const last = normalizeImportName(draft.lastName);
    const byNameEmail = existing.find(
      (c) =>
        normalizeImportEmail(c.email) === email &&
        normalizeImportName(c.firstName) === first &&
        normalizeImportName(c.lastName) === last,
    );
    if (byNameEmail) {
      return {
        rowIndex: draft.rowIndex,
        existing: byNameEmail,
        matchReason: 'name_email',
        suggestedAction: 'keep',
      };
    }
  }

  return null;
}

export function mapNameToId(
  name: string | null | undefined,
  rows: Array<{ id: string; name: string }>,
): string | null {
  if (!name?.trim()) return null;
  const t = name.trim().toLowerCase();
  const exactMatches = rows.filter(
    (r) => r.name.trim().toLowerCase() === t,
  );
  if (exactMatches.length === 1) return exactMatches[0]!.id;
  return null;
}
