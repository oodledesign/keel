/**
 * Webflow Client-First 3.0 pack (Prompt D2).
 *
 * Consumers SiteStudioExport ONLY — never reads the database.
 * v1 is documentation + HTML/class stubs + structured JSON for a future
 * Webflow app/script. There is NO Designer API sync in this pack.
 */
import {
  type ExportPage,
  type ExportSectionInstance,
  type ExportSeoPage,
  type SiteStudioExport,
  type StyleTokens,
  assertCompatibleExportSchemaVersion,
} from '../export-contract';
import {
  type ExportPackFile,
  clientFirstSectionName,
  firstOutlineLine,
  pageRoute,
  projectSlug,
  resolvePackTokens,
  sectionsForPage,
  slugify,
} from './pack-utils';
import {
  type SeoGeneratorOptions,
  generateLlmsTxt,
  jsonLdEmbedDocument,
} from './seo-generators';

export type WebflowPack = {
  files: ExportPackFile[];
};

function seoForPage(
  exp: SiteStudioExport,
  page: ExportPage,
): ExportSeoPage | null {
  return exp.seo?.pages.find((row) => row.pageSlug === page.slug) ?? null;
}

function tokensTable(tokens: StyleTokens): string {
  const ink =
    tokens.colors.neutrals[tokens.colors.neutrals.length - 1] ?? '#111';
  return [
    '| Variable | Value | Role |',
    '| --- | --- | --- |',
    `| \`--sb-color-primary\` | \`${tokens.colors.primary}\` | Brand primary / buttons |`,
    `| \`--sb-color-secondary\` | \`${tokens.colors.secondary}\` | Secondary brand |`,
    `| \`--sb-color-accent\` | \`${tokens.colors.accent}\` | Highlights |`,
    `| \`--sb-canvas\` | \`${tokens.colors.neutrals[0]}\` | Page background |`,
    `| \`--sb-ink\` | \`${ink}\` | Body / heading ink |`,
    `| Display font | ${tokens.typography.displayFamily} | Headings |`,
    `| Body font | ${tokens.typography.bodyFamily} | Body copy |`,
    `| Button style | ${tokens.buttons.style} | Maps to corner radius |`,
    `| Spacing | ${tokens.spacingDensity} | Section rhythm |`,
  ].join('\n');
}

