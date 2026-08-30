'use client';

import type { ReactNode } from 'react';

import { Button } from '@kit/ui/button';
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

import type {
  CampaignAlign,
  CampaignBlock,
  CampaignColumnContent,
} from '~/lib/campaigns/campaign-document';
import { CAMPAIGN_MERGE_FIELDS } from '~/lib/campaigns/merge-fields';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CampaignTextBlockEditor } from './campaign-text-block-editor';

export function CampaignBlockInspector({
  block,
  disabled,
  onChange,
  onInsertMerge,
}: {
  block: CampaignBlock | null;
  disabled?: boolean;
  onChange: (patch: Partial<CampaignBlock>) => void;
  onInsertMerge: (token: string) => void;
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
        {block.type === 'columns' ? '2 columns' : block.type}
      </h3>

      {block.type === 'logo' ? (
        <>
          <AlignField
            value={block.align}
            disabled={disabled}
            onChange={(align) => onChange({ align })}
          />
          <p className={`text-xs ${workspaceTextMuted}`}>
            Uses the workspace logo from Brand settings.
          </p>
        </>
      ) : null}

      {block.type === 'heading' ? (
        <>
          <Field label="Heading">
            <Input
              value={block.text}
              disabled={disabled}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          </Field>
          <MergeChips disabled={disabled} onInsert={onInsertMerge} />
          <Field label="Size">
            <Select
              value={String(block.level)}
              disabled={disabled}
              onValueChange={(value) =>
                onChange({ level: Number(value) as 1 | 2 })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem className={workspaceSelectItemClass} value="1">
                  Large
                </SelectItem>
                <SelectItem className={workspaceSelectItemClass} value="2">
                  Medium
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <AlignField
            value={block.align}
            disabled={disabled}
            onChange={(align) => onChange({ align })}
          />
        </>
      ) : null}

      {block.type === 'text' ? (
        <>
          <CampaignTextBlockEditor
            key={block.id}
            html={block.html}
            disabled={disabled}
            onChange={(html) => onChange({ html })}
          />
          <AlignField
            value={block.align}
            disabled={disabled}
            onChange={(align) => onChange({ align })}
          />
        </>
      ) : null}

      {block.type === 'image' ? (
        <ImageFields
          src={block.src}
          alt={block.alt}
          href={block.href}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}

      {block.type === 'button' ? (
        <>
          <Field label="Label">
            <Input
              value={block.label}
              disabled={disabled}
              onChange={(event) => onChange({ label: event.target.value })}
            />
          </Field>
          <MergeChips disabled={disabled} onInsert={onInsertMerge} />
          <Field label="URL">
            <Input
              value={block.href}
              disabled={disabled}
              placeholder="https://"
              onChange={(event) => onChange({ href: event.target.value })}
            />
          </Field>
          <AlignField
            value={block.align}
            disabled={disabled}
            onChange={(align) => onChange({ align })}
          />
        </>
      ) : null}

      {block.type === 'spacer' ? (
        <Field label="Height (px)">
          <Input
            type="number"
            min={8}
            max={120}
            value={block.height}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                height: Math.min(
                  120,
                  Math.max(8, Number(event.target.value) || 24),
                ),
              })
            }
          />
        </Field>
      ) : null}

      {block.type === 'columns' ? (
        <div className="space-y-4">
          <ColumnFields
            title="Left"
            value={block.left}
            disabled={disabled}
            onChange={(left) => onChange({ left })}
          />
          <ColumnFields
            title="Right"
            value={block.right}
            disabled={disabled}
            onChange={(right) => onChange({ right })}
          />
        </div>
      ) : null}

      {block.type === 'footer' ? (
        <>
          <Field label="Footer text">
            <Textarea
              value={block.text}
              disabled={disabled}
              rows={3}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          </Field>
          <p className={`text-xs ${workspaceTextMuted}`}>
            An unsubscribe link is always added under this text.
          </p>
        </>
      ) : null}

      {block.type === 'html' ? (
        <>
          <Field label="Imported HTML">
            <Textarea
              value={block.html}
              disabled={disabled}
              rows={8}
              onChange={(event) => onChange({ html: event.target.value })}
            />
          </Field>
          <p className={`text-xs ${workspaceTextMuted}`}>
            This draft was imported from the previous editor. Replace it with
            blocks when you are ready.
          </p>
        </>
      ) : null}

      {block.type === 'divider' ? (
        <p className={`text-xs ${workspaceTextMuted}`}>
          A thin rule between sections. No extra settings.
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function AlignField({
  value,
  disabled,
  onChange,
}: {
  value?: CampaignAlign;
  disabled?: boolean;
  onChange: (align: CampaignAlign) => void;
}) {
  return (
    <Field label="Align">
      <Select
        value={value ?? 'left'}
        disabled={disabled}
        onValueChange={(next) => onChange(next as CampaignAlign)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={workspaceSelectContentClass}>
          <SelectItem className={workspaceSelectItemClass} value="left">
            Left
          </SelectItem>
          <SelectItem className={workspaceSelectItemClass} value="center">
            Centre
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function MergeChips({
  disabled,
  onInsert,
}: {
  disabled?: boolean;
  onInsert: (token: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {CAMPAIGN_MERGE_FIELDS.map((field) => (
        <Button
          key={field.token}
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={disabled}
          onClick={() => onInsert(field.token)}
        >
          {field.label}
        </Button>
      ))}
    </div>
  );
}

function ImageFields({
  src,
  alt,
  href,
  disabled,
  onChange,
}: {
  src: string;
  alt: string;
  href?: string;
  disabled?: boolean;
  onChange: (patch: { src?: string; alt?: string; href?: string }) => void;
}) {
  return (
    <>
      <Field label="Image URL">
        <Input
          value={src}
          disabled={disabled}
          placeholder="https://"
          onChange={(event) => onChange({ src: event.target.value })}
        />
      </Field>
      <Field label="Alt text">
        <Input
          value={alt}
          disabled={disabled}
          onChange={(event) => onChange({ alt: event.target.value })}
        />
      </Field>
      <Field label="Optional link">
        <Input
          value={href ?? ''}
          disabled={disabled}
          placeholder="https://"
          onChange={(event) => onChange({ href: event.target.value })}
        />
      </Field>
    </>
  );
}

function ColumnFields({
  title,
  value,
  disabled,
  onChange,
}: {
  title: string;
  value: CampaignColumnContent;
  disabled?: boolean;
  onChange: (value: CampaignColumnContent) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
      <p className={`text-xs font-medium ${workspaceText}`}>{title}</p>
      <Select
        value={value.kind}
        disabled={disabled}
        onValueChange={(kind) => {
          onChange(
            kind === 'image'
              ? { kind: 'image', src: '', alt: '' }
              : { kind: 'text', html: '<p></p>' },
          );
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={workspaceSelectContentClass}>
          <SelectItem className={workspaceSelectItemClass} value="text">
            Text
          </SelectItem>
          <SelectItem className={workspaceSelectItemClass} value="image">
            Image
          </SelectItem>
        </SelectContent>
      </Select>
      {value.kind === 'text' ? (
        <CampaignTextBlockEditor
          key={`${title}-text`}
          html={value.html}
          disabled={disabled}
          onChange={(html) => onChange({ kind: 'text', html })}
        />
      ) : (
        <ImageFields
          src={value.src}
          alt={value.alt}
          href={value.href}
          disabled={disabled}
          onChange={(patch) => onChange({ ...value, ...patch })}
        />
      )}
    </div>
  );
}
