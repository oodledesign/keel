'use client';

import { useRef, useState, useTransition } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Download,
  FileUp,
  LayoutTemplate,
  Loader2,
  Upload,
} from 'lucide-react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import pathsConfig from '~/config/paths.config';
import {
  BROCHURE_TEMPLATE_OPTIONS,
  type BrochureDisplayOptions,
  type BrochureOrientation,
  type BrochureTemplateId,
  DEFAULT_BROCHURE_DISPLAY_OPTIONS,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { publishListingBrochurePdf } from '../_lib/server/brochure-actions';
import { createListingMedia } from '../_lib/server/server-actions';

type ListingBrochurePublishSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  accountId: string;
  accountSlug: string;
  listingName: string;
  listingAddress?: string | null;
  coverUrl?: string | null;
  /** Defaults from marketing hide flags when opening. */
  defaultShowRent?: boolean;
  defaultShowPrice?: boolean;
};

const DISPLAY_TOGGLES: Array<{
  key: keyof BrochureDisplayOptions;
  label: string;
}> = [
  { key: 'showRent', label: 'Display rent' },
  { key: 'showPrice', label: 'Display price' },
  { key: 'showSize', label: 'Display size' },
  { key: 'showRates', label: 'Display business rates' },
  { key: 'showServiceCharge', label: 'Display service charge' },
  { key: 'showEstateCharge', label: 'Display estate charge' },
  { key: 'showReducedPrice', label: 'Reduced price badge' },
];

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
}

