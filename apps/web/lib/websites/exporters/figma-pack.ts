/**
 * Figma bridge pack — Tier 0 (Prompt D3).
 *
 * SiteStudioExport only — never reads the database.
 * Does NOT include a Figma plugin (explicitly out of scope).
 *
 * Tokens: emit Tokens Studio DTCG + legacy multi-set envelopes, and a plain
 * documented StyleTokens JSON (labelled fallback).
 */
import {
  type ExportPage,
  type ExportSectionInstance,
  type SiteStudioExport,
  type StyleTokens,
  assertCompatibleExportSchemaVersion,
} from '../export-contract';
import {
  type ExportPackFile,
  pageRoute,
  projectSlug,
  resolvePackTokens,
  sectionsForPage,
  slugify,
} from './pack-utils';

export type FigmaPackOptions = {
  /** Optional PNG screenshots keyed by page slug (Tier 0 PNG stack). */
  pagePngs?: Record<string, Uint8Array>;
  /** Absolute chrome-less import URLs keyed by page slug (Tier 1). */
  importUrls?: Record<string, string>;
};

export type FigmaPack = {
  files: ExportPackFile[];
};

function colorToken(hex: string, description?: string) {
  return {
    $type: 'color' as const,
    $value: hex,
    ...(description ? { $description: description } : {}),
  };
}

function legacyColor(hex: string, description?: string) {
  return {
    type: 'color' as const,
    value: hex,
    ...(description ? { description } : {}),
  };
}

/** W3C DTCG token tree — import in Tokens Studio with Token Format = W3C DTCG. */
function tokensStudioDtcg(tokens: StyleTokens, websiteName: string) {
  const neutrals = Object.fromEntries(
    tokens.colors.neutrals.map((hex, index) => [
      `neutral-${index}`,
      colorToken(hex, `Neutral step ${index} (light → dark)`),
    ]),
  );

  return {
    $description: `Ozer Site Studio → Tokens Studio (W3C DTCG). Website: ${websiteName}. Set plugin Token Format to “W3C DTCG” before import.`,
    color: {
      primary: colorToken(tokens.colors.primary, 'Brand primary'),
      secondary: colorToken(tokens.colors.secondary, 'Brand secondary'),
      accent: colorToken(tokens.colors.accent, 'Accent / highlights'),
      success: colorToken(tokens.colors.success),
      warning: colorToken(tokens.colors.warning),
      danger: colorToken(tokens.colors.danger),
      ...neutrals,
    },
    fontFamilies: {
      display: {
        $type: 'fontFamilies' as const,
        $value: tokens.typography.displayFamily || 'system-ui',
      },
      body: {
        $type: 'fontFamilies' as const,
        $value: tokens.typography.bodyFamily || 'system-ui',
      },
    },
    fontWeights: {
      regular: {
        $type: 'fontWeights' as const,
        $value: String(tokens.typography.weights.regular),
      },
      medium: {
        $type: 'fontWeights' as const,
        $value: String(tokens.typography.weights.medium),
      },
      bold: {
        $type: 'fontWeights' as const,
        $value: String(tokens.typography.weights.bold),
      },
    },
    fontSize: {
      base: {
        $type: 'fontSizes' as const,
        $value: `${tokens.typography.typeScale.base}px`,
      },
    },
    dimension: {
      radiusNone: {
        $type: 'dimension' as const,
        $value: tokens.radius.none,
      },
      radiusSm: { $type: 'dimension' as const, $value: tokens.radius.sm },
      radiusMd: { $type: 'dimension' as const, $value: tokens.radius.md },
      radiusLg: { $type: 'dimension' as const, $value: tokens.radius.lg },
      radiusFull: {
        $type: 'dimension' as const,
        $value: tokens.radius.full,
      },
    },
    spacingDensity: {
      $type: 'other' as const,
      $value: tokens.spacingDensity,
      $description: 'Site Studio spacing density enum',
    },
    buttons: {
      style: {
        $type: 'other' as const,
        $value: tokens.buttons.style,
        $description: 'pill | rounded | square',
      },
    },
  };
}

