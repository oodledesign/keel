/**
 * Agents Society / Property Hive XML helpers for joint co-marketing agents.
 * Feed `<contacts>` are usually the listing agent's own desk — do not treat as
 * joint agents. Use `<joint_agents>` (when populated) for co-marketing firms.
 */

export type FeedJointAgent = {
  externalId: string | null;
  firmName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

function text(el: Element | null, tag: string): string | null {
  const value = el?.querySelector(`:scope > ${tag}`)?.textContent?.trim();
  return value || null;
}

function parseJointAgentNode(node: Element): FeedJointAgent | null {
  const firmName =
    text(node, 'office') ||
    text(node, 'firm') ||
    text(node, 'company') ||
    text(node, 'name');
  if (!firmName) return null;

  const contactName =
    text(node, 'contact_name') ||
    (text(node, 'office') || text(node, 'firm') || text(node, 'company')
      ? text(node, 'name')
      : null);

  return {
    externalId: text(node, 'id') || text(node, 'object_id'),
    firmName,
    contactName:
      contactName && contactName !== firmName ? contactName : text(node, 'name'),
    contactEmail: text(node, 'email'),
    contactPhone: text(node, 'mobile') || text(node, 'tel') || text(node, 'phone'),
  };
}

/** Parse `<joint_agents>` from a property Element (browser or linkedom/DOMParser). */
export function parseJointAgentsFromPropertyElement(
  property: Element,
): FeedJointAgent[] {
  const root = property.querySelector(':scope > joint_agents');
  if (!root) return [];

  const agents: FeedJointAgent[] = [];
  for (const child of Array.from(root.children)) {
    const parsed = parseJointAgentNode(child);
    if (parsed) agents.push(parsed);
  }
  return agents;
}

/**
 * Lightweight XML string parser for Node (no DOM required).
 * Extracts joint agents from a single `<property>...</property>` snippet or full feed.
 */
export function parseJointAgentsFromPropertyXml(
  propertyXml: string,
): FeedJointAgent[] {
  const block = propertyXml.match(
    /<joint_agents>([\s\S]*?)<\/joint_agents>/i,
  )?.[1];
  if (!block?.trim()) return [];

  const agents: FeedJointAgent[] = [];
  const agentRe =
    /<(?:joint_agent|agent|contact)\b[^>]*>([\s\S]*?)<\/(?:joint_agent|agent|contact)>/gi;
  let match: RegExpExecArray | null;
  while ((match = agentRe.exec(block))) {
    const inner = match[1] ?? '';
    const field = (tag: string) =>
      inner.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1]
        ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .trim() || null;

    const firmName =
      field('office') || field('firm') || field('company') || field('name');
    if (!firmName) continue;

    const name = field('name');
    agents.push({
      externalId: field('id') || field('object_id'),
      firmName,
      contactName:
        field('contact_name') ||
        (field('office') || field('firm') || field('company') ? name : null),
      contactEmail: field('email'),
      contactPhone: field('mobile') || field('tel') || field('phone'),
    });
  }
  return agents;
}
