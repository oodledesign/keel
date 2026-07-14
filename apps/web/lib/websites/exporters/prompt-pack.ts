/**
 * Cursor / Claude prompt pack exporter (Prompt B2).
 *
 * Input is EXCLUSIVELY a SiteStudioExport — never reads the database.
 * Missing style / SEO degrade with explicit "not yet defined" notes.
 */
import siteBlocksRegistry from '@kit/site-blocks-core/registry.json';

import {
  type ExportPage,
  type ExportSectionInstance,
  type ExportSeoPage,
  type SiteStudioExport,
  type StyleTokens,
  assertCompatibleExportSchemaVersion,
} from '../export-contract';
import {
  type SeoGeneratorOptions,
  generateJsonLd,
  generateLlmsTxt,
  jsonLdEmbedDocument,
} from './seo-generators';
import type { PromptPackTarget } from './types';

export type { PromptPackTarget } from './types';

export type PromptPackFile = {
  path: string;
  content: string;
};

export type PromptPack = {
  files: PromptPackFile[];
};

const NOT_DEFINED = '_Not yet defined in Site Studio — do not invent values._';

function pageRoute(page: ExportPage): string {
  return page.slug === 'home' || page.slug === 'index' ? '/' : `/${page.slug}`;
}

function slugifyFile(slug: string): string {
  return (
    slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'page'
  );
}

function formatProps(props: Record<string, unknown>): string {
  if (!props || Object.keys(props).length === 0) {
    return NOT_DEFINED;
  }
  return ['```json', JSON.stringify(props, null, 2), '```'].join('\n');
}

function styleTokensBlock(tokens: StyleTokens | null): string {
  if (!tokens) {
    return [
      '## Style tokens',
      '',
      NOT_DEFINED,
      '',
      'When tokens arrive, lock colours/type/radius via CSS variables (`--sb-*`) and never improvise new values.',
    ].join('\n');
  }

  return [
    '## Style tokens (D1)',
    '',
    `schemaVersion: \`${tokens.schemaVersion}\``,
    '',
    '| Role | Value |',
    '| --- | --- |',
    `| Primary | \`${tokens.colors.primary}\` |`,
    `| Secondary | \`${tokens.colors.secondary}\` |`,
    `| Accent | \`${tokens.colors.accent}\` |`,
    `| Neutrals | ${tokens.colors.neutrals.map((hex) => `\`${hex}\``).join(', ')} |`,
    `| Success / Warning / Danger | \`${tokens.colors.success}\` / \`${tokens.colors.warning}\` / \`${tokens.colors.danger}\` |`,
    `| Display / Body | ${tokens.typography.displayFamily || NOT_DEFINED} / ${tokens.typography.bodyFamily || NOT_DEFINED} |`,
    `| Type scale | base ${tokens.typography.typeScale.base}px · ratio ${tokens.typography.typeScale.ratio} |`,
    `| Weights | ${tokens.typography.weights.regular} / ${tokens.typography.weights.medium} / ${tokens.typography.weights.bold} |`,
    `| Radius | sm \`${tokens.radius.sm}\` · md \`${tokens.radius.md}\` · lg \`${tokens.radius.lg}\` |`,
    `| Spacing | ${tokens.spacingDensity} |`,
    `| Buttons | ${tokens.buttons.style} |`,
    `| Photography | ${tokens.photographyDirection || NOT_DEFINED} |`,
    '',
    'Map onto `@kit/site-blocks-core` via `resolveTokens()` → `--sb-color-*`, `--sb-font-*`, `--sb-radius-*`, `--sb-button-radius`. Never invent new hex/fonts.',
  ].join('\n');
}

