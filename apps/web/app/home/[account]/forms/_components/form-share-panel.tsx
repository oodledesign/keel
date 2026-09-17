'use client';

import { useMemo, useState } from 'react';

import { AppWindow, Code2, ExternalLink, SquareStack } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import {
  buildInlineHostSnippet,
  buildInlineIframeSnippet,
  buildInlineScriptSnippet,
  buildPopupEmbedSnippet,
  buildPopupScriptSnippet,
  buildPopupTriggerSnippet,
  buildPropertyHiveSnippet,
  formUrlWithListing,
  publicFormPath,
  publicFormUrl,
} from '~/lib/workspace-forms/form-embed';
import type { WorkspaceFormDestination } from '~/lib/workspace-forms/form-fields';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

type EmbedKind = 'inline' | 'popup' | 'wordpress';

type Props = {
  shareToken: string;
  enabled: boolean;
  destination: WorkspaceFormDestination;
  listingId: string | null;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
  showPropertyHiveSnippet?: boolean;
};

function copy(text: string, label: string) {
  void navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

export function FormSharePanel({
  shareToken,
  enabled,
  destination,
  listingId,
  pending,
  onToggle,
  showPropertyHiveSnippet = false,
}: Props) {
  const [embedKind, setEmbedKind] = useState<EmbedKind | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicPath = publicFormPath(shareToken, pathsConfig.app.formShare);
  const publicUrl = publicFormUrl(origin, publicPath);
  const bindsListing =
    destination === 'listing_enquiry' ||
    (destination === 'mailing_list' && showPropertyHiveSnippet);
  const bind = useMemo(
    () => ({ bindsListing, listingId }),
    [bindsListing, listingId],
  );
  const listingUrl = formUrlWithListing(publicUrl, bind);

  const iframeSnippet = useMemo(
    () => buildInlineIframeSnippet(listingUrl),
    [listingUrl],
  );
  const scriptSnippet = useMemo(
    () =>
      buildInlineScriptSnippet({
        shareToken,
        publicUrl,
        bind,
      }),
    [bind, publicUrl, shareToken],
  );
  const extraHostSnippet = useMemo(
    () => buildInlineHostSnippet({ shareToken, bind }),
    [bind, shareToken],
  );
  const popupSnippet = useMemo(
    () =>
      buildPopupEmbedSnippet({
        shareToken,
        publicUrl,
        bind,
      }),
    [bind, publicUrl, shareToken],
  );
  const popupScriptSnippet = useMemo(
    () =>
      buildPopupScriptSnippet({
        shareToken,
        publicUrl,
      }),
    [publicUrl, shareToken],
  );
  const extraPopupButtonSnippet = useMemo(
    () =>
      buildPopupTriggerSnippet({
        shareToken,
        bind,
        buttonLabel: 'Open form',
      }),
    [bind, shareToken],
  );
  const propertyHiveSnippet = useMemo(
    () => buildPropertyHiveSnippet(publicUrl),
    [publicUrl],
  );

  const cards = [
    {
      id: 'inline' as const,
      title: 'Inline',
      description: 'Embed the form in a page with an iframe or script.',
      icon: SquareStack,
    },
    {
      id: 'popup' as const,
      title: 'Popup',
      description: 'Show a button that opens the form in a modal.',
      icon: AppWindow,
    },
    ...(showPropertyHiveSnippet
      ? [
          {
            id: 'wordpress' as const,
            title: 'WordPress',
            description: 'Property Hive single-property template snippet.',
            icon: Code2,
          },
        ]
      : []),
  ];

  return (
    <section className={`${workspacePanelCard} space-y-4 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={`text-base font-semibold ${workspaceText}`}>
            Share and embed
          </h2>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Visitors can submit without an Ozer login.
            {bindsListing ? (
              <>
                {' '}
                Bind a disposal with
                <code className="mx-1 text-xs">?listing=</code>,
                <code className="mx-1 text-xs">?property=</code>, or a{' '}
                <code className="text-xs">data-listing</code> attribute.
              </>
            ) : null}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={onToggle}
          aria-label="Publish form"
          data-test="publish-form-switch"
        />
      </div>

      {enabled ? (
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Public link</Label>
            <div className="flex flex-wrap gap-2">
              <code className="block min-w-0 flex-1 truncate rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5 text-xs">
                {listingUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy(listingUrl, 'Link')}
              >
                Copy
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a
                  href={listingUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-test="open-public-form"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setEmbedKind(card.id)}
                  className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 text-left transition-colors hover:bg-[var(--workspace-shell-panel-hover)]"
                  data-test={`form-embed-card-${card.id}`}
                >
                  <Icon className="mb-3 h-5 w-5 text-[var(--ozer-accent)]" />
                  <div className={`text-sm font-medium ${workspaceText}`}>
                    {card.title}
                  </div>
                  <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                    {card.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className={`text-sm ${workspaceTextMuted}`}>
          Publish the form to generate a public link and embed snippet.
        </p>
      )}

      <Dialog
        open={embedKind !== null}
        onOpenChange={(next) => {
          if (!next) setEmbedKind(null);
        }}
      >
        <DialogContent className="max-w-xl">
          {embedKind === 'inline' ? (
            <>
              <DialogHeader>
                <DialogTitle>Inline embed</DialogTitle>
                <DialogDescription>
                  Include the script once. Every{' '}
                  <code className="text-xs">
                    data-ozer-form=&quot;{shareToken}&quot;
                  </code>{' '}
                  host on the page gets an iframe, including a second paste.
                </DialogDescription>
              </DialogHeader>
              <SnippetBlock
                label="Iframe snippet"
                value={iframeSnippet}
                rows={3}
                copyLabel="Iframe snippet"
              />
              <SnippetBlock
                label="Script snippet"
                value={scriptSnippet}
                rows={8}
                copyLabel="Script snippet"
              />
              <SnippetBlock
                label="Extra host (no script)"
                value={extraHostSnippet}
                rows={2}
                copyLabel="Extra host"
              />
            </>
          ) : null}
          {embedKind === 'popup' ? (
            <>
              <DialogHeader>
                <DialogTitle>Popup embed</DialogTitle>
                <DialogDescription>
                  Include the script once. Any button with{' '}
                  <code className="text-xs">
                    data-ozer-form-popup=&quot;{shareToken}&quot;
                  </code>{' '}
                  opens the form. Optional{' '}
                  <code className="text-xs">data-listing</code> on each button.
                </DialogDescription>
              </DialogHeader>
              <SnippetBlock
                label="Button + script"
                value={popupSnippet}
                rows={10}
                copyLabel="Popup snippet"
              />
              <SnippetBlock
                label="Script only (include once)"
                value={popupScriptSnippet}
                rows={8}
                copyLabel="Popup script"
              />
              <SnippetBlock
                label="Extra button"
                value={extraPopupButtonSnippet}
                rows={2}
                copyLabel="Extra button"
              />
            </>
          ) : null}
          {embedKind === 'wordpress' ? (
            <>
              <DialogHeader>
                <DialogTitle>WordPress / Property Hive</DialogTitle>
                <DialogDescription>
                  Paste this on the single property template after mapping the
                  Ozer listing UUID custom field.
                </DialogDescription>
              </DialogHeader>
              <SnippetBlock
                label="WordPress snippet"
                value={propertyHiveSnippet}
                rows={6}
                copyLabel="Property Hive snippet"
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SnippetBlock({
  label,
  value,
  rows,
  copyLabel,
}: {
  label: string;
  value: string;
  rows: number;
  copyLabel: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Textarea
        readOnly
        value={value}
        rows={rows}
        className="font-mono text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() => copy(value, copyLabel)}
      >
        Copy
      </Button>
    </div>
  );
}
