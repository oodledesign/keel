'use client';

import { useMemo, useState } from 'react';

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
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const previewLogo = useMemo(() => {
    if (clearLogo) return null;
    if (logoDataUrl) return logoDataUrl;
    return initialBrand.logo_url;
  }, [clearLogo, initialBrand.logo_url, logoDataUrl]);

  const onLogoFile = (file: File | null) => {
    setClearLogo(false);
    if (!file) {
      setLogoDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveAccountBrandSettings({
        accountId,
        primary_color: normalizeHex(primary),
        secondary_color: secondary.trim()
          ? normalizeHex(secondary)
          : null,
        accent_color: accent.trim() ? normalizeHex(accent) : null,
        logoDataUrl: logoDataUrl ?? undefined,
        clearLogo: clearLogo || undefined,
      });
      toast.success('Brand settings saved');
      setLogoDataUrl(null);
      setClearLogo(false);
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        <Link href={settingsHref} className="text-[#57C87F] hover:underline">
          ← Back to settings
        </Link>
      </div>

      {!canEdit ? (
        <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-muted-foreground">
          Only workspace owners and admins can edit brand colours and logo.
        </p>
      ) : null}

      <div className="grid gap-5 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-6">
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
          <Label>Logo</Label>
          <p className="text-xs text-muted-foreground">
            Used in invoice emails and signature templates (
            <code className="text-[11px]">{'{{brand_logo_url}}'}</code>). PNG or
            JPG recommended.
          </p>
          {previewLogo ? (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/10 p-4">
              <img
                src={previewLogo}
                alt="Brand logo preview"
                className="max-h-16 w-auto object-contain"
              />
            </div>
          ) : null}
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
            disabled={!canEdit}
          />
          {initialBrand.logo_url && canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setClearLogo(true);
                setLogoDataUrl(null);
              }}
            >
              Remove logo
            </Button>
          ) : null}
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
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          className="h-10 w-14 cursor-pointer rounded border border-white/10 bg-transparent disabled:opacity-50"
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