function briefSummary(exp: SiteStudioExport): string {
  const brief = exp.brief;
  if (!brief) {
    return [
      '## Brief',
      '',
      NOT_DEFINED,
      '',
      `Website name from record: **${exp.website.name}**`,
      exp.website.domain ? `Domain: ${exp.website.domain}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    '## Brief',
    '',
    `- **Organisation:** ${brief.org.name || NOT_DEFINED}`,
    `- **One-liner:** ${brief.org.oneLiner || NOT_DEFINED}`,
    `- **Sector:** ${brief.org.sector || NOT_DEFINED}`,
    `- **Geography:** ${brief.org.geography || NOT_DEFINED}`,
    `- **Tone:** ${brief.brand.tone.length ? brief.brand.tone.join(', ') : NOT_DEFINED}`,
    `- **Conversion goals:** ${
      brief.offer.primaryConversionGoals.length
        ? brief.offer.primaryConversionGoals.join('; ')
        : NOT_DEFINED
    }`,
    `- **Audience:** ${
      brief.audience.segments.length
        ? brief.audience.segments
            .map(
              (s) => `${s.name}${s.jobsToBeDone ? ` — ${s.jobsToBeDone}` : ''}`,
            )
            .join('; ')
        : NOT_DEFINED
    }`,
    `- **Services:** ${
      brief.offer.services.length
        ? brief.offer.services.map((s) => s.name).join(', ')
        : NOT_DEFINED
    }`,
    brief.brand.constraints.length
      ? `- **Constraints:** ${brief.brand.constraints.join('; ')}`
      : `- **Constraints:** ${NOT_DEFINED}`,
    `- **Stack preference:** ${brief.stackPreference}`,
  ].join('\n');
}

function sitemapTable(exp: SiteStudioExport): string {
  if (exp.sitemap.length === 0) {
    return ['## Sitemap', '', NOT_DEFINED].join('\n');
  }

  const lines = [
    '## Sitemap',
    '',
    '| Order | Title | Slug | Type | Parent | Status | Sections |',
    '| ---: | --- | --- | --- | --- | --- | ---: |',
  ];

  exp.sitemap.forEach((page, index) => {
    lines.push(
      `| ${index + 1} | ${page.title} | \`${pageRoute(page)}\` | ${page.pageType} | ${page.parentId ?? '—'} | ${page.status} | ${page.sectionIds.length} |`,
    );
  });

  if (exp.repeatingComponents.length > 0) {
    lines.push(
      '',
      '### Repeating components',
      '',
      ...exp.repeatingComponents.map(
        (component) =>
          `- \`${component.key}\` — ${component.title} (${component.sectionType}${component.layoutPreset ? `, layout \`${component.layoutPreset}\`` : ''})`,
      ),
    );
  }

  return lines.join('\n');
}

function stackConventions(target: PromptPackTarget): string {
  switch (target) {
    case 'webflow':
      return [
        '# Stack conventions — Webflow (Client-First 3.0)',
        '',
        'Build in Webflow using **Finsweet Client-First 3.0** naming:',
        '',
        '- Page sections: `section_[name]` → `padding-global` → `container-large` → `padding-section-medium` → `[name]_component`',
        '- Utility classes for spacing/type; never one-off class soup',
        '- Shared header / footer / CTA bands must be **Webflow Components** (Symbols) matching `componentKey` from the export',
        '- Combo classes sparingly; prefer Client-First utilities',
        '- Interactions only after structure + copy are approved',
        '',
        'Per-section prompts in `webflow/sections/` give the exact Client-First scaffold to implement.',
      ].join('\n');
    case 'astro':
      return [
        '# Stack conventions — Astro',
        '',
        '- Content collections for pages / posts; typed frontmatter from the export sitemap',
        '- One Astro section component per `layoutPreset` / library variant under `src/components/sections/`',
        '- Pass copyOutline / props as typed props — no untyped `any` content bags',
        '- Prefer `.astro` for static marketing pages; islands only where interactivity is required',
        '- Global tokens as CSS variables in `src/styles/tokens.css`',
      ].join('\n');
    case 'next':
      return [
        '# Stack conventions — Next.js App Router',
        '',
        '- App Router routes from the sitemap (`app/(marketing)/…`)',
        '- Typed content config (e.g. `content/pages.ts`) generated from SiteStudioExport pages',
        '- Section components with explicit prop types; map `layoutPreset` → component',
        '- SEO via `generateMetadata` using ExportSeo when present — otherwise leave TODO comments, do not invent titles',
        '- Global tokens as CSS variables in `app/globals.css`',
        '- Server Components by default; client components only for interaction',
      ].join('\n');
    case 'ozer_sites':
      return [
        '# Stack conventions — ozer_sites (@kit/site-blocks-core)',
        '',
        '- Compose pages from **`@kit/site-blocks-core`** via `buildConfig()` + Puck `<Render>`',
        '- Canonical registry: see `registry/site-blocks-registry.json` in this pack',
        '- Map each section `layoutPreset` (preferred) or legacy `libraryKey` / `componentKey` to a registered block',
        '- Fill typed block props from export `props` + `copyOutline` — never invent parallel components',
        '- Shared symbols (`repeatingComponents`) become shared block instances',
        '- Tokens from StyleTokens map onto `--sb-*` / theme bridge — no ad-hoc hex when tokens exist',
        '- Wireframe mode uses the **same** React components with greyscale placeholders',
      ].join('\n');
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

function cursorRules(target: PromptPackTarget, exp: SiteStudioExport): string {
  return [
    '---',
    `description: Site Studio build rules for ${exp.website.name} (${target})`,
    'alwaysApply: true',
    '---',
    '',
    stackConventions(target),
    '',
    styleTokensBlock(exp.styleTokens),
    '',
    '- Follow section order from per-page prompts exactly — do not add/remove sections.',
    '- Real copy from `copyOutline` / props; mark gaps as `TODO` — never invent brand claims.',
    '- SEO: only use fields present under ExportSeo; if missing, say so and leave placeholders.',
    `- Contract schemaVersion: ${exp.schemaVersion} (refuse unknown majors).`,
  ].join('\n');
}

function agentsMd(target: PromptPackTarget, exp: SiteStudioExport): string {
  return [
    `# AGENTS.md — ${exp.website.name}`,
    '',
    `Target stack: **${target}**`,
    '',
    'Generated from SiteStudioExport. Read `00-project-context.md` before building any page.',
    '',
    stackConventions(target),
    '',
    styleTokensBlock(exp.styleTokens),
    '',
    '## Rules',
    '',
    '- Use only contract data. If a field is marked not yet defined, do not hallucinate.',
    '- Mobile-first; verify key sections at 375px and 1440px.',
    '- Shared `componentKey` sections must stay visually identical across pages.',
  ].join('\n');
}

