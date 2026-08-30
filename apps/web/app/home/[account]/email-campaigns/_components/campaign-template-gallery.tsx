'use client';

import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Badge } from '@kit/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import type {
  CampaignBrand,
  CampaignDocument,
} from '~/lib/campaigns/campaign-document';
import {
  type CampaignTemplateDefinition,
  type CampaignTemplateWorkspace,
  campaignTemplateAudienceLabel,
  instantiateCampaignTemplate,
  listCampaignTemplates,
} from '~/lib/campaigns/templates';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

export function CampaignTemplateGallery({
  open,
  onOpenChange,
  brand,
  workspace,
  requireConfirm,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: CampaignBrand;
  workspace: CampaignTemplateWorkspace;
  requireConfirm?: boolean;
  onSelect: (input: {
    template: CampaignTemplateDefinition;
    document: CampaignDocument;
  }) => void;
}) {
  const templates = listCampaignTemplates(workspace);
  const [pending, setPending] = useState<CampaignTemplateDefinition | null>(
    null,
  );

  function apply(template: CampaignTemplateDefinition) {
    onSelect({
      template,
      document: instantiateCampaignTemplate(template, brand),
    });
    setPending(null);
    onOpenChange(false);
  }

  function onPick(template: CampaignTemplateDefinition) {
    if (requireConfirm) {
      onOpenChange(false);
      setPending(template);
      return;
    }
    apply(template);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-4xl"
          data-test="campaign-template-gallery"
        >
          <DialogHeader>
            <DialogTitle>Choose a starting email</DialogTitle>
            <DialogDescription>
              Templates use your workspace logo and colours. Every block stays
              editable after you pick one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onPick(template)}
                className={`${workspacePanelCard} p-3 text-left transition-colors hover:bg-[var(--workspace-shell-panel-hover)]`}
                data-test={`campaign-template-${template.id}`}
              >
                <TemplateThumbnail template={template} brand={brand} />
                <div className="mt-3 flex items-start justify-between gap-2">
                  <h3 className={`font-semibold ${workspaceText}`}>
                    {template.name}
                  </h3>
                  <Badge variant="outline">
                    {campaignTemplateAudienceLabel(template.audience)}
                  </Badge>
                </div>
                <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                  {template.purpose}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the current email?</AlertDialogTitle>
            <AlertDialogDescription>
              This will swap the blocks on the canvas for “{pending?.name}”. You
              can still edit everything afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => onOpenChange(true)}>
              Keep current
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) apply(pending);
              }}
            >
              Use template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TemplateThumbnail({
  template,
  brand,
}: {
  template: CampaignTemplateDefinition;
  brand: CampaignBrand;
}) {
  const primary = brand.primary_color || '#0D2344';
  const accent = brand.accent_color || '#57C87F';

  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-[#f4f1ec]">
      <div className="h-7" style={{ background: primary }} />
      <div className="space-y-1.5 px-3 py-3">
        <div className="h-2 w-3/4 rounded bg-[#09111F]/70" />
        {template.id === 'available-now' ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="h-8 rounded bg-[#d8cfc6]" />
            <div className="h-8 rounded bg-[#d8cfc6]" />
          </div>
        ) : template.id === 'new-listing' || template.id === 'market-update' ? (
          <div className="h-8 rounded bg-[#d8cfc6]" />
        ) : template.id === 'new-service' ||
          template.id === 'applicant-requirements' ? (
          <div className="space-y-1 pt-1">
            <div className="h-1.5 w-full rounded bg-[#09111F]/25" />
            <div className="h-1.5 w-5/6 rounded bg-[#09111F]/25" />
            <div className="h-1.5 w-2/3 rounded bg-[#09111F]/25" />
          </div>
        ) : (
          <div className="h-1.5 w-full rounded bg-[#09111F]/20" />
        )}
        <div className="mt-2 h-4 w-20 rounded" style={{ background: accent }} />
      </div>
    </div>
  );
}
