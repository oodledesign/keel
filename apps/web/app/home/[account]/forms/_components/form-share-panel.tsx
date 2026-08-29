'use client';

import { useMemo } from 'react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

type Props = {
  shareToken: string;
  enabled: boolean;
  destination: 'pipeline' | 'listing_enquiry';
  listingId: string | null;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
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
}: Props) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicPath = pathsConfig.app.formShare.replace('[token]', shareToken);
  const publicUrl = `${origin}${publicPath}`;
  const listingUrl =
    destination === 'listing_enquiry'
      ? `${publicUrl}?listing=${listingId || 'LISTING_ID'}`
      : publicUrl;

  const iframeSnippet = useMemo(
    () =>
      `<iframe src="${listingUrl}" title="Enquiry form" style="width:100%;min-height:720px;border:0;"></iframe>`,
    [listingUrl],
  );

  const scriptSnippet = useMemo(
    () =>
      [
        `<div data-ozer-form="${shareToken}"${
          destination === 'listing_enquiry'
            ? ` data-listing="${listingId || 'LISTING_ID'}"`
            : ''
        }></div>`,
        `<script>`,
        `(function(){`,
        `  var el=document.querySelector('[data-ozer-form="${shareToken}"]');`,
        `  if(!el||el.querySelector('iframe')) return;`,
        `  var listing=el.getAttribute('data-listing')||'';`,
        `  var iframe=document.createElement('iframe');`,
        `  iframe.src='${publicUrl}'+(listing?'?listing='+encodeURIComponent(listing):'');`,
        `  iframe.style='width:100%;min-height:720px;border:0;';`,
        `  iframe.title='Enquiry form';`,
        `  el.appendChild(iframe);`,
        `})();`,
        `</script>`,
      ].join('\n'),
    [destination, listingId, publicUrl, shareToken],
  );

  return (
    <section className={`${workspacePanelCard} space-y-4 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={`text-base font-semibold ${workspaceText}`}>
            Share and embed
          </h2>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Visitors can submit without an Ozer login. Listing embeds accept
            <code className="mx-1 text-xs">?listing=</code>
            or a <code className="text-xs">data-listing</code> attribute.
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
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Public link</Label>
            <div className="flex gap-2">
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
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Iframe snippet</Label>
            <Textarea
              readOnly
              value={iframeSnippet}
              rows={3}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => copy(iframeSnippet, 'Iframe snippet')}
            >
              Copy iframe
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label>Script snippet</Label>
            <Textarea
              readOnly
              value={scriptSnippet}
              rows={8}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => copy(scriptSnippet, 'Script snippet')}
            >
              Copy script
            </Button>
          </div>
        </div>
      ) : (
        <p className={`text-sm ${workspaceTextMuted}`}>
          Publish the form to generate a public link and embed snippet.
        </p>
      )}
    </section>
  );
}