function projectContext(exp: SiteStudioExport): string {
  return [
    `# Project context — ${exp.website.name}`,
    '',
    `Generated: ${exp.generatedAt}`,
    `schemaVersion: ${exp.schemaVersion}`,
    exp.website.domain ? `Domain: ${exp.website.domain}` : 'Domain: _not set_',
    `Stack preference (brief): ${exp.website.stackPreference}`,
    '',
    briefSummary(exp),
    '',
    styleTokensBlock(exp.styleTokens),
    '',
    sitemapTable(exp),
    '',
    '## Content docs',
    '',
    exp.contentDocs.length
      ? exp.contentDocs.map((doc) => `- [${doc.title}](${doc.url})`).join('\n')
      : NOT_DEFINED,
  ].join('\n');
}

function seoForPage(
  exp: SiteStudioExport,
  page: ExportPage,
): ExportSeoPage | null {
  return exp.seo?.pages.find((item) => item.pageSlug === page.slug) ?? null;
}

function seoConstraints(seo: ExportSeoPage | null): string {
  if (!seo) {
    return ['## SEO constraints', '', NOT_DEFINED].join('\n');
  }

  const h1 =
    seo.headingOutline.find((item) => item.level === 1)?.text ??
    seo.headingOutline[0]?.text ??
    '';

  return [
    '## SEO constraints (E1)',
    '',
    `- **Status:** ${seo.status}`,
    `- **Title:** ${seo.meta.title || NOT_DEFINED}`,
    `- **Meta description:** ${seo.meta.description || NOT_DEFINED}`,
    `- **H1:** ${h1 || NOT_DEFINED}`,
    `- **Primary keyword:** ${seo.keywords.primary || NOT_DEFINED}`,
    `- **Secondary keywords:** ${
      seo.keywords.secondary.length
        ? seo.keywords.secondary.join(', ')
        : NOT_DEFINED
    }`,
    `- **Heading outline:** ${
      seo.headingOutline.length
        ? seo.headingOutline
            .map((item) => `H${item.level}: ${item.text}`)
            .join(' · ')
        : NOT_DEFINED
    }`,
    `- **Internal links:** ${
      seo.internalLinks.length
        ? seo.internalLinks
            .map(
              (link) =>
                `/${link.toSlug} (“${link.anchorSuggestion || link.toSlug}”)`,
            )
            .join('; ')
        : NOT_DEFINED
    }`,
    `- **Canonical rule:** ${seo.canonicalRule || NOT_DEFINED}`,
    `- **Slug rule:** ${seo.slugRule || NOT_DEFINED}`,
    `- **Schema types:** ${
      seo.schemaTypes.length ? seo.schemaTypes.join(', ') : NOT_DEFINED
    }`,
    `- **Indexable:** ${seo.technical.indexable ? 'yes' : 'no'}`,
    `- **OG image plan:** ${seo.technical.ogImagePlan || NOT_DEFINED}`,
    `- **GEO:** ${
      seo.geo.isLocationPage
        ? [
            'location page',
            seo.geo.nap ? `NAP ${seo.geo.nap}` : null,
            seo.geo.serviceArea.length
              ? `areas ${seo.geo.serviceArea.join(', ')}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : 'not a location page'
    }`,
    seo.aeo.answerBlocks.length
      ? [
          '- **Answer blocks (AEO):**',
          ...seo.aeo.answerBlocks.map(
            (block) => `  - Q: ${block.question}\n    A: ${block.draftAnswer}`,
          ),
        ].join('\n')
      : `- **Answer blocks (AEO):** ${NOT_DEFINED}`,
    `- **Entity notes:** ${seo.aeo.entityNotes || NOT_DEFINED}`,
    '',
    '## Structured data & llms.txt (E2)',
    '',
    '- Honour `seo/llms.txt` and `seo/json-ld-embeds.md` from this pack.',
    '- FAQPage JSON-LD must use approved answer blocks verbatim — do not paraphrase.',
    '- Keep Organization / Service / Place `@id`s stable across pages (entity graph).',
  ].join('\n');
}

function sectionBuildInstructions(
  section: ExportSectionInstance,
  target: PromptPackTarget,
  index: number,
): string {
  const lines = [
    `### ${index + 1}. ${section.sectionType} — \`${section.id}\``,
    '',
    `- **layoutPreset:** \`${section.layoutPreset}\``,
    `- **componentKey:** ${section.componentKey ? `\`${section.componentKey}\`` : NOT_DEFINED}`,
    `- **colorTag:** \`${section.colorTag}\``,
    `- **status:** ${section.status}`,
    '',
    '**Copy outline**',
    '',
    section.copyOutline.trim() || NOT_DEFINED,
    '',
    '**Props**',
    '',
    formatProps(section.props),
  ];

  if (target === 'webflow') {
    const name = (section.componentKey || section.sectionType || 'section')
      .replace(/^site-/, '')
      .replace(/[^a-z0-9_-]+/gi, '_');
    lines.push(
      '',
      '**Client-First scaffold**',
      '',
      '```',
      `section_${name}`,
      '  padding-global',
      '    container-large',
      '      padding-section-medium',
      `        ${name}_component`,
      '```',
      '',
      `Implement section \`${section.id}\` with Client-First classes as above. If \`componentKey\` is set, use/update the matching Webflow Component instead of duplicating.`,
    );
  }

  if (target === 'ozer_sites') {
    lines.push(
      '',
      '**@kit/site-blocks-core**',
      '',
      `- Resolve registry block for layoutPreset \`${section.layoutPreset}\`${
        section.componentKey
          ? ` / componentKey \`${section.componentKey}\``
          : ''
      } (see registry/site-blocks-registry.json)`,
      '- Pass typed props from the JSON above; do not invent prop keys',
    );
  }

  return lines.join('\n');
}

function pagePrompt(
  exp: SiteStudioExport,
  page: ExportPage,
  pageIndex: number,
  target: PromptPackTarget,
): string {
  const sections = page.sectionIds
    .map((id) => exp.sections.find((section) => section.id === id))
    .filter((section): section is ExportSectionInstance => Boolean(section));

  const seo = seoForPage(exp, page);

  return [
    `# Build prompt — ${page.title} (${pageRoute(page)})`,
    '',
    `Target: **${target}**`,
    `Page type: ${page.pageType} · Status: ${page.status}`,
    '',
    '## Page intent',
    '',
    page.description.trim() || NOT_DEFINED,
    '',
    seoConstraints(seo),
    '',
    '## Sections (build in this exact order)',
    '',
    sections.length
      ? sections
          .map((section, index) =>
            sectionBuildInstructions(section, target, index),
          )
          .join('\n\n')
      : NOT_DEFINED,
    '',
    '## Acceptance',
    '',
    '- Every section present, in order, responsive at 375 / 768 / 1440.',
    '- Copy from outlines / props only; mark gaps with TODO.',
    '- Tokens used exclusively when defined; otherwise leave token TODOs — do not invent a palette.',
    '- SEO fields applied only when listed above as defined.',
    pageIndex === 0
      ? '- Home / first page must establish brand + primary conversion goal from the brief.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function webflowSectionFile(
  page: ExportPage,
  section: ExportSectionInstance,
  index: number,
): PromptPackFile {
  const name = slugifyFile(
    section.componentKey || section.sectionType || 'section',
  );
  const content = [
    `# Implement section ${index + 1} — ${page.title} / ${section.sectionType}`,
    '',
    `Page: \`${pageRoute(page)}\` · Section id: \`${section.id}\``,
    '',
    `Implement section **${section.sectionType}** with Client-First classes.`,
    '',
    sectionBuildInstructions(section, 'webflow', index),
  ].join('\n');

  return {
    path: `webflow/sections/${String(index + 1).padStart(2, '0')}-${slugifyFile(page.slug)}-${name}.md`,
    content,
  };
}

