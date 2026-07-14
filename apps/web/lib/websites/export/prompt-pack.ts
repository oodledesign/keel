import { emptyWebsiteBrief, emptyWebsiteStyleSystem } from '../planning-types';
import { findSectionLibraryEntry } from '../section-library';
import type { WebsiteExportFile, WebsiteExportInput } from './types';
import { pageRoute } from './types';

type TargetStack = 'webflow' | 'astro' | 'next';

function briefSummary(input: WebsiteExportInput): string {
  const brief = input.brief ?? emptyWebsiteBrief();
  return [
    `Business: ${brief.org.name || input.websiteName}. ${brief.org.oneLiner}`,
    `Sector: ${brief.org.sector}`,
    `Offer: ${brief.offer.services.map((s) => s.name).join(', ') || 'TBD'}`,
    `Audience: ${brief.audience.segments.map((s) => s.name).join(', ')}`,
    brief.org.geography ? `Geography: ${brief.org.geography}` : '',
    `Tone: ${brief.brand.tone.join(', ')}`,
    `Conversion goals: ${brief.offer.primaryConversionGoals.join('; ')}`,
    brief.brand.constraints.length
      ? `Constraints: ${brief.brand.constraints.join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function tokensSummary(input: WebsiteExportInput): string {
  const { tokens } = input.style ?? emptyWebsiteStyleSystem();
  return [
    `Canvas ${tokens.canvas} · Atmosphere ${tokens.atmosphere} · Accent ${tokens.accent} · Contrast ${tokens.contrast} · Secondary ${tokens.secondary}`,
    `Heading font: ${tokens.headingFont || 'TBD'} · Body font: ${tokens.bodyFont || 'TBD'}`,
    `Type scale: ${tokens.typeScale} · Radius: ${tokens.radius} · Spacing: ${tokens.spacingDensity}`,
    tokens.photographyDirection
      ? `Photography: ${tokens.photographyDirection}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Cursor/Claude prompt pack: per-page build prompts + repo rules snippet. */
export function buildPromptPack(
  input: WebsiteExportInput,
  target: TargetStack,
): WebsiteExportFile[] {
  const files: WebsiteExportFile[] = [];

  const stackLine =
    target === 'webflow'
      ? 'Target: Webflow using Finsweet Client-First 3.0 class conventions (see webflow/client-first-guide.md).'
      : target === 'astro'
        ? 'Target: Astro with content collections (starter files in astro/).'
        : 'Target: Next.js App Router + Tailwind (starter files in next/).';

  const agentsMd = `# AGENTS.md — ${input.websiteName}

${stackLine}

## Project context

${briefSummary(input)}

## Design system (locked — do not improvise)

${tokensSummary(input)}

Rules:
- Use ONLY the design tokens above (CSS variables provided in the pack). Never introduce new colours.
- Accent colour is for buttons/highlights only; never large surfaces.
- One heading font + one body font. Hierarchy via size and weight, not new fonts.
- Every page must include the meta title/description and JSON-LD from the SEO plan.
- Mobile-first responsive; check every section at 375px and 1440px.
- Real copy from the outlines — never lorem ipsum.
`;

  files.push({
    path: 'prompts/AGENTS.md',
    language: 'markdown',
    content: agentsMd,
  });

  files.push({
    path: 'prompts/.cursor/rules/site-build.mdc',
    language: 'markdown',
    content: `---
description: Build rules for ${input.websiteName}
alwaysApply: true
---

${stackLine}

${tokensSummary(input)}

- Use the design tokens as CSS variables; never hard-code other colours.
- Follow the section structure from the wireframes exactly — do not add or remove sections.
- Include per-page SEO metadata and JSON-LD from seo/seo-plan.md.
- No lorem ipsum: use the copy outlines and flag gaps as TODO comments.
`,
  });

  for (const page of input.sitemap) {
    const wireframe = input.wireframes.find((item) => item.pageId === page.id);
    const seo = input.seoPages[page.id];

    const sectionLines = (wireframe?.sections ?? []).map((section) => {
      const entry = findSectionLibraryEntry(section.libraryKey);
      return [
        `### ${section.title} (${entry?.label ?? section.layout})`,
        entry ? `Layout: ${entry.hint}` : `Layout: ${section.layout}`,
        section.copyOutline ? `Copy outline:\n${section.copyOutline}` : '',
        section.contentNotes ? `Notes: ${section.contentNotes}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    });

    const webflowExtra =
      target === 'webflow'
        ? '\nImplement with Client-First classes: `section_[name]` > `padding-global` > `container-large` > `padding-section-medium` > `[name]_component`. Shared header/footer/CTA must be Webflow Components.'
        : '';

    const prompt = `# Build prompt — ${page.title} (${pageRoute(page)})

${stackLine}

## Context

${briefSummary(input)}

## Design tokens

${tokensSummary(input)}

## Page goal

${page.description || page.seoIntent || `The ${page.title} page.`}

## SEO constraints

- Title: ${seo?.title || page.title}
- Meta description: ${seo?.metaDescription || 'TBD'}
- H1: ${seo?.h1 || page.title}
${seo?.primaryKeyword ? `- Primary keyword: ${seo.primaryKeyword}` : ''}
${seo?.schemaTypes?.length ? `- JSON-LD types: ${seo.schemaTypes.join(', ')}` : ''}

## Sections (build in this exact order)

${sectionLines.join('\n\n') || 'No wireframe sections — check the Wireframes tab first.'}
${webflowExtra}

## Acceptance

- Every section present, in order, responsive at 375/768/1440.
- Copy from outlines placed as real text (mark gaps with TODO).
- Tokens used exclusively; no new colours or fonts.
`;

    files.push({
      path: `prompts/pages/${page.slug || 'page'}.md`,
      language: 'markdown',
      content: prompt,
    });
  }

  return files;
}
