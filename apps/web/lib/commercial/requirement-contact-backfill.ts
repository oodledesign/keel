/**
 * Plans the one-off backfill that makes every requirement point at a contact,
 * so circulation can take its address from the contact record. Pure: the
 * script loads rows, calls this, prints the report and (with --write) applies.
 */

export type BackfillRequirement = {
  id: string;
  clientId: string | null;
  contactId: string | null;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  companyName: string | null;
};

export type BackfillClient = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export type BackfillPerson = {
  id: string;
  email: string | null;
  clientId: string | null;
};

export type BackfillAction =
  | {
      kind: 'link_existing';
      requirementId: string;
      clientId: string;
      contactId: string | null;
      matchedOn: 'client_email' | 'person_email';
    }
  | {
      kind: 'create_contact';
      requirementId: string;
      email: string | null;
      name: string | null;
      phone: string | null;
      companyName: string | null;
      /** Existing contacts with the same name, for a person to check first. */
      possibleDuplicates: string[];
    }
  | {
      kind: 'fill_email';
      requirementId: string;
      email: string;
    }
  | {
      kind: 'mismatch';
      requirementId: string;
      requirementEmail: string;
      contactEmail: string;
    }
  | { kind: 'unlinkable'; requirementId: string };

export type BackfillPlan = {
  actions: BackfillAction[];
  counts: Record<BackfillAction['kind'], number>;
};

function normEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? '';
  return email.includes('@') ? email : null;
}

function normName(value: string | null | undefined): string | null {
  const name = value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
  return name || null;
}

export function planRequirementContactBackfill(input: {
  requirements: BackfillRequirement[];
  clients: BackfillClient[];
  people: BackfillPerson[];
  /** client_contacts links, person id to client id. */
  personClientLinks: Array<{ contactId: string; clientId: string }>;
}): BackfillPlan {
  const clientById = new Map(input.clients.map((c) => [c.id, c]));
  const personById = new Map(input.people.map((p) => [p.id, p]));
  const clientByEmail = new Map<string, BackfillClient>();
  for (const client of input.clients) {
    const email = normEmail(client.email);
    if (email && !clientByEmail.has(email)) clientByEmail.set(email, client);
  }
  const personByEmail = new Map<string, BackfillPerson>();
  for (const person of input.people) {
    const email = normEmail(person.email);
    if (email && !personByEmail.has(email)) personByEmail.set(email, person);
  }
  const clientIdsByName = new Map<string, string[]>();
  for (const client of input.clients) {
    const name = normName(client.displayName);
    if (!name) continue;
    clientIdsByName.set(name, [
      ...(clientIdsByName.get(name) ?? []),
      client.id,
    ]);
  }
  const clientForPerson = new Map<string, string>();
  for (const link of input.personClientLinks) {
    if (!clientForPerson.has(link.contactId)) {
      clientForPerson.set(link.contactId, link.clientId);
    }
  }

  // Several website-form requirements from one person share one new contact.
  const plannedCreates = new Set<string>();
  const actions: BackfillAction[] = [];

  for (const req of input.requirements) {
    const reqEmail = normEmail(req.contactEmail);

    if (!req.clientId) {
      const client = reqEmail ? clientByEmail.get(reqEmail) : undefined;
      if (client) {
        const person = reqEmail ? personByEmail.get(reqEmail) : undefined;
        actions.push({
          kind: 'link_existing',
          requirementId: req.id,
          clientId: client.id,
          contactId: person ? person.id : null,
          matchedOn: 'client_email',
        });
        continue;
      }

      const person = reqEmail ? personByEmail.get(reqEmail) : undefined;
      const personClientId = person
        ? (person.clientId ?? clientForPerson.get(person.id) ?? null)
        : null;
      if (person && personClientId) {
        actions.push({
          kind: 'link_existing',
          requirementId: req.id,
          clientId: personClientId,
          contactId: person.id,
          matchedOn: 'person_email',
        });
        continue;
      }

      const name = req.contactName?.trim() || null;
      if (!reqEmail && !name) {
        actions.push({ kind: 'unlinkable', requirementId: req.id });
        continue;
      }

      const createKey = reqEmail ?? `name:${normName(name)}`;
      const nameKey = normName(req.companyName) ?? normName(name);
      actions.push({
        kind: 'create_contact',
        requirementId: req.id,
        email: reqEmail,
        name,
        phone: req.contactPhone?.trim() || null,
        companyName: req.companyName?.trim() || null,
        possibleDuplicates: plannedCreates.has(createKey)
          ? []
          : nameKey
            ? (clientIdsByName.get(nameKey) ?? [])
            : [],
      });
      plannedCreates.add(createKey);
      continue;
    }

    const person = req.contactId ? personById.get(req.contactId) : undefined;
    const client = clientById.get(req.clientId);
    const linkedEmail = normEmail(person?.email) ?? normEmail(client?.email);

    if (!reqEmail && linkedEmail) {
      actions.push({
        kind: 'fill_email',
        requirementId: req.id,
        email: linkedEmail,
      });
    } else if (reqEmail && linkedEmail && reqEmail !== linkedEmail) {
      actions.push({
        kind: 'mismatch',
        requirementId: req.id,
        requirementEmail: reqEmail,
        contactEmail: linkedEmail,
      });
    }
  }

  const counts: BackfillPlan['counts'] = {
    link_existing: 0,
    create_contact: 0,
    fill_email: 0,
    mismatch: 0,
    unlinkable: 0,
  };
  for (const action of actions) counts[action.kind] += 1;

  return { actions, counts };
}
