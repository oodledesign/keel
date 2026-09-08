export type ComposePersonKind = 'member' | 'contact';

export type ComposePerson = {
  kind: ComposePersonKind;
  id: string;
  name: string;
};

export type ComposeEntity =
  | { kind: 'client'; id: string; name: string }
  | { kind: 'project'; id: string; name: string };

export type ComposeType = 'direct' | 'group' | 'job' | 'client';

export function inferComposeType(params: {
  people: ComposePerson[];
  entity: ComposeEntity | null;
}): { type: ComposeType | null; error: string | null } {
  if (params.entity?.kind === 'project') {
    return { type: 'job', error: null };
  }

  if (params.entity?.kind === 'client') {
    return { type: 'client', error: null };
  }

  if (params.people.length === 1) {
    return { type: 'direct', error: null };
  }

  if (params.people.length > 1) {
    return { type: 'group', error: null };
  }

  return { type: null, error: 'Add a person, client, or project' };
}

export function formatWhoCanSee(params: {
  people: ComposePerson[];
  entity: ComposeEntity | null;
}): string {
  const names = uniqueNames(params.people.map((person) => person.name));

  if (params.entity?.kind === 'client') {
    const client = `All portal contacts at ${params.entity.name}`;
    if (names.length === 0) return `${client} + you`;
    if (names.length === 1) return `${client}, you, and ${names[0]}`;
    return `${client}, you, ${joinNames(names)}`;
  }

  if (params.entity?.kind === 'project') {
    const linked = `Linked to ${params.entity.name}`;
    if (names.length === 0) return `Only you. ${linked}.`;
    if (names.length === 1) return `Only you and ${names[0]}. ${linked}.`;
    return `You, ${joinNames(names)}. ${linked}.`;
  }

  if (names.length === 0) {
    return 'Add someone to choose who can see this.';
  }

  if (names.length === 1) {
    return `Only you and ${names[0]}`;
  }

  return `You, ${joinNames(names)}`;
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function joinNames(names: string[]) {
  return names.join(', ');
}
