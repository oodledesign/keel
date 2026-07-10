import { emptyWebsiteStyleSystem } from '../planning-types';
import { findSectionLibraryEntry } from '../section-library';
import type { WebsiteExportFile, WebsiteExportInput } from './types';
import { pageRoute } from './types';

function clientFirstName(
  libraryKey: string | null | undefined,
  title: string,
): string {
  const entry = findSectionLibraryEntry(libraryKey);
  if (entry) return entry.clientFirstName;
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/**
 * Webflow Client-First 3.0 (Finsweet) build guide: page/section structure,
 * class naming, and per-section HTML/class stubs to mirror in the Designer.
 */
export function buildWebflowGuide(input: WebsiteExportInput): WebsiteExportFile {
  const style = input.style ?? emptyWebsiteStyleSystem();
  const { tokens } = style;

  const lines: string[] = [
    `# Webflow build guide (Client-First 3.0) — ${input.websiteName}`,
    '',
    'Follow the [Finsweet Client-First](https://finsweet.com/client-first/docs) conventions.',
    'Structure below maps every approved page and section to Client-First classes.',
    '',
    '## 1. Project setup',
    '',
    '- Install the Client-First cloneable or start from the official starter.',
    '- Create these **colour variables** (Site settings → Variables):',
    '',
    '| Variable | Value | Role |',
    '|----------|-------|------|',
    `| \`--canvas\` | \`${tokens.canvas}\` | Page background |`,
    `| \`--atmosphere\` | \`${tokens.atmosphere}\` | Alternate section background |`,
    `| \`--accent\` | \`${tokens.accent}\` | Buttons, highlights |`,
    `| \`--contrast\` | \`${tokens.contrast}\` | Headings + body text |`,
    `| \`--secondary\` | \`${tokens.secondary}\` | Secondary accents |`,
    '',
    `- Fonts: **${tokens.headingFont || 'TBD'}** (headings), **${tokens.bodyFont || 'TBD'}** (body).`,
    `- Radius scale: ${tokens.radius}. Spacing density: ${tokens.spacingDensity}.`,
    '',
    '## 2. Class naming rules (Client-First)',
    '',
    '- Sections: `section_[name]` wrapped in `padding-global` + `container-large`.',
    '- Vertical rhythm with `padding-section-large|medium|small` utility classes.',
    '- Component-specific classes: `[component]_[element]` e.g. `hero-split_heading`.',
    '- Never style utility classes; create component classes for custom styling.',
    '',
    '## 3. Pages & sections',
    '',
  ];

  for (const page of input.sitemap) {
    const wireframe = input.wireframes.find((item) => item.pageId === page.id);
    const seo = input.seoPages[page.id];

    lines.push(`### ${page.title} — \`${pageRoute(page)}\``, '');
    if (seo?.title) {
      lines.push(
        `> SEO title: \`${seo.title}\`${seo.metaDescription ? ` · Meta: \`${seo.metaDescription}\`` : ''}`,
        '',
      );
    }

    const sections = wireframe?.sections?.length
      ? wireframe.sections
      : page.sections.map((section) => ({
          title: section.title,
          layout: 'full' as const,
          libraryKey: null,
          copyOutline: '',
          contentNotes: section.description,
        }));

    for (const section of sections) {
      const name = clientFirstName(section.libraryKey ?? null, section.title);
      lines.push(
        `#### ${section.title}`,
        '',
        '```html',
        `<section class="section_${name}">`,
        `  <div class="padding-global">`,
        `    <div class="container-large">`,
        `      <div class="padding-section-medium">`,
        `        <div class="${name}_component">`,
        `          <!-- ${section.contentNotes ? section.contentNotes.replace(/\n+/g, ' ').slice(0, 160) : section.title} -->`,
        `        </div>`,
        `      </div>`,
        `    </div>`,
        `  </div>`,
        `</section>`,
        '```',
        '',
      );
      if (section.copyOutline) {
        lines.push('Copy outline:', '', '```', section.copyOutline, '```', '');
      }
    }
  }

  lines.push(
    '## 4. Shared components',
    '',
    'Sections marked as repeating components in the sitemap (header, footer, CTA band) must be Webflow **Components** so one edit updates every instance.',
    '',
    '## 5. Workflow',
    '',
    '1. Build global styles + variables first.',
    '2. Create shared components (nav, footer, CTA band).',
    '3. Build Home top-to-bottom, then remaining pages.',
    '4. Paste JSON-LD blocks from `seo/json-ld.html` into per-page custom code.',
    '5. Add `llms.txt` content to the hosting root (Webflow: use a reverse proxy or Cloudflare worker, or host on the primary domain).',
    '',
  );

  return {
    path: 'webflow/client-first-guide.md',
    language: 'markdown',
    content: lines.join('\n'),
  };
}
