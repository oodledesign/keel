'use client';

import { useMemo } from 'react';

import { Blocks, Sparkles } from 'lucide-react';

import { SITE_BLOCK_TYPES } from '@kit/site-blocks-core/mapping';
import { getWorkspacePack } from '@kit/site-blocks-workspaces';

type Props = {
  accountSlug: string;
};

const ROUNDTRIP_STEPS = [
  'Wireframe the site with the stock blocks',
  'Export → Cursor pack (ozer_sites) on the Export tab — includes ROUNDTRIP.md',
  'Design + build the block in Cursor (component.tsx + block.manifest.json)',
  'Land the pack in keel under packages/site-blocks-workspaces and register it',
  'Refresh this editor, swap sections to the custom blocks, publish',
];

/**
 * Shows which Puck blocks this workspace can use: the stock Site Studio
 * library plus any custom blocks landed via the wireframe → Cursor →
 * Site Studio round-trip.
 */
export function WebsiteBlockLibraryCard({ accountSlug }: Props) {
  const pack = useMemo(() => getWorkspacePack(accountSlug), [accountSlug]);
  const customTypes = pack ? Object.keys(pack.components) : [];

  return (
    <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] p-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--workspace-shell-text)]">
          <Blocks className="size-4" />
          Block library
        </h3>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Blocks available in the Puck editor for this workspace.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          Stock blocks · {SITE_BLOCK_TYPES.length}
        </p>
        <p className="text-sm text-[var(--workspace-shell-text)]">
          {SITE_BLOCK_TYPES.join(' · ')}
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          <Sparkles className="size-3.5" />
          Workspace custom blocks · {customTypes.length}
        </p>
        {customTypes.length > 0 ? (
          <p className="text-sm text-[var(--workspace-shell-text)]">
            {customTypes.join(' · ')}
            <span className="ml-2 text-xs text-[var(--workspace-shell-text-muted)]">
              ({pack?.label})
            </span>
          </p>
        ) : (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No custom blocks yet for this workspace. Build them with the
            round-trip below.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          Round-trip: wireframe → Cursor → Site Studio
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--workspace-shell-text-muted)]">
          {ROUNDTRIP_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
