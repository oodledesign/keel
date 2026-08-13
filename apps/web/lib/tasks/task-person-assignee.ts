export type TaskPersonAssigneeKind = 'member' | 'contact';

export type TaskPersonAssigneeOption = {
  kind: TaskPersonAssigneeKind;
  id: string;
  label: string;
  email: string | null;
  pictureUrl: string | null;
};

/** Value used by Select components: `m:<userId>` | `c:<contactId>` | `__none__`. */
export function personAssigneeSelectValue(
  assignee:
    | { kind: 'member'; userId: string }
    | { kind: 'contact'; contactId: string }
    | null
    | undefined,
): string {
  if (!assignee) return '__none__';
  if (assignee.kind === 'member') return `m:${assignee.userId}`;
  return `c:${assignee.contactId}`;
}

export function parsePersonAssigneeSelectValue(value: string): {
  kind: TaskPersonAssigneeKind | 'none';
  id: string | null;
} {
  if (!value || value === '__none__') {
    return { kind: 'none', id: null };
  }
  if (value.startsWith('m:')) {
    return { kind: 'member', id: value.slice(2) };
  }
  if (value.startsWith('c:')) {
    return { kind: 'contact', id: value.slice(2) };
  }
  return { kind: 'none', id: null };
}

export function resolvePersonAssigneeFromSuggestion(
  suggestion: {
    email?: string | null;
    name?: string | null;
    kind?: 'member' | 'contact' | null;
  },
  options: TaskPersonAssigneeOption[],
): TaskPersonAssigneeOption | null {
  const email = suggestion.email?.trim().toLowerCase() || null;
  const name = suggestion.name?.trim().toLowerCase() || null;
  const preferredKind = suggestion.kind ?? null;

  const pool = preferredKind
    ? options.filter((o) => o.kind === preferredKind)
    : options;

  if (email) {
    const byEmail = pool.find((o) => o.email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  if (name) {
    const byName = pool.find((o) => o.label.trim().toLowerCase() === name);
    if (byName) return byName;
    const partial = pool.find(
      (o) =>
        o.label.toLowerCase().includes(name) ||
        name.includes(o.label.toLowerCase()),
    );
    if (partial) return partial;
  }

  return null;
}

/** Match calendar attendees / emails to member or contact options. */
export function matchAssigneeOptionByEmail(
  email: string | null | undefined,
  options: TaskPersonAssigneeOption[],
): TaskPersonAssigneeOption | null {
  const target = email?.trim().toLowerCase();
  if (!target) return null;
  return options.find((o) => o.email?.trim().toLowerCase() === target) ?? null;
}
