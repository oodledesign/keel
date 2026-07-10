import { emptyWebsiteStyleSystem } from '../planning-types';
import type { WebsiteExportFile, WebsiteExportInput } from './types';
import { pageRoute } from './types';

/** Style tokens JSON (design-token-ish shape Figma plugins can import). */
export function buildFigmaTokens(input: WebsiteExportInput): WebsiteExportFile {
  const style = input.style ?? emptyWebsiteStyleSystem();
  const { tokens } = style;

  const payload = {
    $description: `Style tokens for ${input.websiteName} — exported from Ozer Site Studio`,
    color: {
      canvas: { $type: 'color', $value: tokens.canvas },
      atmosphere: { $type: 'color', $value: tokens.atmosphere },
      accent: { $type: 'color', $value: tokens.accent },
      contrast: { $type: 'color', $value: tokens.contrast },
      secondary: { $type: 'color', $value: tokens.secondary },
    },
    typography: {
      headingFont: { $type: 'fontFamily', $value: tokens.headingFont || 'TBD' },
      bodyFont: { $type: 'fontFamily', $value: tokens.bodyFont || 'TBD' },
      scale: { $type: 'string', $value: tokens.typeScale },
    },
    shape: {
      radius: { $type: 'string', $value: tokens.radius },
      spacingDensity: { $type: 'string', $value: tokens.spacingDensity },
    },
    imagery: {
      photographyDirection: {
        $type: 'string',
        $value: tokens.photographyDirection,
      },
    },
  };

  return {
    path: 'figma/style-tokens.json',
    language: 'json',
    content: JSON.stringify(payload, null, 2) + '\n',
  };
}

/** Page/section outline + prompt for building frames in Figma from tokens. */
export function buildFigmaOutline(input: WebsiteExportInput): WebsiteExportFile {
  const lines: string[] = [
    `# Figma build outline — ${input.websiteName}`,
    '',
    'Import `style-tokens.json` (Tokens Studio or variables), then build one frame per page below.',
    'Each section lists the wireframe layout and copy outline to place.',
    '',
  ];

  for (const page of input.sitemap) {
    const wireframe = input.wireframes.find((item) => item.pageId === page.id);
    lines.push(`## ${page.title} (${pageRoute(page)})`, '');
    if (!wireframe || wireframe.sections.length === 0) {
      lines.push('_No wireframe yet._', '');
      continue;
    }
    for (const section of wireframe.sections) {
      lines.push(
        `### ${section.title}`,
        `- Layout: ${section.layout}${section.libraryKey ? ` (library: ${section.libraryKey})` : ''}`,
      );
      if (section.copyOutline) {
        lines.push(`- Copy outline:`, '', '```', section.copyOutline, '```');
      }
      if (section.contentNotes) {
        lines.push(`- Notes: ${section.contentNotes.replace(/\n+/g, ' ')}`);
      }
      lines.push('');
    }
  }

  lines.push(
    '---',
    '',
    '**Prompt for an AI Figma assistant:**',
    '',
    '> Build desktop frames (1440px) for each page above using the imported style tokens.',
    '> Use the canvas colour for page backgrounds, atmosphere for alternating section backgrounds,',
    '> accent only for buttons and highlights, and contrast for all text.',
    '> Follow the layout hints per section and place the copy outlines as real text layers.',
    '',
  );

  return {
    path: 'figma/build-outline.md',
    language: 'markdown',
    content: lines.join('\n'),
  };
}
