'use client';

import type { ReactNode } from 'react';

import { ChevronDown, type LucideIcon } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';

import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

export function SurveyBuilderSidebarSection({
  title,
  icon: Icon,
  meta,
  defaultOpen = false,
  testId,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  meta?: ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={`${workspacePanelCard} group/section overflow-hidden`}
      data-test={testId}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--workspace-shell-panel-hover)]">
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--workspace-shell-text)]">
          {Icon ? (
            <Icon
              className={`h-3.5 w-3.5 shrink-0 ${workspaceTextMuted}`}
              aria-hidden
            />
          ) : null}
          {title}
        </span>
        <span className="flex items-center gap-2">
          {meta ? (
            <span className={`text-[11px] ${workspaceTextMuted}`}>{meta}</span>
          ) : null}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/section:rotate-180 ${workspaceTextMuted}`}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out border-t border-[color:var(--workspace-shell-border)] duration-150">
        <div className="p-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
