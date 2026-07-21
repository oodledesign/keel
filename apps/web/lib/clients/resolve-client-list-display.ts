export function clientPersonName(client: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return [client.first_name, client.last_name].filter(Boolean).join(' ').trim();
}

export function resolveStoredClientDisplayName(params: {
  clientType: 'individual' | 'business';
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  const person = [params.firstName, params.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (params.clientType === 'individual') {
    return person || params.firstName?.trim() || 'Unnamed';
  }

  return (
    params.companyName?.trim() || person || 'Unnamed company'
  );
}

/** Title shown in the clients list and cards. */
export function resolveClientListTitle(client: {
  client_type?: string | null;
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const company = client.company_name?.trim();
  const person = clientPersonName(client);
  const stored = client.display_name?.trim();

  if (client.client_type === 'business') {
    return company || stored || person || 'Unnamed client';
  }

  return stored || person || company || 'Unnamed client';
}

/** Secondary line under the client title in list/card views. */
export function resolveClientListTagline(client: {
  client_type?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  city?: string | null;
  email?: string | null;
}): string {
  const company = client.company_name?.trim();
  const person = clientPersonName(client);

  if (client.client_type === 'business' && person && person !== company) {
    return person;
  }

  if (company && client.client_type !== 'business') {
    return company;
  }

  const location = [client.city].filter(Boolean).join(', ');
  if (location) {
    return location;
  }

  if (client.email?.trim()) {
    return client.email.trim();
  }

  return 'Client account';
}
