'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Send, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { AccountBranch } from '~/lib/brand/account-branches';

import {
  pushStaffSignatureAction,
  updateSignatureStaff,
} from '../_lib/server/signatures-module-actions';
import type {
  SignatureStaff,
  SignatureTemplate,
} from '../_lib/server/signatures-data';

import { SignatureInstallActions } from './signature-install-actions';
import {
  SignaturePreviewFrame,
  type SignaturePreviewTheme,
} from './signature-preview-frame';

const NO_TEMPLATE = '__none__';
const NO_BRANCH = '__none__';
const MAX_PHOTO_EDGE_PX = 640;

async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a PNG, JPEG, or WebP image');
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
      MAX_PHOTO_EDGE_PX / Math.max(image.width, image.height),
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

    // JPEG keeps server-action payloads small enough to upload reliably.
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function SignatureStaffEditor({
  accountId,
  staff,
  templates,
  branches,
}: {
  accountId: string;
  staff: SignatureStaff;
  templates: SignatureTemplate[];
  branches: AccountBranch[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [templateId, setTemplateId] = useState(staff.template_id ?? NO_TEMPLATE);
  const [branchId, setBranchId] = useState(staff.branch_id ?? NO_BRANCH);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] =
    useState<SignaturePreviewTheme>('light');

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === branchId) ?? null,
    [branchId, branches],
  );

  const previewUrl = useMemo(() => {
    const selectedTemplate = templateId === NO_TEMPLATE ? null : templateId;
    if (!selectedTemplate) {
      return null;
    }

    const params = new URLSearchParams({
      staffId: staff.id,
      templateId: selectedTemplate,
      theme: previewTheme,
    });
    return `/api/signatures/preview?${params.toString()}`;
  }, [previewTheme, staff.id, templateId]);

  const photoPreview = photoDataUrl || staff.photo_url;

  const onPhoto = async (file: File | null) => {
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }

    setProcessingPhoto(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPhotoDataUrl(dataUrl);
    } catch (error) {
      setPhotoDataUrl(null);
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingPhoto(false);
    }
  };

  const save = async (formData: FormData) => {
    setSaving(true);
    try {
      await updateSignatureStaff({
        accountId,
        staffId: staff.id,
        full_name: String(formData.get('full_name') ?? ''),
        job_title: String(formData.get('job_title') ?? ''),
        department: String(formData.get('department') ?? ''),
        phone_direct: String(formData.get('phone_direct') ?? ''),
        phone_mobile: String(formData.get('phone_mobile') ?? ''),
        signature_email: String(formData.get('signature_email') ?? ''),
        branch_id: branchId === NO_BRANCH ? null : branchId,
        photoDataUrl,
        templateId: templateId === NO_TEMPLATE ? null : templateId,
      });
      setPhotoDataUrl(null);
      toast.success('Staff member saved');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const push = async () => {
    setPushing(true);
    try {
      const result = await pushStaffSignatureAction({
        accountId,
        staffId: staff.id,
      });
      if (result.success) {
        toast.success('Signature pushed');
      } else {
        toast.error(result.error ?? 'Push failed');
      }
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader>
          <CardTitle>Edit staff member</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={save} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field name="full_name" label="Full name" defaultValue={staff.full_name} />
              <Field name="job_title" label="Job title" defaultValue={staff.job_title} />
              <Field name="department" label="Department" defaultValue={staff.department} />
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BRANCH}>
                      Default branch
                    </SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                        {branch.isDefault ? ' (default)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBranch ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedBranch.address || 'No branch address set'}
                    {selectedBranch.phone ? ` · ${selectedBranch.phone}` : ''}
                    {selectedBranch.email ? ` · ${selectedBranch.email}` : ''}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Uses the default branch from Brand settings when none is selected.
                  </p>
                )}
              </div>
              <Field
                name="phone_direct"
                label="Direct phone (override)"
                defaultValue={staff.phone_direct}
                hint="Leave blank to use the branch phone number."
              />
              <Field name="phone_mobile" label="Mobile phone" defaultValue={staff.phone_mobile} />
              <Field
                name="signature_email"
                label="Signature email (override)"
                defaultValue={staff.signature_email}
                hint="Leave blank to use synced email, then branch email."
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Synced login email: {staff.email}
            </p>

            <div className="space-y-2">
              <Label>Photo upload</Label>
              <div className="flex flex-wrap items-center gap-4">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt={staff.full_name ?? 'Staff photo'}
                    className="h-20 w-20 rounded-lg object-cover border border-[color:var(--workspace-shell-border)]"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] text-xs text-muted-foreground">
                    No photo
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={processingPhoto || saving}
                    onChange={(event) =>
                      void onPhoto(event.target.files?.[0] ?? null)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {processingPhoto
                      ? 'Preparing photo…'
                      : photoDataUrl
                        ? 'New photo ready — click Save changes to upload.'
                        : 'Uploading replaces the synced photo for this staff profile.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>No template</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || processingPhoto}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">
                    <Send className="mr-2 h-4 w-4" />
                    Push Signature
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Push this signature?</DialogTitle>
                    <DialogDescription>
                      Ozer will send the currently assigned template to this
                      staff member&apos;s mailbox.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button type="button" onClick={push} disabled={pushing}>
                      {pushing ? 'Pushing...' : 'Push signature'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader className="space-y-3">
          <div className="space-y-1">
            <CardTitle>Live preview</CardTitle>
            <p className="text-xs text-muted-foreground">
              Preview how this signature reads at mobile, tablet, and desktop
              widths in light or dark inbox chrome.
            </p>
          </div>
          {templateId !== NO_TEMPLATE ? (
            <SignatureInstallActions
              accountId={accountId}
              templateId={templateId}
              staffId={staff.id}
            />
          ) : null}
        </CardHeader>
        <CardContent>
          {previewUrl ? (
            <SignaturePreviewFrame
              theme={previewTheme}
              onThemeChange={setPreviewTheme}
              heightClassName="h-[420px]"
            >
              <iframe
                key={previewUrl}
                src={previewUrl}
                sandbox=""
                className={cn(
                  'h-full w-full rounded-lg border-0',
                  previewTheme === 'light' ? 'bg-white' : 'bg-[#1c1c1e]',
                )}
                title="Signature preview"
              />
            </SignaturePreviewFrame>
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] text-sm text-muted-foreground">
              <Upload className="mr-2 h-4 w-4" />
              Assign a template to preview this signature.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