/**
 * Tokens Studio legacy multi-set envelope (default plugin format).
 * Uses `value`/`type` keys + `$themes` / `$metadata`.
 */
function tokensStudioLegacy(tokens: StyleTokens, websiteName: string) {
  const neutrals = Object.fromEntries(
    tokens.colors.neutrals.map((hex, index) => [
      `neutral-${index}`,
      legacyColor(hex, `Neutral step ${index}`),
    ]),
  );

  return {
    global: {
      color: {
        primary: legacyColor(tokens.colors.primary, 'Brand primary'),
        secondary: legacyColor(tokens.colors.secondary),
        accent: legacyColor(tokens.colors.accent),
        success: legacyColor(tokens.colors.success),
        warning: legacyColor(tokens.colors.warning),
        danger: legacyColor(tokens.colors.danger),
        ...neutrals,
      },
      fontFamilies: {
        display: {
          type: 'fontFamilies',
          value: tokens.typography.displayFamily || 'system-ui',
        },
        body: {
          type: 'fontFamilies',
          value: tokens.typography.bodyFamily || 'system-ui',
        },
      },
      fontWeights: {
        regular: {
          type: 'fontWeights',
          value: String(tokens.typography.weights.regular),
        },
        medium: {
          type: 'fontWeights',
          value: String(tokens.typography.weights.medium),
        },
        bold: {
          type: 'fontWeights',
          value: String(tokens.typography.weights.bold),
        },
      },
      fontSize: {
        base: {
          type: 'fontSizes',
          value: `${tokens.typography.typeScale.base}px`,
        },
      },
      borderRadius: {
        none: { type: 'borderRadius', value: tokens.radius.none },
        sm: { type: 'borderRadius', value: tokens.radius.sm },
        md: { type: 'borderRadius', value: tokens.radius.md },
        lg: { type: 'borderRadius', value: tokens.radius.lg },
        full: { type: 'borderRadius', value: tokens.radius.full },
      },
      spacingDensity: {
        type: 'other',
        value: tokens.spacingDensity,
        description: `Generated for ${websiteName}`,
      },
      buttons: {
        style: { type: 'other', value: tokens.buttons.style },
      },
    },
    $themes: [],
    $metadata: {
      tokenSetOrder: ['global'],
      generatedBy: 'ozer-site-studio',
      note: 'Tokens Studio LEGACY format (value/type). Prefer if plugin Token Format is still “legacy”.',
    },
  };
}

function plainDocumentedTokens(tokens: StyleTokens, websiteName: string) {
  return {
    $label: 'PLAIN DOCUMENTED FALLBACK — not Tokens Studio native',
    $description:
      'Raw Site Studio StyleTokens (Prompt D1). Use this only if DTCG/legacy imports fail; map manually into Figma variables.',
    website: websiteName,
    tokens,
  };
}

function tokensReadme(): string {
  return `# Style tokens for Tokens Studio

This pack ships **three** JSON shapes so import succeeds regardless of plugin settings.

| File | Format | When to use |
| --- | --- | --- |
| \`tokens-studio.legacy.json\` | Tokens Studio **legacy** multi-set (\`value\` / \`type\` + \`$metadata\`) | Default plugin Token Format = **legacy** (most installs) |
| \`tokens-studio.dtcg.json\` | **W3C DTCG** (\`$value\` / \`$type\`) | Plugin Token Format switched to **W3C DTCG** |
| \`style-tokens.plain.json\` | Documented plain StyleTokens | **Fallback** if either import errors — map manually |

## Import steps (Tokens Studio)

1. Open Tokens Studio in Figma.
2. Check **Settings → Token Format** (legacy vs W3C DTCG).
3. Import the matching file above (Create new token set / sync from JSON as your workflow prefers).
4. If import errors, open \`style-tokens.plain.json\` and create variables from \`tokens.colors\` / \`tokens.typography\` / \`tokens.radius\`.

No Figma plugin is included — that remains a later project.
`;
}

