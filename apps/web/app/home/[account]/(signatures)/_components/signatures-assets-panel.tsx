'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { Plus, Save, Trash2, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { AccountBranch } from '~/lib/brand/account-branches';
import type {
  SignatureAsset,
  SignatureAssetKind,
  SignatureAssetScope,
} from '~/lib/signatures/signature-assets-resolve';

import {
  deleteSignatureAssetAction,
  upsertSignatureAssetAction,
} from '../_lib/server/signatures-module-actions';

const MAX_BADGE_EDGE_PX = 512;

async function fileToBadgeDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a PNG, JPEG, WebP, or GIF image');
  }

  if (
    (file.type === 'image/png' ||
      file.type === 'image/webp' ||
      file.type === 'image/gif') &&
    file.size <= 900_000
  ) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read that image'));
      reader.readAsDataURL(file);
    });
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image'));
      img.src = objectUrl;
    });

    const scale = Math.min(
      1,
      MAX_BADGE_EDGE_PX / Math.max(image.width, image.height),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not process image');
    }
    ctx.drawImage(image, 0, 0, width, height);

    if (file.type === 'image/png' || file.type === 'image/webp') {
      return canvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function scopeLabel(
  asset: SignatureAsset,
  branches: AccountBranch[],
): string {
  if (asset.scope === 'workspace') {
    return 'All signatures';
  }
  if (asset.scope === 'department') {
    return `Department · ${asset.department}`;
  }
  const branch = branches.find((item) => item.id === asset.branch_id);
  return `Branch · ${branch?.name ?? 'Unknown'}`;
}

export function SignaturesAssetsPanel({
  accountId,
  assets,
  departments,
  branches,
}: {
  accountId: string;
  assets: SignatureAsset[];
  departments: string[];
  branches: AccountBranch[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<SignatureAssetKind>('custom_text');
  const [scope, setScope] = useState<SignatureAssetScope>('workspace');
  const [department, setDepartment] = useState(departments[0] ?? '');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [badgeUrl, setBadgeUrl] = useState('');
  const [badgeDataUrl, setBadgeDataUrl] = useState<string | null>(null);
  const [processingBadge, setProcessingBadge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const texts = useMemo(
    () => assets.filter((asset) => asset.kind === 'custom_text'),
    [assets],
  );
  const badges = useMemo(
    () => assets.filter((asset) => asset.kind === 'award_badge'),
    [assets],
  );

  const badgePreview = badgeDataUrl || badgeUrl;

  const onBadgeFile = async (file: File | null) => {
    if (!file) {
      setBadgeDataUrl(null);
      return;
    }
    setProcessingBadge(true);
    try {
      setBadgeDataUrl(await fileToBadgeDataUrl(file));
    } catch (error) {
      setBadgeDataUrl(null);
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingBadge(false);
    }
  };

  const resetForm = () => {
    setLabel('');
    setBody('');
    setBadgeUrl('');
    setBadgeDataUrl(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await upsertSignatureAssetAction({
        accountId,
        kind,
        scope,
        department: scope === 'department' ? department : null,
        branchId: scope === 'branch' ? branchId : null,
        label,
        body: kind === 'custom_text' ? body : null,
        award_badge_url: kind === 'award_badge' ? badgeUrl : '',
        badgeDataUrl: kind === 'award_badge' ? badgeDataUrl : null,
        sortOrder: 0,
      });
      toast.success(kind === 'custom_text' ? 'Shared text saved' : 'Badge saved');
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (assetId: string) => {
    setDeletingId(assetId);
    try {
      await deleteSignatureAssetAction({ accountId, assetId });
      toast.success('Removed');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
      <CardHeader className="space-y-1">
        <CardTitle>Shared text &amp; badges</CardTitle>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Add snippets and award badges that apply to all signatures, or only to
          a department or branch. Add a Shared text / Award badges block in your
          template to show them.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as SignatureAssetKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom_text">Shared text</SelectItem>
                  <SelectItem value="award_badge">Award badge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Applies to</Label>
              <Select
                value={scope}
                onValueChange={(value) =>
                  setScope(value as SignatureAssetScope)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">All signatures</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="branch">Branch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={
                  kind === 'custom_text'
                    ? 'e.g. Legal disclaimer'
                    : 'e.g. CoStar 2024'
                }
              />
            </div>
          </div>

          {scope === 'department' ? (
            <div className="space-y-2">
              <Label>Department</Label>
              {departments.length ? (
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Sync staff first to discover departments.
                </p>
              )}
            </div>
          ) : null}

          {scope === 'branch' ? (
            <div className="space-y-2">
              <Label>Branch</Label>
              {branches.length ? (
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Add branches in workspace brand settings first.
                </p>
              )}
            </div>
          ) : null}

          {kind === 'custom_text' ? (
            <div className="space-y-2">
              <Label htmlFor="shared-text-body">Text</Label>
              <Textarea
                id="shared-text-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={3}
                placeholder="Shown for matching signatures when the template includes Shared text."
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
                  {badgePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={badgePreview}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Upload className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="asset-badge-upload">Badge image</Label>
                  <Input
                    id="asset-badge-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) =>
                      void onBadgeFile(event.target.files?.[0] ?? null)
                    }
                    disabled={processingBadge || saving}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-badge-url">Or paste an image URL</Label>
                <Input
                  id="asset-badge-url"
                  type="url"
                  value={badgeUrl}
                  onChange={(event) => {
                    setBadgeUrl(event.target.value);
                    setBadgeDataUrl(null);
                  }}
                  disabled={Boolean(badgeDataUrl) || saving}
                  placeholder="https://cdn.example.com/awards/costar.png"
                />
              </div>
            </div>
          )}

          <Button
            type="button"
            onClick={save}
            disabled={
              saving ||
              processingBadge ||
              !label.trim() ||
              (kind === 'custom_text' && !body.trim()) ||
              (kind === 'award_badge' && !badgeDataUrl && !badgeUrl.trim()) ||
              (scope === 'department' && !department) ||
              (scope === 'branch' && !branchId)
            }
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>

        <AssetList
          title="Shared text"
          empty="No shared text yet."
          items={texts}
          branches={branches}
          deletingId={deletingId}
          onRemove={remove}
          renderPreview={(asset) => (
            <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--workspace-shell-text-muted)]">
              {asset.body}
            </p>
          )}
        />

        <AssetList
          title="Award badges"
          empty="No award badges yet."
          items={badges}
          branches={branches}
          deletingId={deletingId}
          onRemove={remove}
          renderPreview={(asset) =>
            asset.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.image_url}
                alt={asset.label}
                className="h-10 w-10 shrink-0 rounded border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] object-contain p-0.5"
                referrerPolicy="no-referrer"
              />
            ) : null
          }
        />
      </CardContent>
    </Card>
  );
}

function AssetList({
  title,
  empty,
  items,
  branches,
  deletingId,
  onRemove,
  renderPreview,
}: {
  title: string;
  empty: string;
  items: SignatureAsset[];
  branches: AccountBranch[];
  deletingId: string | null;
  onRemove: (id: string) => void;
  renderPreview: (asset: SignatureAsset) => ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Plus className="h-3.5 w-3.5 text-[var(--workspace-shell-text-muted)]" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {empty}
        </p>
      ) : (
        <div className="space-y-2 rounded-2xl border border-[color:var(--workspace-shell-border)] p-3">
          {items.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] py-2 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {asset.kind === 'award_badge' ? renderPreview(asset) : null}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{asset.label}</p>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {scopeLabel(asset, branches)}
                  </p>
                  {asset.kind === 'custom_text' ? renderPreview(asset) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(asset.id)}
                disabled={deletingId === asset.id}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deletingId === asset.id ? 'Removing…' : 'Remove'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
