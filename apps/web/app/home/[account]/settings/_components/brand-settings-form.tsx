'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { AccountBrandResolved } from '~/lib/brand/account-brand';

import { saveAccountBrandSettings } from '../_lib/server/account-brand-actions';

function normalizeHex(input: string): string {
  const t = input.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t}`;
  return t;
}

export function BrandSettingsForm({
  accountId,
  accountSlug,
  initialBrand,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  initialBrand: AccountBrandResolved;
  canEdit: boolean;
}) {
  const router = useRouter();
  const settingsHref = pathsConfig.app.accountSettings.replace(
    '[account]',
    accountSlug,
  );

  const [primary, setPrimary] = useState(initialBrand.primary_color);
  const [secondary, setSecondary] = useState(initialBrand.secondary_color);
  const [accent, setAccent] = useState(initialBrand.accent_color);
  const [websiteUrl, setWebsiteUrl] = useState(initialBrand.website_url ?? '');
  const [address, setAddress] = useState(initialBrand.address ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveAccountBrandSettings({
        accountId,
        primary_color: normalizeHex(primary),
        secondary_color: secondary.trim() ? normalizeHex(secondary) : null,
        accent_color: accent.trim() ? normalizeHex(accent) : null,
        website_url: websiteUrl.trim() || null,
        address: address.trim() || null,
      });
      toast.success('Brand settings saved');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!canEdit ? (
        <p className="text-muted-foreground rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-3 text-sm">
          Only workspace owners and admins can edit brand colours.
        </p>
      ) : null}

      <p className="text-muted-foreground rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-3 text-sm">
        Upload your business logo under{' '}
        <Link
          href={settingsHref}
          className="text-[var(--ozer-accent)] hover:underline"
        >
          General settings
        </Link>
        . It appears in the sidebar workspace switcher, emails, and signature
        templates.
      </p>

      <div className="grid gap-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
        <ColorField
          label="Primary"
          description="Main header colour for emails and signature panels."
          value={primary}
          onChange={setPrimary}
          disabled={!canEdit}
        />
        <ColorField
          label="Secondary"
          description="Optional supporting colour (available as {{brand_secondary_color}} in HTML templates)."
          value={secondary}
          onChange={setSecondary}
          disabled={!canEdit}
        />
        <ColorField
          label="Accent"
          description="Optional accent (available as {{brand_accent_color}} in HTML templates)."
          value={accent}
          onChange={setAccent}
          disabled={!canEdit}
        />

        <div className="space-y-2">
          <Label htmlFor="brand-website">Company website</Label>
          <p className="text-muted-foreground text-xs">
            Shown in email signatures as{' '}
            <code className="text-[11px]">{'{{website}}'}</code> (e.g.
            www.example.com).
          </p>
          <Input
            id="brand-website"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="www.yourcompany.com"
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand-address">Default company address</Label>
          <p className="text-muted-foreground text-xs">
            Fallback for signatures when a branch has no address. Branch
            addresses are set under Branches below.
          </p>
          <Input
            id="brand-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 High Street, London, SW1A 1AA"
            disabled={!canEdit}
          />
        </div>

        {canEdit ? (
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save brand'
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ColorField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-muted-foreground text-xs">{description}</p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          className="h-10 w-14 cursor-pointer rounded border border-[color:var(--workspace-shell-border)] bg-transparent disabled:opacity-50"
          value={value.startsWith('#') ? value.slice(0, 7) : `#${value}`}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={`${label} colour picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0D2344"
          className="max-w-[140px] font-mono text-sm"
          disabled={disabled}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