function pageOutline(
  exp: SiteStudioExport,
  importUrls: Record<string, string>,
): string {
  const lines: string[] = [
    `# Figma page / section outline — ${exp.website.name}`,
    '',
    'Build **one desktop frame (1440px wide)** per page. Stack sections top → bottom.',
    'Import tokens first (`tokens-studio.*.json`), then place copy as real text layers.',
    '',
  ];

  for (const page of exp.sitemap) {
    const sections = sectionsForPage(page, exp.sections);
    const importUrl = importUrls[page.slug];

    lines.push(`## ${page.title} (\`${pageRoute(page)}\`)`, '');
    if (importUrl) {
      lines.push(`- **html.to.design URL:** \`${importUrl}\``, '');
    }
    if (!sections.length) {
      lines.push('_No sections exported for this page._', '');
      continue;
    }
    for (const section of sections) {
      lines.push(
        `### ${section.sectionType} — \`${section.id}\``,
        `- layoutPreset: \`${section.layoutPreset}\``,
        section.componentKey
          ? `- componentKey: \`${section.componentKey}\``
          : null,
        `- colorTag: \`${section.colorTag}\``,
        '',
        'Copy outline:',
        '',
        '```',
        section.copyOutline.trim() || '(empty)',
        '```',
        '',
      );
    }
  }

  return lines.filter((line) => line !== null).join('\n');
}

function buildFramesPrompt(exp: SiteStudioExport): string {
  const tokens = resolvePackTokens(exp.styleTokens);
  return [
    `# Build these frames in Figma from tokens — ${exp.website.name}`,
    '',
    'Use with an AI Figma assistant or a human designer after importing Tokens Studio JSON.',
    '',
    '## Constraints',
    '',
    `- Primary \`${tokens.colors.primary}\` for CTAs; accent \`${tokens.colors.accent}\` for highlights only.`,
    `- Display font: **${tokens.typography.displayFamily}**; body: **${tokens.typography.bodyFamily}**.`,
    `- Radius scale: sm/md/lg = ${tokens.radius.sm} / ${tokens.radius.md} / ${tokens.radius.lg}; buttons style: **${tokens.buttons.style}**.`,
    `- Spacing density: **${tokens.spacingDensity}**.`,
    tokens.photographyDirection
      ? `- Photography direction: ${tokens.photographyDirection}`
      : '- Photography: placeholder greys until art direction is set.',
    '',
    '## Method',
    '',
    '1. Import `tokens-studio.legacy.json` or `tokens-studio.dtcg.json` (match plugin Token Format).',
    '2. Create one frame per page listed in `PAGE-OUTLINE.md` at 1440×auto.',
    '3. For each section, create an auto-layout frame using the layoutPreset hint.',
    '4. Place copyOutline text as editable text layers — never flatten to outlines.',
    '5. Optional: use Tier 1 chrome-less URLs with the **html.to.design** plugin to seed editable layers, then restyle with tokens.',
    '',
    '## Pages',
    '',
    ...exp.sitemap.map(
      (page) =>
        `- **${page.title}** (\`${pageRoute(page)}\`) — ${page.description || 'no description'}`,
    ),
    '',
  ].join('\n');
}

function pngStackReadme(
  exp: SiteStudioExport,
  hasAnyPng: boolean,
  importUrls: Record<string, string>,
): string {
  return [
    `# Wireframe PNG stack`,
    '',
    hasAnyPng
      ? 'PNGs below were captured server-side from the chrome-less wireframe render (Puck in wireframe mode).'
      : 'No PNGs were captured in this zip (Playwright/Chromium unavailable in this runtime). Use the Tier 1 URLs below with html.to.design, or re-generate the pack where `playwright` is installed.',
    '',
    '## Capture notes',
    '',
    '- Source: headless render route guarded by a `website_shares` token (`wireframes` scope or broader).',
    '- Screenshot helper: Playwright Chromium in Node server/queue context (not Edge).',
    '- Re-run pack generation after `pnpm exec playwright install chromium` on a long-lived Node host to fill `figma/png/*.png`.',
    '',
    '## Pages',
    '',
    ...exp.sitemap.map((page) => {
      const url = importUrls[page.slug] ?? '_url not provisioned_';
      return `- \`${slugify(page.slug)}.png\` ← ${url}`;
    }),
    '',
  ].join('\n');
}

