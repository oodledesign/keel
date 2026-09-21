/**
 * Starter workspace catalogue. Used only when the library is empty and
 * the user asks to seed it — never wipes existing rows.
 */
export const DEFAULT_WORKSPACE_RETAINER_SERVICES = [
  {
    name: 'Website content update',
    description:
      'CMS / Webflow copy or image change. Clients say “update the site”, “change the text”, “swap the photo”.',
    creditCost: 2,
    defaultDurationMinutes: 30,
    sortOrder: 0,
  },
  {
    name: 'New website page',
    description:
      'New landing or inner page. Clients say “add a page”, “new landing”, “new service page”.',
    creditCost: 8,
    defaultDurationMinutes: 120,
    sortOrder: 1,
  },
  {
    name: 'Design tweak',
    description:
      'Small visual or brand change. Clients say “make it match the brand”, “tweak the layout”.',
    creditCost: 3,
    defaultDurationMinutes: 45,
    sortOrder: 2,
  },
  {
    name: 'Community / app update',
    description:
      'Member area, community app, or gated content change. Clients say “update the app”, “member access”, “community post”.',
    creditCost: 4,
    defaultDurationMinutes: 60,
    sortOrder: 3,
  },
  {
    name: 'SEO article',
    description:
      'Blog or SEO content piece. Clients say “write a blog”, “SEO post”, “article this month”.',
    creditCost: 4,
    defaultDurationMinutes: 90,
    sortOrder: 4,
  },
  {
    name: 'Support fix',
    description:
      'Urgent bug or “it’s broken” request. Clients say “broken”, “not working”, “can you fix”.',
    creditCost: 1,
    defaultDurationMinutes: 15,
    sortOrder: 5,
  },
] as const;