/**
 * Generate the Cursor / Claude prompt pack from a SiteStudioExport.
 * Never reads the database — contract data only.
 */
export function generatePromptPack(
  exp: SiteStudioExport,
  target: PromptPackTarget,
  options?: SeoGeneratorOptions,
): PromptPack {
  assertCompatibleExportSchemaVersion(exp.schemaVersion);

  const files: PromptPackFile[] = [
    { path: '00-project-context.md', content: projectContext(exp) },
    { path: 'AGENTS.md', content: agentsMd(target, exp) },
    {
      path: '.cursor/rules/site-studio.mdc',
      content: cursorRules(target, exp),
    },
    {
      path: 'seo/llms.txt',
      content: generateLlmsTxt(exp, options),
    },
    {
      path: 'seo/json-ld-embeds.md',
      content: jsonLdEmbedDocument(exp),
    },
    {
      path: 'seo/json-ld.json',
      content: `${JSON.stringify(generateJsonLd(exp), null, 2)}\n`,
    },
  ];

  exp.sitemap.forEach((page, index) => {
    const n = String((index + 1) * 10);
    files.push({
      path: `pages/${n}-${slugifyFile(page.slug)}.md`,
      content: pagePrompt(exp, page, index, target),
    });
  });

  if (target === 'webflow') {
    for (const page of exp.sitemap) {
      const sections = page.sectionIds
        .map((id) => exp.sections.find((section) => section.id === id))
        .filter((section): section is ExportSectionInstance =>
          Boolean(section),
        );

      sections.forEach((section, index) => {
        files.push(webflowSectionFile(page, section, index));
      });
    }
  }

  if (target === 'ozer_sites') {
    files.push({
      path: 'registry/site-blocks-registry.json',
      content: `${JSON.stringify(siteBlocksRegistry, null, 2)}\n`,
    });
    files.push({
      path: 'registry/README.md',
      content: [
        '# @kit/site-blocks-core registry',
        '',
        'Machine-readable block catalog generated from `buildConfig()`.',
        'Each block lists `name`, `layoutPreset`, `propsSchema`, `defaultProps`, and `intendedUse`.',
        '',
        'Resolve export sections:',
        '',
        '1. Prefer `layoutPreset` on the section',
        '2. Else map legacy library keys via LEGACY_LIBRARY_KEY_TO_PRESET',
        '3. Instantiate the PascalCase `name` from the registry with typed props',
        '',
      ].join('\n'),
    });
  }

  return { files };
}
