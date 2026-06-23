import 'server-only';

function buildClientDisplayName(row: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  const fromParts = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return (
    row.display_name?.trim() ||
    fromParts ||
    row.company_name?.trim() ||
    'Client'
  );
}

export async function loadPrimaryContactEmailsByClientId(
  admin: any,
  clientIds: string[],
) {
  const out = new Map<string, string>();
  if (clientIds.length === 0) return out;

  const { data: rows, error } = await admin
    .from('client_contacts')
    .select('client_id, is_primary, created_at, contacts ( email )')
    .in('client_id', clientIds)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[messages] failed to load client contacts', error);
    return out;
  }

  for (const row of rows ?? []) {
    const clientId = row.client_id as string;
    const contact = row.contacts as { email?: string | null } | null;
    const email = (contact?.email as string | null)?.trim();
    if (!email || out.has(clientId)) continue;
    out.set(clientId, email);
  }

  return out;
}

export async function loadMessageClientOptions(admin: any, accountId: string) {
  const { data: clients, error } = await admin
    .from('clients')
    .select('id, display_name, company_name, first_name, last_name, email')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[messages] failed to load clients', error);
    return [] as Array<{ clientId: string; name: string; email: string | null }>;
  }

  const clientIds = (clients ?? []).map((c: any) => c.id as string);
  const emailByClientId = await loadPrimaryContactEmailsByClientId(admin, clientIds);

  return (clients ?? []).map((c: any) => ({
    clientId: c.id as string,
    name: buildClientDisplayName(c),
    email:
      emailByClientId.get(c.id as string) ??
      ((c.email as string | null)?.trim() || null),
  }));
}

export async function loadClientDisplayByIds(admin: any, clientIds: string[]) {
  const out = new Map<string, { name: string; email: string | null }>();
  if (clientIds.length === 0) return out;

  const { data: clients, error } = await admin
    .from('clients')
    .select('id, display_name, company_name, first_name, last_name, email')
    .in('id', clientIds);

  if (error) {
    console.error('[messages] failed to load client display rows', error);
    return out;
  }

  const emailByClientId = await loadPrimaryContactEmailsByClientId(admin, clientIds);

  for (const c of clients ?? []) {
    out.set(c.id as string, {
      name: buildClientDisplayName(c),
      email:
        emailByClientId.get(c.id as string) ??
        ((c.email as string | null)?.trim() || null),
    });
  }

  return out;
}
