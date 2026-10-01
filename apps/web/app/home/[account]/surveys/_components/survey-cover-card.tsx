'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { Check, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  getWorkspaceDocDownloadUrlAction,
  listProposalDocsAction,
} from '~/home/[account]/_lib/workspace-content/docs-actions';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  type CoverFocus,
  DEFAULT_COVER_FOCUS,
  surveyCoverSource,
} from '~/lib/building-surveyor/survey-cover';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

import { updateSurveyCoverAction } from '../_lib/server/survey-report-details-actions';
import { SurveyCoverCropDialog } from './survey-cover-crop-dialog';
import { SurveyCoverFrame } from './survey-cover-frame';

type LibraryPhoto = {
  id: string;
  title: string;
  caption: string | null;
  url: string | null;
};

const SOURCE_LABEL = {
  photo: 'Cover photo from this survey',
  default: 'Your default cover image',
  first_photo: 'First photo in the report',
} as const;

export function SurveyCoverCard({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  photoDocId,
  photoUrl,
  focus: initialFocus,
  defaultUrl,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  photoDocId: string | null;
  photoUrl: string | null;
  focus: CoverFocus;
  defaultUrl: string | null;
}) {
  const [chosen, setChosen] = useState({ id: photoDocId, url: photoUrl });
  const [focus, setFocus] = useState(initialFocus);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const source = surveyCoverSource({
    photoDocId: chosen.id,
    hasDefaultImage: Boolean(defaultUrl),
  });
  const previewUrl =
    source === 'photo' ? chosen.url : source === 'default' ? defaultUrl : null;

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const { items } = await listProposalDocsAction({ accountId, proposalId });
      const images = items.filter((item) =>
        item.mimeType?.startsWith('image/'),
      );
      const withUrls = await Promise.all(
        images.map(async (item) => {
          const { url } = await getWorkspaceDocDownloadUrlAction({
            accountId,
            docId: item.id,
          });
          return {
            id: item.id,
            title: item.title,
            caption: item.caption,
            url,
          } satisfies LibraryPhoto;
        }),
      );
      setPhotos(withUrls);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const openPicker = () => {
    setPickerOpen(true);
    if (photos === null) void loadLibrary();
  };

  const save = (next: LibraryPhoto | null) => {
    startTransition(async () => {
      try {
        await updateSurveyCoverAction({
          accountId,
          accountSlug,
          proposalId,
          photoDocId: next?.id ?? null,
        });
        setChosen({ id: next?.id ?? null, url: next?.url ?? null });
        // A different photo starts centred.
        setFocus(DEFAULT_COVER_FOCUS);
        setPickerOpen(false);
        toast.success(next ? 'Cover photo set' : 'Cover photo cleared');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const saveFocus = (next: CoverFocus) => {
    startTransition(async () => {
      try {
        const result = await updateSurveyCoverAction({
          accountId,
          accountSlug,
          proposalId,
          focus: next,
        });
        setFocus(result.focus);
        setCropOpen(false);
        toast.success('Cover photo position saved');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div
      className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}
      data-test="survey-cover-card"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Front cover
        </h3>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          The cover shows your logo, the property address, the client&apos;s
          name, the inspection date and your RICS details, beside a photo of the
          building.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SurveyCoverFrame
          src={previewUrl}
          alt="Report cover"
          focus={focus}
          className="w-24 shrink-0"
        />

        <div className="min-w-0 space-y-2">
          <p
            className="text-sm text-[var(--workspace-shell-text)]"
            data-test="survey-cover-source"
          >
            {SOURCE_LABEL[source]}
          </p>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={openPicker}
                data-test="survey-cover-choose"
              >
                {chosen.id ? 'Change cover photo' : 'Choose cover photo'}
              </Button>
              {previewUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setCropOpen(true)}
                  data-test="survey-cover-adjust"
                >
                  Adjust crop
                </Button>
              ) : null}
              {chosen.id ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => save(null)}
                  data-test="survey-cover-clear"
                >
                  Use default
                </Button>
              ) : null}
            </div>
          ) : null}
          <p className={`text-xs ${workspaceTextMuted}`}>
            {defaultUrl ? 'Change' : 'Set'} the default image in{' '}
            <Link
              href={pathsConfig.app.accountSurveyorProfileSettings.replace(
                '[account]',
                accountSlug,
              )}
              className="underline underline-offset-2"
            >
              Surveyor profile settings
            </Link>
            .
          </p>
        </div>
      </div>

      {cropOpen ? (
        <SurveyCoverCropDialog
          open
          onOpenChange={setCropOpen}
          src={previewUrl}
          initialFocus={focus}
          pending={pending}
          onSave={saveFocus}
        />
      ) : null}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
          data-test="survey-cover-picker"
        >
          <DialogHeader>
            <DialogTitle>Choose a cover photo</DialogTitle>
            <DialogDescription>
              Pick a photo of the front of the building from this survey&apos;s
              photo library.
            </DialogDescription>
          </DialogHeader>

          {loading || photos === null ? (
            <div
              className={`flex items-center gap-2 py-8 text-sm ${workspaceTextMuted}`}
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Loading photos…
            </div>
          ) : photos.length === 0 ? (
            <p className={`py-8 text-sm ${workspaceTextMuted}`}>
              No photos yet. Upload photos in Content review, then choose one
              here.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => {
                const active = photo.id === chosen.id;
                return (
                  <li key={photo.id}>
                    <button
                      type="button"
                      disabled={pending || !photo.url}
                      onClick={() => save(photo)}
                      aria-pressed={active}
                      className={cn(
                        'group bg-muted/40 focus-visible:ring-ring relative block aspect-[4/3] w-full overflow-hidden rounded-lg border text-left outline-none focus-visible:ring-2',
                        active && 'ring-2 ring-[var(--workspace-shell-accent)]',
                      )}
                      data-test="survey-cover-option"
                    >
                      {photo.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={photo.caption || photo.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      {active ? (
                        <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--workspace-shell-accent)] text-white">
                          <Check className="h-3 w-3" aria-hidden />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
