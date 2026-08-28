'use client';

import { useRef, useState, type RefObject } from 'react';

import { useRouter } from 'next/navigation';

import { ImageIcon, Trash2, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

type CompanyAssetKind = 'logo' | 'icon';

export function SignaturesCompanyAssetsCard({
  accountId,
  companyLogoUrl,
  companyIconUrl,
  brandLogoUrl,
}: {
  accountId: string;
  companyLogoUrl: string | null;
  companyIconUrl: string | null;
  brandLogoUrl: string | null;
}) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<CompanyAssetKind | null>(null);
  const [removing, setRemoving] = useState<CompanyAssetKind | null>(null);

  const upload = async (kind: CompanyAssetKind, file: File) => {
    setUploading(kind);
    try {
      const formData = new FormData();
      formData.set('accountId', accountId);
      formData.set('kind', kind);
      formData.set('file', file);

      const response = await fetch('/api/signatures/company-asset', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Upload failed');
      }

      toast.success(
        kind === 'logo' ? 'Company logo updated' : 'Company icon updated',
      );
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(null);
    }
  };

  const remove = async (kind: CompanyAssetKind) => {
    setRemoving(kind);
    try {
      const response = await fetch('/api/signatures/company-asset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, kind }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Remove failed');
      }

      toast.success(
        kind === 'logo' ? 'Company logo removed' : 'Company icon removed',
      );
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRemoving(null);
    }
  };

  const logoPreview = companyLogoUrl || brandLogoUrl;
  const logoIsFallback = !companyLogoUrl && Boolean(brandLogoUrl);

  return (
    <div className="space-y-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
          Company logo &amp; icon
        </h3>
        <p className="text-muted-foreground text-sm">
          Used in signature templates. The workspace Business logo in Brand
          settings stays as the sidebar avatar and the fallback when no company
          logo is set.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <AssetSlot
          kind="logo"
          label="Company logo (full)"
          description="Wordmark for the logo block. Falls back to the Brand business logo when empty."
          previewUrl={logoPreview}
          previewMode="wide"
          fallbackHint={logoIsFallback ? 'Showing Brand business logo' : null}
          inputRef={logoInputRef}
          uploading={uploading === 'logo'}
          removing={removing === 'logo'}
          hasCustom={Boolean(companyLogoUrl)}
          onPick={() => logoInputRef.current?.click()}
          onRemove={() => void remove('logo')}
          onFile={(file) => void upload('logo', file)}
        />

        <AssetSlot
          kind="icon"
          label="Company icon"
          description="Square mark on staff photos (bottom-right badge), or fills the photo slot when someone has no photo."
          previewUrl={companyIconUrl}
          previewMode="square"
          fallbackHint={null}
          inputRef={iconInputRef}
          uploading={uploading === 'icon'}
          removing={removing === 'icon'}
          hasCustom={Boolean(companyIconUrl)}
          onPick={() => iconInputRef.current?.click()}
          onRemove={() => void remove('icon')}
          onFile={(file) => void upload('icon', file)}
        />
      </div>
    </div>
  );
}

function AssetSlot({
  kind,
  label,
  description,
  previewUrl,
  previewMode,
  fallbackHint,
  inputRef,
  uploading,
  removing,
  hasCustom,
  onPick,
  onRemove,
  onFile,
}: {
  kind: CompanyAssetKind;
  label: string;
  description: string;
  previewUrl: string | null;
  previewMode: 'wide' | 'square';
  fallbackHint: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  removing: boolean;
  hasCustom: boolean;
  onPick: () => void;
  onRemove: () => void;
  onFile: (file: File) => void;
}) {
  const busy = uploading || removing;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>

      <div
        className={
          previewMode === 'wide'
            ? 'flex h-24 items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3'
            : 'flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-2'
        }
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote storage preview
          <img
            src={previewUrl}
            alt=""
            className={
              previewMode === 'wide'
                ? 'max-h-full max-w-full object-contain'
                : 'h-full w-full rounded-lg object-cover'
            }
          />
        ) : (
          <ImageIcon className="text-muted-foreground h-8 w-8" />
        )}
      </div>

      {fallbackHint ? (
        <p className="text-muted-foreground text-xs">{fallbackHint}</p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onPick}
          data-test={`signature-company-${kind}-upload`}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : hasCustom ? 'Replace' : 'Upload'}
        </Button>
        {hasCustom ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onRemove}
            data-test={`signature-company-${kind}-remove`}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
