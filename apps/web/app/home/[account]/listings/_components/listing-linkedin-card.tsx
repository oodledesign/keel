'use client';

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import Link from 'next/link';

import { ExternalLink, Linkedin, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import { useAiCreditsExhausted } from '~/components/ai/ai-credits-exhausted-context';
import { handleAiCreditsFailure } from '~/components/ai/handle-ai-credits-failure';
import pathsConfig from '~/config/paths.config';
import { getAppSiteOrigin } from '~/lib/app-host-routing';
import { MAX_LINKEDIN_IMAGES } from '~/lib/commercial/linkedin-publishing/constants';
import { resolveListingPublicUrl } from '~/lib/commercial/linkedin-publishing/listing-public-url';
import type {
  LinkedInCopySource,
  LinkedInOrgConnectionPublic,
  ListingLinkedInPostPublic,
} from '~/lib/commercial/linkedin-publishing/types';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import {
  applyListingDescriptionToLinkedInAction,
  generateLinkedInPostCopyAction,
  postListingToLinkedInNowAction,
  previewLinkedInOverlayAction,
  saveListingLinkedInDraftAction,
  scheduleListingLinkedInAction,
} from '../_lib/server/listing-linkedin-actions';
import type {
  CommercialListing,
  CommercialListingMedia,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import { useDisposalAccess } from './disposal-access-context';

function mediaThumb(item: CommercialListingMedia): string | null {
  return item.url ?? item.externalUrl ?? null;
}

function defaultImageIds(media: CommercialListingMedia[]): string[] {
  const images = media.filter(
    (item) =>
      !item.isPrivate &&
      (item.mediaType === 'image' ||
        Boolean(item.mimeType?.startsWith('image/'))),
  );
  const cover = images.find((item) => item.isCover) ?? images[0];
  return cover ? [cover.id] : [];
}

function formatLondon(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function toDatetimeLocalLondon(iso?: string | null): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function londonLocalToIso(value: string): string {
  const [day, time] = value.split('T');
  const [year, month, date] = (day ?? '').split('-').map(Number);
  const [hour, minute] = (time ?? '').split(':').map(Number);
  const asUtcGuess = Date.UTC(
    year ?? 0,
    (month ?? 1) - 1,
    date ?? 1,
    hour ?? 0,
    minute ?? 0,
  );
  const offsetProbe = new Date(
    new Date(asUtcGuess).toLocaleString('en-US', { timeZone: 'Europe/London' }),
  );
  const delta = asUtcGuess - offsetProbe.getTime();
  return new Date(asUtcGuess + delta).toISOString();
}

export function ListingLinkedInCard({
  listing,
  accountId,
  accountSlug,
  media,
  publications,
  connection,
  initialPost,
  lastPosted,
}: {
  listing: CommercialListing;
  accountId: string;
  accountSlug: string;
  media: CommercialListingMedia[];
  publications: CommercialPortalPublication[];
  connection: LinkedInOrgConnectionPublic | null;
  initialPost: ListingLinkedInPostPublic | null;
  lastPosted: ListingLinkedInPostPublic | null;
}) {
  const { canEditDisposals } = useDisposalAccess();
  const readOnly = !canEditDisposals;
  const {
    reportExhausted,
    accountId: creditsAccountId,
    billingHref,
  } = useAiCreditsExhausted();

  const publishingHref =
    pathsConfig.app.accountCommercialPublishing?.replace(
      '[account]',
      accountSlug,
    ) ?? `/home/${accountSlug}/commercial-publishing`;

  const images = useMemo(
    () =>
      media.filter(
        (item) =>
          !item.isPrivate &&
          (item.mediaType === 'image' ||
            Boolean(item.mimeType?.startsWith('image/'))),
      ),
    [media],
  );

  const publicUrl = useMemo(
    () =>
      resolveListingPublicUrl({
        websiteUrl: listing.websiteUrl,
        brochureShareEnabled: listing.brochureShareEnabled,
        brochureShareToken: listing.brochureShareToken,
        publications,
        appOrigin:
          typeof window !== 'undefined'
            ? window.location.origin
            : getAppSiteOrigin(),
      }),
    [
      listing.websiteUrl,
      listing.brochureShareEnabled,
      listing.brochureShareToken,
      publications,
    ],
  );

  const [source, setSource] = useState<LinkedInCopySource>('manual');
  const [body, setBody] = useState(initialPost?.body ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialPost?.imageMediaIds?.length
      ? initialPost.imageMediaIds
      : defaultImageIds(images),
  );
  const [overlayFirst, setOverlayFirst] = useState(
    initialPost?.overlayFirst ?? true,
  );
  const [scheduledLocal, setScheduledLocal] = useState(
    toDatetimeLocalLondon(initialPost?.scheduledAt),
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [generating, startGenerate] = useTransition();
  const [previewing, startPreview] = useTransition();

  const firstSelected = images.find((item) => item.id === selectedIds[0]);
  const lastSuccess = lastPosted?.status === 'posted' ? lastPosted : null;

  const previewMediaId =
    overlayFirst && !readOnly ? (firstSelected?.id ?? null) : null;

  // Server-compose a JPEG preview when the first selected photo changes.
  useEffect(() => {
    if (!previewMediaId) return;
    let cancelled = false;
    startPreview(async () => {
      try {
        const result = await previewLinkedInOverlayAction({
          accountId,
          listingId: listing.id,
          mediaId: previewMediaId,
        });
        if (!cancelled) setPreviewUrl(result.dataUrl);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, listing.id, previewMediaId]);

  const toggleImage = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        return next;
      }
      if (current.length >= MAX_LINKEDIN_IMAGES) {
        toast.error(`LinkedIn allows at most ${MAX_LINKEDIN_IMAGES} photos`);
        return current;
      }
      return [...current, id];
    });
  };

  const generateAi = () => {
    startGenerate(async () => {
      try {
        const result = await generateLinkedInPostCopyAction({
          accountId,
          listingId: listing.id,
        });
        setSource('ai');
        setBody(result.body);
        toast.success('LinkedIn draft ready — review and save');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not generate post';
        if (
          handleAiCreditsFailure(reportExhausted, {
            accountId: creditsAccountId || accountId,
            billingHref,
            message,
          })
        ) {
          return;
        }
        toast.error(message);
      }
    });
  };

  const useDescription = () => {
    startGenerate(async () => {
      try {
        const result = await applyListingDescriptionToLinkedInAction({
          accountId,
          listingId: listing.id,
        });
        setSource('description');
        setBody(result.body);
        toast.success('Listing description applied');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not use description',
        );
      }
    });
  };

  const payload = () => ({
    accountId,
    listingId: listing.id,
    postId:
      initialPost && initialPost.status !== 'posted'
        ? initialPost.id
        : undefined,
    body,
    imageMediaIds: selectedIds,
    overlayFirst,
    listingUrl: publicUrl.url,
  });

  const saveDraft = () => {
    startTransition(async () => {
      try {
        await saveListingLinkedInDraftAction(payload());
        toast.success('LinkedIn draft saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save draft',
        );
      }
    });
  };

  const postNow = () => {
    if (
      !confirm(
        'Post this to the connected LinkedIn company page now? This does not publish the listing to portals.',
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await postListingToLinkedInNowAction(payload());
        toast.success('Posted to LinkedIn');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Post failed');
      }
    });
  };

  const schedule = () => {
    if (!scheduledLocal) {
      toast.error('Choose a date and time (Europe/London)');
      return;
    }
    startTransition(async () => {
      try {
        await scheduleListingLinkedInAction({
          ...payload(),
          scheduledAt: londonLocalToIso(scheduledLocal),
        });
        toast.success('LinkedIn post scheduled');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not schedule post',
        );
      }
    });
  };

  const connected =
    connection?.status === 'connected' ||
    connection?.status === 'needs_reconnect';

  return (
    <Card id="linkedin" className={`${workspacePanelCard} scroll-mt-36`}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base text-[var(--workspace-shell-text)]">
          <Linkedin className="h-4 w-4" />
          LinkedIn
        </CardTitle>
        {connected ? (
          <span className="text-xs text-[var(--workspace-shell-text-muted)]">
            {connection.orgName ?? `Page ${connection.orgId}`}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--workspace-shell-text)]/60">
              Connect a LinkedIn company page in Website & portals to post this
              disposal.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={publishingHref}>Commercial publishing settings</Link>
            </Button>
          </div>
        ) : null}

        {connection?.status === 'needs_reconnect' ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-[var(--workspace-shell-text)]">
            Reconnect the LinkedIn page — the token expired or was revoked.{' '}
            <Link href={publishingHref} className="underline">
              Open settings
            </Link>
          </p>
        ) : null}

        <div className="space-y-2">
          <Label>Post copy</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={source === 'ai' ? 'default' : 'outline'}
              size="sm"
              disabled={generating || readOnly}
              onClick={generateAi}
            >
              {generating && source === 'ai' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Generate with AI
            </Button>
            <Button
              type="button"
              variant={source === 'manual' ? 'default' : 'outline'}
              size="sm"
              disabled={readOnly}
              onClick={() => setSource('manual')}
            >
              Write your own
            </Button>
            <Button
              type="button"
              variant={source === 'description' ? 'default' : 'outline'}
              size="sm"
              disabled={generating || readOnly}
              onClick={useDescription}
            >
              Use listing description
            </Button>
          </div>
          <Textarea
            value={body}
            disabled={readOnly}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              setSource('manual');
              setBody(event.target.value);
            }}
            rows={7}
            placeholder="Short LinkedIn post — address, size, tenure, rent or price, and the listing link on the last line."
          />
        </div>

        <div className="space-y-2">
          <Label>
            Photos ({selectedIds.length}/{MAX_LINKEDIN_IMAGES})
          </Label>
          {images.length === 0 ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Add listing photos on Media first.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((item) => {
                const selected = selectedIds.includes(item.id);
                const thumb = mediaThumb(item);
                const order = selectedIds.indexOf(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleImage(item.id)}
                    className={`relative overflow-hidden rounded-lg border ${
                      selected
                        ? 'border-[var(--ozer-accent)] ring-2 ring-[var(--ozer-accent)]'
                        : 'border-[color:var(--workspace-shell-border)]'
                    }`}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={item.fileName ?? 'Listing photo'}
                        className="aspect-[1.91] h-16 w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[1.91] h-16 items-center justify-center bg-[var(--workspace-shell-sidebar-accent)] text-[10px] text-[var(--workspace-shell-text-muted)]">
                        Photo
                      </div>
                    )}
                    {selected ? (
                      <span className="absolute top-1 left-1 rounded bg-[var(--ozer-accent)] px-1.5 text-[10px] font-medium text-[var(--ozer-white)]">
                        {order + 1}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--workspace-shell-text)]">
              Overlay on first photo
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Status chip, rent/price (POA if hidden), town or size.
            </p>
          </div>
          <Switch
            checked={overlayFirst}
            disabled={readOnly}
            onCheckedChange={setOverlayFirst}
          />
        </div>

        {overlayFirst && firstSelected ? (
          <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]">
            {previewing && !previewUrl ? (
              <div className="flex h-36 items-center justify-center text-xs text-[var(--workspace-shell-text-muted)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating overlay preview
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl ?? mediaThumb(firstSelected) ?? ''}
                alt="LinkedIn overlay preview"
                className="aspect-[1.91] w-full object-cover"
              />
            )}
          </div>
        ) : null}

        <div className="rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 text-xs text-[var(--workspace-shell-text)]/70">
          {publicUrl.url ? (
            <p>
              Listing link ({publicUrl.label}):{' '}
              <a
                href={publicUrl.url}
                target="_blank"
                rel="noreferrer"
                className="break-all underline"
              >
                {publicUrl.url}
              </a>
            </p>
          ) : (
            <p>
              No public listing URL yet (website, portal, or brochure share).
              You can still save a draft.
            </p>
          )}
        </div>

        {lastSuccess?.postedAt ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Last posted {formatLondon(lastSuccess.postedAt)}
            {lastSuccess.linkedinPostUrl ? (
              <>
                {' · '}
                <a
                  href={lastSuccess.linkedinPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  View on LinkedIn
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            ) : null}
          </p>
        ) : null}

        {initialPost?.status === 'scheduled' && initialPost.scheduledAt ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Scheduled for {formatLondon(initialPost.scheduledAt)}{' '}
            (Europe/London)
          </p>
        ) : null}

        {initialPost?.status === 'failed' && initialPost.error ? (
          <p className="text-xs text-rose-500">{initialPost.error}</p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`linkedin-schedule-${listing.id}`}>
            Schedule (Europe/London)
          </Label>
          <input
            id={`linkedin-schedule-${listing.id}`}
            type="datetime-local"
            value={scheduledLocal}
            disabled={readOnly}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setScheduledLocal(event.target.value)
            }
            className="h-10 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-3 text-sm text-[var(--workspace-shell-text)]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending || readOnly}
            onClick={saveDraft}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save draft
          </Button>
          <Button
            type="button"
            disabled={pending || readOnly || !connected}
            onClick={postNow}
            className={workspaceBtnPrimaryMd}
          >
            Post now
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || readOnly || !connected}
            onClick={schedule}
          >
            Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
