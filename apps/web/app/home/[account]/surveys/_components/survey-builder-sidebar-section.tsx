'use client';

import type { ReactNode } from 'react';

import { ChevronDown } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';

import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

export function SurveyBuilderSidebarSection({
  title,
  meta,
  defaultOpen = false,
  testId,
  children,
}: {
  title: string;
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
        <span className="text-xs font-semibold text-[var(--workspace-shell-text)]">
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
