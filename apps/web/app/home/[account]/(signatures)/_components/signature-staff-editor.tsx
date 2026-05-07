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

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import {
  pushStaffSignatureAction,
  updateSignatureStaff,
} from '../_lib/server/signatures-module-actions';
import type {
  SignatureStaff,
  SignatureTemplate,
} from '../_lib/server/signatures-data';

const NO_TEMPLATE = '__none__';

export function SignatureStaffEditor({
  accountId,
  staff,
  templates,
}: {
  accountId: string;
  staff: SignatureStaff;
  templates: SignatureTemplate[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [templateId, setTemplateId] = useState(staff.template_id ?? NO_TEMPLATE);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    const selectedTemplate = templateId === NO_TEMPLATE ? null : templateId;
    if (!selectedTemplate) {
      return null;
    }

    const params = new URLSearchParams({
      staffId: staff.id,
      templateId: selectedTemplate,
    });
    return `/api/signatures/preview?${params.toString()}`;
  }, [staff.id, templateId]);

  const onPhoto = async (file: File | null) => {
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
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
        branch: String(formData.get('branch') ?? ''),
        photoDataUrl,
        templateId: templateId === NO_TEMPLATE ? null : templateId,
      });
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
      <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader>
          <CardTitle>Edit staff member</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={save} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field name="full_name" label="Full name" defaultValue={staff.full_name} />
              <Field name="job_title" label="Job title" defaultValue={staff.job_title} />
              <Field name="department" label="Department" defaultValue={staff.department} />
              <Field name="branch" label="Branch" defaultValue={staff.branch} />
              <Field name="phone_direct" label="Direct phone" defaultValue={staff.phone_direct} />
              <Field name="phone_mobile" label="Mobile phone" defaultValue={staff.phone_mobile} />
            </div>

            <div className="space-y-2">
              <Label>Photo upload</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => onPhoto(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Uploading replaces the synced photo for this staff profile.
              </p>
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
              <Button type="submit" disabled={saving}>
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
                      Keel will send the currently assigned template to this
                      staff member&apos;s Microsoft mailbox.
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

      <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader>
          <CardTitle>Live preview</CardTitle>
        </CardHeader>
        <CardContent>
          {previewUrl ? (
            <iframe
              key={previewUrl}
              src={previewUrl}
              className="h-[420px] w-full rounded-xl border border-white/10 bg-white"
              title="Signature preview"
            />
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground">
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
}: {
  name: string;
  label: string;
  defaultValue: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} />
    </div>
  );
}