export function ListingBrochurePublishSheet({
  open,
  onOpenChange,
  listingId,
  accountId,
  accountSlug,
  listingName,
  listingAddress,
  coverUrl,
  defaultShowRent = true,
  defaultShowPrice = true,
}: ListingBrochurePublishSheetProps) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [orientation, setOrientation] =
    useState<BrochureOrientation>('portrait');
  const [templateId, setTemplateId] = useState<BrochureTemplateId>('classic');
  const [useSaved, setUseSaved] = useState(true);
  const [display, setDisplay] = useState<BrochureDisplayOptions>({
    ...DEFAULT_BROCHURE_DISPLAY_OPTIONS,
    showRent: defaultShowRent,
    showPrice: defaultShowPrice,
  });
  const [previewPending, startPreview] = useTransition();
  const [publishPending, startPublish] = useTransition();
  const [uploadPending, startUpload] = useTransition();

  const editorHref = `${pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listingId)}/brochure?orientation=${orientation}`;

  const busy = previewPending || publishPending || uploadPending;

  function displayParams() {
    const params = new URLSearchParams({
      listingId,
      accountId,
      orientation,
      template: templateId,
    });
    if (useSaved) params.set('useSaved', '1');
    params.set('showRent', display.showRent ? '1' : '0');
    params.set('showPrice', display.showPrice ? '1' : '0');
    params.set('showSize', display.showSize ? '1' : '0');
    params.set('showRates', display.showRates ? '1' : '0');
    params.set('showServiceCharge', display.showServiceCharge ? '1' : '0');
    params.set('showEstateCharge', display.showEstateCharge ? '1' : '0');
    params.set('showReducedPrice', display.showReducedPrice ? '1' : '0');
    return params;
  }

  function previewPdf() {
    startPreview(async () => {
      try {
        const res = await fetch(
          `/api/listings/brochure-pdf?${displayParams()}`,
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? 'Could not generate PDF');
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
          res.headers
            .get('Content-Disposition')
            ?.match(/filename="([^"]+)"/)?.[1] ?? 'brochure.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not preview brochure',
        );
      }
    });
  }

  function publishPdf() {
    startPublish(async () => {
      try {
        await publishListingBrochurePdf({
          listingId,
          accountId,
          orientation,
          templateId,
          useSaved,
          display,
        });
        toast.success(
          'Brochure published to Media. Republish on portals to push it live.',
        );
        router.refresh();
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not publish brochure PDF',
        );
      }
    });
  }

  function uploadExternal(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0]!;
    startUpload(async () => {
      try {
        if (file.type && file.type !== 'application/pdf') {
          throw new Error('Please upload a PDF file');
        }
        if (file.size > 20 * 1024 * 1024) {
          throw new Error('PDF must be 20MB or smaller');
        }

        const client = getSupabaseBrowserClient();
        const path = `${accountId}/${listingId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await client.storage
          .from('commercial-listing-media')
          .upload(path, file, {
            contentType: 'application/pdf',
            upsert: false,
          });
        if (uploadError) throw new Error(uploadError.message);

        await createListingMedia({
          accountId,
          listingId,
          mediaType: 'brochure',
          storagePath: path,
          fileName: file.name,
          mimeType: 'application/pdf',
          sortOrder: 0,
        });

        toast.success(
          'External brochure uploaded to Media. Republish on portals to push it live.',
        );
        router.refresh();
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not upload brochure PDF',
        );
      } finally {
        if (uploadInputRef.current) uploadInputRef.current.value = '';
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-5 py-4 text-left">
          <SheetTitle className="text-[var(--workspace-shell-text)]">
            Publish to PDF
          </SheetTitle>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[var(--workspace-shell-text-muted)]">
                  PDF
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{listingName}</p>
              {listingAddress ? (
                <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                  {listingAddress}
                </p>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Template options</h3>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Template
                </Label>
                <Select
                  value={templateId}
                  onValueChange={(v) => setTemplateId(v as BrochureTemplateId)}
                  disabled={busy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BROCHURE_TEMPLATE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Orientation
                </Label>
                <Select
                  value={orientation}
                  onValueChange={(v) =>
                    setOrientation(v as BrochureOrientation)
                  }
                  disabled={busy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">
                      Portrait (particulars)
                    </SelectItem>
                    <SelectItem value="landscape">
                      Landscape (offering memo)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">Use saved page layout</p>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Off regenerates from the template with the toggles below.
                  </p>
                </div>
                <Switch
                  checked={useSaved}
                  disabled={busy}
                  onCheckedChange={setUseSaved}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                className="w-fit gap-1.5"
              >
                <Link href={editorHref}>
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  Edit pages
                </Link>
              </Button>
            </div>
          </section>

          <section className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-5">
            <div>
              <h3 className="text-sm font-medium">Details to include</h3>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Applies when regenerating from the template (saved layout off).
              </p>
            </div>
            <ul className="space-y-3">
              {DISPLAY_TOGGLES.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm">{item.label}</span>
                  <Switch
                    checked={display[item.key]}
                    disabled={
                      busy || (useSaved && item.key !== 'showReducedPrice')
                    }
                    onCheckedChange={(checked) =>
                      setDisplay((current) => ({
                        ...current,
                        [item.key]: checked,
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-5">
            <div>
              <h3 className="text-sm font-medium">Upload external brochure</h3>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Skip generation and attach your own PDF under Media → Brochure
                for portal publishing.
              </p>
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => uploadExternal(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              className="gap-1.5"
              data-test="brochure-upload-external"
              onClick={() => uploadInputRef.current?.click()}
            >
              {uploadPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Upload PDF
            </Button>
          </section>
        </div>

        <div className="shrink-0 border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="gap-1.5"
              data-test="brochure-preview-pdf"
              onClick={previewPdf}
            >
              {previewPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Preview PDF
            </Button>
            <Button
              type="button"
              disabled={busy}
              className={`gap-1.5 ${workspaceBtnPrimaryMd}`}
              data-test="brochure-publish-pdf"
              onClick={publishPdf}
            >
              {publishPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileUp className="h-3.5 w-3.5" />
              )}
              Publish
            </Button>
          </div>
          <p className="mt-2 text-right text-[11px] text-[var(--workspace-shell-text-muted)]">
            Publish saves the PDF to Media for portals — it does not live-push
            Rightmove by itself.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
