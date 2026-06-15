export type WebsitePlanningTab = 'overview' | 'sitemap' | 'wireframe' | 'content';

export type WebsiteSitemapSection = {
  id: string;
  title: string;
  description: string;
};

export type WebsiteSitemapPage = {
  id: string;
  title: string;
  slug: string;
  sections: WebsiteSitemapSection[];
};

export type WebsiteWireframeLayout =
  | 'full'
  | 'split'
  | 'grid'
  | 'cards'
  | 'cta'
  | 'footer';

export type WebsiteWireframeSection = {
  id: string;
  sitemapSectionId: string | null;
  title: string;
  layout: WebsiteWireframeLayout;
  contentNotes: string;
};

export type WebsiteWireframePage = {
  id: string;
  pageId: string;
  title: string;
  sections: WebsiteWireframeSection[];
};

export type WebsiteContentDoc = {
  id: string;
  title: string;
  contentMd: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export const WIREFRAME_LAYOUT_OPTIONS: Array<{
  value: WebsiteWireframeLayout;
  label: string;
  hint: string;
}> = [
  { value: 'full', label: 'Full width', hint: 'Hero, banner, rich media' },
  { value: 'split', label: 'Split', hint: 'Text + image side by side' },
  { value: 'grid', label: 'Grid', hint: 'Multi-column features' },
  { value: 'cards', label: 'Cards', hint: 'Team, services, testimonials' },
  { value: 'cta', label: 'CTA band', hint: 'Conversion strip' },
  { value: 'footer', label: 'Footer', hint: 'Nav, contact, legal' },
];

export function createPlanningId() {
  return crypto.randomUUID();
}

export function slugifyPageTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
