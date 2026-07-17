'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Upload, UserPlus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import { createManualSignatureStaff } from '../_lib/server/signatures-module-actions';

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
    if (!ctx) throw new Error('Could not process image');
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function SignaturesAddStaffDialog({
  accountId,
  accountSlug,
  open,
  onOpenChange,
}: {
  accountId: string;
  accountSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const onPhoto = async (file: File | null) => {
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }

    setProcessingPhoto(true);
    try {
      setPhotoDataUrl(await fileToCompressedDataUrl(file));
    } catch (error) {
      setPhotoDataUrl(null);
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingPhoto(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setPending(true);
    try {
      const result = await createManualSignatureStaff({
        accountId,
        email: String(formData.get('email') ?? ''),
        full_name: String(formData.get('full_name') ?? ''),
        job_title: String(formData.get('job_title') ?? ''),
        department: String(formData.get('department') ?? ''),
        phone_direct: String(formData.get('phone_direct') ?? ''),
        phone_mobile: String(formData.get('phone_mobile') ?? ''),
        photoDataUrl,
      });
      toast.success('Person added');
      onOpenChange(false);
      form.reset();
      setPhotoDataUrl(null);
      router.refresh();
      router.push(`/home/${accountSlug}/signatures/staff/${result.staffId}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add person</DialogTitle>
          <DialogDescription>
            Add someone manually when they are not in your connected directory.
            They will appear in signatures exactly like synced staff.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="add-staff-name">Full name</Label>
              <Input
                id="add-staff-name"
                name="full_name"
                required
                data-test="signatures-add-staff-name"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="add-staff-email">Email</Label>
              <Input
                id="add-staff-email"
                name="email"
                type="email"
                required
                data-test="signatures-add-staff-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-staff-job">Job title</Label>
              <Input id="add-staff-job" name="job_title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-staff-dept">Department</Label>
              <Input id="add-staff-dept" name="department" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-staff-direct">Direct phone</Label>
              <Input id="add-staff-direct" name="phone_direct" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-staff-mobile">Mobile phone</Label>
              <Input id="add-staff-mobile" name="phone_mobile" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={processingPhoto}
              >
                {processingPhoto ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload photo
              </Button>
              {photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoDataUrl}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) =>
                void onPhoto(event.target.files?.[0] ?? null)
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || processingPhoto}
              data-test="signatures-add-staff-submit"
            >
              {pending ? 'Adding…' : 'Add person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SignaturesAddStaffButton({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        data-test="signatures-add-staff-button"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Add person
      </Button>
      <SignaturesAddStaffDialog
        accountId={accountId}
        accountSlug={accountSlug}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