function packReadme(
  exp: SiteStudioExport,
  importUrls: Record<string, string>,
): string {
  const hasUrls = Object.keys(importUrls).length > 0;
  return [
    `# Figma bridge — ${exp.website.name}`,
    '',
    'Tier 0 (this zip) + Tier 1 (chrome-less URLs). **No Figma plugin is included** — a plugin remains a later project.',
    '',
    '## Tier 0 — this zip',
    '',
    '| Path | Purpose |',
    '| --- | --- |',
    '| `TOKENS-README.md` | Which token JSON to import |',
    '| `tokens-studio.legacy.json` | Tokens Studio legacy multi-set |',
    '| `tokens-studio.dtcg.json` | Tokens Studio W3C DTCG |',
    '| `style-tokens.plain.json` | Labelled plain fallback |',
    '| `PAGE-OUTLINE.md` | Page / section outline |',
    '| `BUILD-FRAMES.md` | “Build these frames from tokens” prompt |',
    '| `png/` | Wireframe PNG stack (when Playwright captured) |',
    '',
    '## Tier 1 — html.to.design',
    '',
    hasUrls
      ? [
          '1. Open Figma → run the **html.to.design** plugin.',
          '2. Paste a chrome-less page URL from Export → Figma card (or below).',
          '3. Import → editable layers. Restyle with imported tokens.',
          '',
          '### Import URLs',
          '',
          ...exp.sitemap.map((page) => {
            const url = importUrls[page.slug];
            return url
              ? `- **${page.title}:** ${url}`
              : `- **${page.title}:** _(generate / ensure wireframes share)_`;
          }),
        ].join('\n')
      : 'Generate the Figma card in Site Studio Export to mint a wireframes-scope share and copy per-page import URLs.',
    '',
    `Contract schemaVersion: \`${exp.schemaVersion}\` · Generated: ${exp.generatedAt}`,
    '',
  ].join('\n');
}

/**
 * Build Tier 0 Figma pack files from SiteStudioExport.
 */
export function generateFigmaPack(
  exp: SiteStudioExport,
  options: FigmaPackOptions = {},
): FigmaPack {
  assertCompatibleExportSchemaVersion(exp.schemaVersion);

  const tokens = resolvePackTokens(exp.styleTokens);
  const importUrls = options.importUrls ?? {};
  const pagePngs = options.pagePngs ?? {};
  const files: ExportPackFile[] = [];

  files.push({ path: 'README.md', content: packReadme(exp, importUrls) });
  files.push({ path: 'TOKENS-README.md', content: tokensReadme() });
  files.push({
    path: 'tokens-studio.legacy.json',
    content: `${JSON.stringify(tokensStudioLegacy(tokens, exp.website.name), null, 2)}\n`,
  });
  files.push({
    path: 'tokens-studio.dtcg.json',
    content: `${JSON.stringify(tokensStudioDtcg(tokens, exp.website.name), null, 2)}\n`,
  });
  files.push({
    path: 'style-tokens.plain.json',
    content: `${JSON.stringify(plainDocumentedTokens(tokens, exp.website.name), null, 2)}\n`,
  });
  files.push({
    path: 'PAGE-OUTLINE.md',
    content: pageOutline(exp, importUrls),
  });
  files.push({
    path: 'BUILD-FRAMES.md',
    content: buildFramesPrompt(exp),
  });

  const pngSlugs = Object.keys(pagePngs);
  files.push({
    path: 'png/README.md',
    content: pngStackReadme(exp, pngSlugs.length > 0, importUrls),
  });

  for (const [slug, bytes] of Object.entries(pagePngs)) {
    files.push({
      path: `png/${slugify(slug)}.png`,
      content: bytes,
    });
  }

  return { files };
}

export function figmaPackZipFilename(websiteName: string): string {
  return `${projectSlug(websiteName)}-figma-bridge.zip`;
}
