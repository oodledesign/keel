import { buildAstroPack } from './astro-pack';
import { buildFigmaOutline, buildFigmaTokens } from './figma-tokens';
import { buildNextPack } from './next-pack';
import { buildPromptPack } from './prompt-pack';
import { buildJsonLd, buildLlmsTxt, buildSeoPlan } from './seo-artifacts';
import type { WebsiteExportFile, WebsiteExportInput } from './types';
import { buildWebflowGuide } from './webflow-client-first';

export type { WebsiteExportFile, WebsiteExportInput } from './types';

export type WebsiteExportTarget = 'webflow' | 'astro' | 'next';

export type WebsiteExportPack = {
  target: WebsiteExportTarget;
  files: WebsiteExportFile[];
};

/**
 * Build the full export pack for a target stack. Always includes SEO
 * artefacts, Figma tokens/outline, and the Cursor/Claude prompt pack.
 */
export function buildWebsiteExportPack(
  input: WebsiteExportInput,
  target: WebsiteExportTarget,
): WebsiteExportPack {
  const files: WebsiteExportFile[] = [];

  if (target === 'webflow') {
    files.push(buildWebflowGuide(input));
  } else if (target === 'astro') {
    files.push(...buildAstroPack(input));
  } else {
    files.push(...buildNextPack(input));
  }

  files.push(...buildPromptPack(input, target));
  files.push(buildSeoPlan(input));
  files.push(buildLlmsTxt(input));
  files.push(buildJsonLd(input));
  files.push(buildFigmaTokens(input));
  files.push(buildFigmaOutline(input));

  return { target, files };
}

/** Single-file bundle (markdown) for quick download/copy of the whole pack. */
export function bundleExportPack(pack: WebsiteExportPack): string {
  const header = `# Site Studio export pack (${pack.target})\n\nGenerated ${new Date().toISOString().slice(0, 10)} — each file below is delimited by its path.\n`;

  const body = pack.files
    .map(
      (file) =>
        `\n\n---\n\n## \`${file.path}\`\n\n\`\`\`${file.language}\n${file.content}\n\`\`\``,
    )
    .join('');

  return header + body;
}
