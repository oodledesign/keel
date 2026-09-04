'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

export function CampaignPreviewDialog({
  open,
  onOpenChange,
  html,
  previewWidth,
  onPreviewWidthChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  previewWidth: 'desktop' | 'mobile';
  onPreviewWidthChange: (width: 'desktop' | 'mobile') => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
        data-test="campaign-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle className={workspaceText}>Email preview</DialogTitle>
          <DialogDescription className={workspaceTextMuted}>
            Sample recipient · branded with workspace logo and colours
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 pb-2">
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${
              previewWidth === 'desktop' ? workspaceText : workspaceTextMuted
            }`}
            onClick={() => onPreviewWidthChange('desktop')}
          >
            Desktop
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${
              previewWidth === 'mobile' ? workspaceText : workspaceTextMuted
            }`}
            onClick={() => onPreviewWidthChange('mobile')}
          >
            Mobile
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[color:var(--workspace-shell-border)] bg-white">
          <iframe
            title="Campaign preview"
            className="mx-auto h-[70vh] bg-white"
            sandbox=""
            style={{
              width: previewWidth === 'mobile' ? 375 : '100%',
              maxWidth: '100%',
            }}
            srcDoc={html}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
