'use client';

import { type ReactNode, useCallback, useState } from 'react';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';

import { getWorkspaceDocDownloadUrlAction } from '~/home/[account]/_lib/workspace-content/docs-actions';
import { CampaignTextBlockEditor } from '~/home/[account]/email-campaigns/_components/campaign-text-block-editor';
import { BUILDING_SURVEY_SECTIONS } from '~/lib/building-surveyor/report-sections';
import type { SurveyReportBlock } from '~/lib/building-surveyor/survey-report-document';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

type CuratedPhoto = {
  id: string;
  title: string;
  caption?: string | null;
  pinnedSectionKey?: string | null;
  previewUrl?: string;
};

export function SurveyReportBlockInspector({
  block,
  accountId,
  photos,
  disabled,
  onChange,
}: {
  block: SurveyReportBlock | null;
  accountId: string;
  photos: CuratedPhoto[];
  disabled?: boolean;
  onChange: (patch: Partial<SurveyReportBlock>) => void;
}) {
  if (!block) {
    return (
      <p className={`text-sm ${workspaceTextMuted}`}>
        Select a block on the canvas, or add one from the palette.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className={`text-sm font-semibold capitalize ${workspaceText}`}>
        {block.type}
      </h3>

      {block.type === 'heading' ? (
        <>
          <Field label="Heading">
            <Input
              value={block.text}
              disabled={disabled}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          </Field>
          <Field label="Section">
            <select
              value={block.sectionKey ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  sectionKey: event.target.value || undefined,
                  text:
                    BUILDING_SURVEY_SECTIONS.find(
                      (section) => section.key === event.target.value,
                    )?.heading ?? block.text,
                })
              }
              className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-1.5 text-sm"
            >
              <option value="">Custom</option>
              {BUILDING_SURVEY_SECTIONS.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.group} · {section.heading}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}

      {block.type === 'text' ? (
        <CampaignTextBlockEditor
          html={block.html}
          disabled={disabled}
          onChange={(html) => onChange({ html })}
        />
      ) : null}

      {block.type === 'image' ? (
        <ImageFields
          block={block}
          accountId={accountId}
          photos={photos}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}

      {block.type === 'divider' ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          A horizontal rule between sections.
        </p>
      ) : null}
    </div>
  );
}

function ImageFields({
  block,
  accountId,
  photos,
  disabled,
  onChange,
}: {
  block: Extract<SurveyReportBlock, { type: 'image' }>;
  accountId: string;
  photos: CuratedPhoto[];
  disabled?: boolean;
  onChange: (patch: Partial<SurveyReportBlock>) => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pickPhoto = useCallback(
    async (photo: CuratedPhoto) => {
      if (disabled) return;
      setLoadingId(photo.id);
      try {
        const signed = await getWorkspaceDocDownloadUrlAction({
          accountId,
          docId: photo.id,
        });
        onChange({
          documentId: photo.id,
          src: signed.url ?? photo.previewUrl ?? '',
          alt: photo.caption || photo.title,
          caption: photo.caption || photo.title,
          sectionKey: photo.pinnedSectionKey ?? block.sectionKey,
        });
      } finally {
        setLoadingId(null);
      }
    },
    [accountId, block.sectionKey, disabled, onChange],
  );

  return (
    <div className="space-y-3">
      <Field label="Caption">
        <Textarea
          value={block.caption ?? ''}
          disabled={disabled}
          rows={3}
          onChange={(event) =>
            onChange({
              caption: event.target.value,
              alt: event.target.value,
            })
          }
        />
      </Field>

      {photos.length > 0 ? (
        <div>
          <Label className={`text-xs ${workspaceTextMuted}`}>
            Curated survey photos
          </Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                disabled={disabled || loadingId === photo.id}
                onClick={() => void pickPhoto(photo)}
                className={`overflow-hidden rounded-lg border text-left ${
                  block.documentId === photo.id
                    ? 'border-[var(--ozer-accent)]'
                    : 'border-[color:var(--workspace-shell-border)]'
                }`}
              >
                {photo.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt={photo.caption || photo.title}
                    className="h-16 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 items-center justify-center text-[10px] text-[var(--workspace-shell-text-muted)]">
                    {photo.title}
                  </div>
                )}
                <p className="line-clamp-2 px-1.5 py-1 text-[10px] text-[var(--workspace-shell-text)]">
                  {photo.caption || photo.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className={`text-xs ${workspaceTextMuted}`}>
          Curate photos on the survey hub to place them in this report.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className={`text-xs ${workspaceTextMuted}`}>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
