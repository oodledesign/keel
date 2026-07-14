'use client';

import type { CSSProperties } from 'react';

import {
  Render,
  type ResolvableStyleTokens,
  type SiteBlockLayoutPreset,
  WireframeModeProvider,
  buildConfig,
  resolveLayoutPreset,
  resolveTokensStyle,
  sectionsToPuckData,
} from '@kit/site-blocks-core';
import '@kit/site-blocks-core/tokens.css';
import { cn } from '@kit/ui/utils';

import type { WebsiteWireframeSection } from '~/lib/websites/planning-types';

const puckConfig = buildConfig();

export function WireframePuckPage({
  sections,
  className,
  wireframe = true,
  styleTokens,
  chromeLess = false,
}: {
  sections: WebsiteWireframeSection[];
  className?: string;
  wireframe?: boolean;
  /** When set (and not wireframe), apply brand tokens via resolveTokens. */
  styleTokens?: ResolvableStyleTokens | null;
  /** Strip card chrome for html.to.design / screenshot capture. */
  chromeLess?: boolean;
}) {
  const data = sectionsToPuckData(
    sections.map((section) => ({
      id: section.id,
      title: section.title,
      layoutPreset: section.layoutPreset,
      libraryKey: section.libraryKey,
      layout: section.layout,
      copyOutline: section.copyOutline,
      contentNotes: section.contentNotes,
      copy: section.copy,
    })),
  );

  const tokenStyle = (
    !wireframe && styleTokens
      ? resolveTokensStyle(styleTokens)
      : {
          ['--sb-canvas' as string]: 'var(--ozer-surface-canvas, #f7f6f3)',
          ['--sb-surface' as string]: 'var(--ozer-surface-elevated, #ffffff)',
          ['--sb-atmosphere' as string]:
            'var(--workspace-shell-sidebar-accent, #efeee9)',
          ['--sb-ink' as string]: 'var(--workspace-shell-text, #1c1b1a)',
          ['--sb-ink-muted' as string]:
            'var(--workspace-shell-text-muted, #6b6862)',
          ['--sb-border' as string]: 'var(--workspace-shell-border, #d9d6cf)',
          ['--sb-accent' as string]: 'var(--ozer-accent, #2f5d50)',
          ['--sb-color-primary' as string]: 'var(--ozer-accent, #2f5d50)',
          ['--sb-color-primary-contrast' as string]:
            'var(--ozer-accent-foreground, #ffffff)',
        }
  ) as CSSProperties;

  return (
    <WireframeModeProvider wireframe={wireframe}>
      <div
        className={cn(
          'sb-root overflow-hidden',
          !chromeLess &&
            'rounded-[var(--sb-radius-lg)] border border-[var(--sb-border)] shadow-sm',
          wireframe && 'sb-wireframe',
          className,
        )}
        style={tokenStyle}
      >
        <Render config={puckConfig} data={data} metadata={{ wireframe }} />
      </div>
    </WireframeModeProvider>
  );
}

export function resolveSectionLayoutPreset(
  section: Pick<
    WebsiteWireframeSection,
    'layoutPreset' | 'libraryKey' | 'layout'
  > & { sectionType?: string | null },
): SiteBlockLayoutPreset {
  return resolveLayoutPreset({
    layoutPreset: section.layoutPreset,
    libraryKey: section.libraryKey,
    layout: section.layout,
    sectionType: section.sectionType,
  });
}