function classNamingGuide(exp: SiteStudioExport, tokens: StyleTokens): string {
  const sectionNames = [
    ...new Set(exp.sections.map((section) => clientFirstSectionName(section))),
  ].sort();

  return [
    '# Client-First 3.0 class naming guide',
    '',
    `Generated for **${exp.website.name}** from SiteStudioExport \`${exp.schemaVersion}\`.`,
    '',
    'Follow [Finsweet Client-First](https://finsweet.com/client-first/docs). Never restyle utility classes — create component classes instead.',
    '',
    '## Global utilities (always)',
    '',
    '```',
    'padding-global',
    'container-large | container-medium | container-small',
    'padding-section-large | padding-section-medium | padding-section-small',
    '```',
    '',
    '## Style variables (create in Webflow)',
    '',
    tokensTable(tokens),
    '',
    '## Section class stems in this project',
    '',
    sectionNames.length
      ? sectionNames
          .map(
            (name) => `- \`section_${name}\` → \`${name}_component\` children`,
          )
          .join('\n')
      : '_No sections in export yet._',
    '',
    '## Naming pattern',
    '',
    '```',
    'section_[name]',
    '  padding-global',
    '    container-large',
    '      padding-section-medium',
    '        [name]_component',
    '          [name]_heading',
    '          [name]_text',
    '          [name]_button',
    '```',
    '',
    'Shared repeating components (header / footer / CTA band) must be Webflow **Components**.',
    '',
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionHtmlStub(section: ExportSectionInstance): string {
  const name = clientFirstSectionName(section);
  const outline =
    firstOutlineLine(section.copyOutline, section.sectionType) ||
    section.sectionType;
  const comment = escapeHtml(outline.replace(/--/g, '—').slice(0, 200));
  const bodyText = escapeHtml(
    section.copyOutline.replace(/\n+/g, ' ').slice(0, 280) || 'TODO copy',
  );

  return [
    `<section class="section_${name}">`,
    `  <div class="padding-global">`,
    `    <div class="container-large">`,
    `      <div class="padding-section-medium">`,
    `        <div class="${name}_component">`,
    `          <!-- ${comment} -->`,
    `          <h2 class="${name}_heading">${escapeHtml(outline)}</h2>`,
    `          <p class="${name}_text">${bodyText}</p>`,
    section.sectionType === 'hero' || section.sectionType === 'cta'
      ? `          <a href="#" class="${name}_button">Primary CTA</a>`
      : null,
    `        </div>`,
    `      </div>`,
    `    </div>`,
    `  </div>`,
    `</section>`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function sectionStubFile(
  page: ExportPage,
  section: ExportSectionInstance,
  index: number,
): ExportPackFile {
  const name = clientFirstSectionName(section);
  const path = `webflow/sections/${String(index + 1).padStart(2, '0')}-${slugify(page.slug)}-${slugify(name)}.html`;

  const content = [
    `<!--`,
    `  Page: ${page.title} (${pageRoute(page)})`,
    `  Section: ${section.sectionType} · id ${section.id}`,
    `  layoutPreset: ${section.layoutPreset}`,
    section.componentKey ? `  componentKey: ${section.componentKey}` : null,
    `  Paste into Webflow Designer (Custom Embed or convert to Div Blocks + classes).`,
    `-->`,
    '',
    '<!-- Copy outline',
    section.copyOutline.trim() || '(empty)',
    '-->',
    '',
    sectionHtmlStub(section),
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { path, content };
}

function workflowDoc(exp: SiteStudioExport, tokens: StyleTokens): string {
  const lines: string[] = [
    `# Webflow Designer workflow — ${exp.website.name}`,
    '',
    'Paste into Webflow Designer following **Client-First 3.0**.',
    '',
    '> **Scope (v1):** documentation, class guide, HTML/class stubs, and `site.json`.',
    '> This pack does **not** sync to the Webflow Designer API. A future Webflow app/script may consume `site.json`.',
    '',
    '## Step 0 — Project setup',
    '',
    '1. Start from the Finsweet Client-First cloneable (or official starter).',
    '2. Create style variables from `CLASS-NAMING.md`.',
    '3. Set display / body fonts from tokens.',
    '',
    '### Tokens snapshot',
    '',
    tokensTable(tokens),
    '',
    '## Step 1 — Shared components',
    '',
  ];

  if (exp.repeatingComponents.length) {
    for (const component of exp.repeatingComponents) {
      lines.push(
        `- Create Webflow Component **${component.title}** (\`${component.key}\`, layout \`${component.layoutPreset ?? 'n/a'}\`).`,
      );
    }
  } else {
    lines.push(
      '- Create nav + footer as Webflow Components once homepage stubs exist.',
    );
  }

  lines.push('', '## Step 2 — Build pages (in order)', '');

  exp.sitemap.forEach((page, pageIndex) => {
    const sections = sectionsForPage(page, exp.sections);
    const seo = seoForPage(exp, page);
    const step = pageIndex + 3;

    lines.push(
      `### Step ${step} — ${page.title} (\`${pageRoute(page)}\`)`,
      '',
      `1. Add a static page with slug \`${page.slug === 'home' ? '' : page.slug}\`.`,
    );

    if (seo?.meta.title) {
      lines.push(
        `2. SEO title: \`${seo.meta.title}\`${seo.meta.description ? ` · Meta: \`${seo.meta.description}\`` : ''}.`,
      );
    } else {
      lines.push('2. Leave SEO fields blank until Site Studio SEO is filled.');
    }

    lines.push('3. Paste each section stub (top → bottom):', '');

    if (!sections.length) {
      lines.push('_No sections exported for this page._', '');
      return;
    }

    sections.forEach((section, index) => {
      const name = clientFirstSectionName(section);
      const stubPath = `webflow/sections/${String(index + 1).padStart(2, '0')}-${slugify(page.slug)}-${slugify(name)}.html`;
      lines.push(
        `${index + 1}. **${section.sectionType}** (\`${name}\`) — open \`${stubPath}\`, paste into the page.`,
        '',
        '```html',
        sectionHtmlStub(section),
        '```',
        '',
        section.copyOutline.trim()
          ? [
              'Copy outline:',
              '',
              '```',
              section.copyOutline.trim(),
              '```',
              '',
            ].join('\n')
          : '',
      );
    });
  });

  lines.push(
    '## Final checks',
    '',
    '1. Home establishes brand + primary conversion goal from the brief.',
    '2. Every page uses only Client-First utilities + project component classes.',
    '3. Tokens are mapped to Webflow variables — do not invent new colours.',
    '4. Shared components are instances, not duplicated Div Blocks.',
    '',
  );

  return lines.filter(Boolean).join('\n');
}

function siteJson(exp: SiteStudioExport, tokens: StyleTokens): string {
  const payload = {
    $schemaNote:
      'Structured Site Studio → Webflow handoff (v1). Documentation + stubs only — not Designer API sync.',
    contractSchemaVersion: exp.schemaVersion,
    generatedAt: exp.generatedAt,
    website: exp.website,
    tokens,
    pages: exp.sitemap.map((page) => {
      const sections = sectionsForPage(page, exp.sections);
      const seo = seoForPage(exp, page);
      return {
        slug: page.slug,
        route: pageRoute(page),
        title: page.title,
        description: page.description,
        pageType: page.pageType,
        status: page.status,
        seo: seo
          ? {
              title: seo.meta.title,
              metaDescription: seo.meta.description,
              h1:
                seo.headingOutline.find((item) => item.level === 1)?.text ??
                seo.headingOutline[0]?.text ??
                '',
              primaryKeyword: seo.keywords.primary,
              schemaTypes: seo.schemaTypes,
            }
          : null,
        sections: sections.map((section) => ({
          id: section.id,
          sectionType: section.sectionType,
          layoutPreset: section.layoutPreset,
          componentKey: section.componentKey ?? null,
          clientFirstName: clientFirstSectionName(section),
          copyOutline: section.copyOutline,
          props: section.props,
          status: section.status,
        })),
      };
    }),
    repeatingComponents: exp.repeatingComponents,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

function readme(exp: SiteStudioExport): string {
  return [
    `# Webflow Client-First pack — ${exp.website.name}`,
    '',
    'Generated by Ozer Site Studio from the **SiteStudioExport** contract.',
    '',
    '## Important — v1 scope',
    '',
    'This pack is **documentation + HTML/class stubs + `site.json`**.',
    'It does **not** push styles, pages, or components into Webflow via the Designer API.',
    '`site.json` is the structured site document for a **future** Webflow app/script to consume.',
    '',
    '## Contents',
    '',
    '| Path | Purpose |',
    '| --- | --- |',
    '| `README.md` | This file |',
    '| `WORKFLOW.md` | Step-by-step paste-into-Designer guide per page |',
    '| `CLASS-NAMING.md` | Client-First 3.0 naming from tokens + sections |',
    '| `webflow/sections/*.html` | Copy-pasteable section stubs with copy outlines |',
    '| `site.json` | Structured whole-site document (future automation) |',
    '| `public/llms.txt` | llmstxt.org index — host at site root |',
    '| `seo/json-ld-embeds.md` | Paste-ready JSON-LD `<script>` blocks per page |',
    '',
    '## How to use',
    '',
    '1. Open `WORKFLOW.md` and follow steps in order.',
    '2. Paste each `webflow/sections/*.html` stub into the Designer (then convert Embed → Div Blocks if preferred).',
    '3. Apply classes exactly as written (`section_*`, `padding-global`, `container-large`, …).',
    '',
    `Contract schemaVersion: \`${exp.schemaVersion}\` · Generated: ${exp.generatedAt}`,
    '',
  ].join('\n');
}

/**
 * Build the Webflow Client-First 3.0 pack from a SiteStudioExport.
 */
export function generateWebflowPack(
  exp: SiteStudioExport,
  options?: SeoGeneratorOptions,
): WebflowPack {
  assertCompatibleExportSchemaVersion(exp.schemaVersion);
  const tokens = resolvePackTokens(exp.styleTokens);

  const files: ExportPackFile[] = [
    { path: 'README.md', content: readme(exp) },
    { path: 'WORKFLOW.md', content: workflowDoc(exp, tokens) },
    { path: 'CLASS-NAMING.md', content: classNamingGuide(exp, tokens) },
    { path: 'site.json', content: siteJson(exp, tokens) },
    { path: 'public/llms.txt', content: generateLlmsTxt(exp, options) },
    { path: 'seo/json-ld-embeds.md', content: jsonLdEmbedDocument(exp) },
  ];

  for (const page of exp.sitemap) {
    const sections = sectionsForPage(page, exp.sections);
    sections.forEach((section, index) => {
      files.push(sectionStubFile(page, section, index));
    });
  }

  return { files };
}

export function webflowPackZipFilename(websiteName: string): string {
  return `${projectSlug(websiteName)}-webflow-client-first.zip`;
}
