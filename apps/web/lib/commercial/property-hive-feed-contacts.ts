/**
 * Kato-compatible `<contacts>` / `<joint_agents>` for EACH and Property Hive.
 *
 * `<contacts>` are the listing's own acting desk (commercial_listing_agents).
 * `<joint_agents>` are external co-marketing firms (commercial_listing_co_agents).
 */

export type FeedActingAgentContact = {
  name: string;
  email: string;
  phone: string;
  office: string;
  branch: string;
};

export type FeedActingAgentInput = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type FeedCoAgentClient = {
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
};

export type FeedCoAgentRow = {
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  clients: FeedCoAgentClient | FeedCoAgentClient[] | null;
};

export type StaffPhoneRow = {
  email?: string | null;
  signature_email?: string | null;
  phone_direct?: string | null;
  phone_mobile?: string | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function el(name: string, value: string | number | null | undefined): string {
  if (value == null || value === '') return `<${name}/>`;
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

export function pickStaffPhone(row: StaffPhoneRow): string | null {
  return row.phone_direct?.trim() || row.phone_mobile?.trim() || null;
}

export function indexStaffPhonesByEmail(
  rows: readonly StaffPhoneRow[],
): Map<string, string> {
  const phoneByEmail = new Map<string, string>();
  for (const staff of rows) {
    const phone = pickStaffPhone(staff);
    if (!phone) continue;
    for (const key of [staff.email, staff.signature_email]) {
      const normalized = key?.trim().toLowerCase();
      if (normalized) phoneByEmail.set(normalized, phone);
    }
  }
  return phoneByEmail;
}

/**
 * Map ordered acting agents to feed contacts. First entry is the primary
 * contact. Agents with neither name nor email are skipped.
 */
export function toFeedActingAgentContacts(
  agents: readonly FeedActingAgentInput[],
  defaults: { office?: string | null; branch?: string | null } = {},
): FeedActingAgentContact[] {
  const office = defaults.office?.trim() || '';
  const branch = defaults.branch?.trim() || '';

  const contacts: FeedActingAgentContact[] = [];
  for (const agent of agents) {
    const email = agent.email?.trim() || '';
    const name = agent.name?.trim() || email;
    if (!name) continue;
    contacts.push({
      name,
      email,
      phone: agent.phone?.trim() || '',
      office,
      branch,
    });
  }
  return contacts;
}

export function renderFeedContactsXml(
  contacts: readonly FeedActingAgentContact[],
): string {
  if (!contacts.length) return '<contacts/>';

  return `<contacts>${contacts
    .map((contact) =>
      [
        '<contact>',
        el('name', contact.name),
        el('email', contact.email),
        // Kato expects both; we only store one phone per acting agent.
        el('tel', contact.phone),
        el('mobile', contact.phone),
        el('office', contact.office),
        el('branch', contact.branch),
        '</contact>',
      ].join(''),
    )
    .join('')}</contacts>`;
}

function resolveCoAgentClient(
  row: FeedCoAgentRow,
): FeedCoAgentClient | undefined {
  return Array.isArray(row.clients)
    ? row.clients[0]
    : (row.clients ?? undefined);
}

export function renderFeedJointAgentsXml(
  coAgents: readonly FeedCoAgentRow[],
): string {
  if (!coAgents.length) return '<joint_agents/>';

  return `<joint_agents>${coAgents
    .map((row) => {
      const linked = resolveCoAgentClient(row);
      const office =
        linked?.company_name?.trim() ||
        linked?.display_name?.trim() ||
        'Joint agent';
      const name = row.contact_name?.trim() || office;
      const email = row.contact_email?.trim() || linked?.email?.trim() || '';
      const tel = row.contact_phone?.trim() || linked?.phone?.trim() || '';
      return [
        '<joint_agent>',
        el('name', name),
        el('email', email),
        el('tel', tel),
        el('mobile', tel),
        el('office', office),
        '</joint_agent>',
      ].join('');
    })
    .join('')}</joint_agents>`;
}
