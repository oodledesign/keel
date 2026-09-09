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

import {
  brandLogoChoiceIsExact,
  resolveBrandLogoChoice,
} from '~/lib/brand/resolve-brand-logo';
import {
  CAMPAIGN_PADDING_PRESETS,
  type CampaignPaddingPreset,
  defaultCampaignBlockPadding,
  detectCampaignPaddingPreset,
  isCampaignHexColor,
} from '~/lib/campaigns/campaign-block-style';
import type {
  CampaignAlign,
  CampaignBlock,
  CampaignBrand,
  CampaignColumnContent,
  CampaignImageSize,
  CampaignLogoVariant,
  CampaignPadding,
} from '~/lib/campaigns/campaign-document';
import { isCampaignFormUrlToken } from '~/lib/campaigns/form-link';
import { CAMPAIGN_MERGE_FIELDS } from '~/lib/campaigns/merge-fields';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CampaignImagePicker } from './campaign-image-picker';
import { CampaignTextBlockEditor } from './campaign-text-block-editor';

export function CampaignBlockInspector({
  block,
  brand,
  accountId,
  disabled,
  onChange,
  onInsertMerge,
}: {
  block: CampaignBlock | null;
  brand: CampaignBrand;
  accountId?: string;
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
          <LogoVariantField
            value={block.logoVariant}
            brand={brand}
            disabled={disabled}
            onChange={(logoVariant) => onChange({ logoVariant })}
          />
          <AlignField
            value={block.align}
            disabled={disabled}
            onChange={(align) => onChange({ align })}
          />
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
          accountId={accountId}
          src={block.src}
          alt={block.alt}
          href={block.href}
          align={block.align}
          size={block.size}
          width={block.width}
          height={block.height}
          showLayout
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
          <MergeChips
            disabled={disabled}
            onInsert={onInsertMerge}
            tokens={CAMPAIGN_MERGE_FIELDS.filter(
              (field) => !isCampaignFormUrlToken(field.token),
            )}
          />
          <Field label="URL">
            <Input
              value={block.href}
              disabled={disabled}
              placeholder="https://"
              onChange={(event) => onChange({ href: event.target.value })}
            />
          </Field>
          <MergeChips
            disabled={disabled}
            onInsert={onInsertMerge}
            tokens={CAMPAIGN_MERGE_FIELDS.filter((field) =>
              isCampaignFormUrlToken(field.token),
            )}
          />
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
            accountId={accountId}
            value={block.left}
            disabled={disabled}
            onChange={(left) => onChange({ left })}
          />
          <ColumnFields
            title="Right"
            accountId={accountId}
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
          A thin rule between sections.
        </p>
      ) : null}

      <BlockLayoutFields
        block={block}
        brand={brand}
        disabled={disabled}
        onChange={onChange}
      />
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
          <SelectItem className={workspaceSelectItemClass} value="right">
            Right
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function LogoVariantField({
  value,
  brand,
  disabled,
  onChange,
}: {
  value?: CampaignLogoVariant;
  brand: CampaignBrand;
  disabled?: boolean;
  onChange: (variant: CampaignLogoVariant) => void;
}) {
  const choice = value ?? 'primary';
  const resolved = resolveBrandLogoChoice(brand, choice);
  const exact = brandLogoChoiceIsExact(brand, choice);

  return (
    <>
      <Field label="Logo">
        <Select
          value={choice}
          disabled={disabled}
          onValueChange={(next) => onChange(next as CampaignLogoVariant)}
        >
          <SelectTrigger data-test="campaign-logo-variant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={workspaceSelectContentClass}>
            <SelectItem className={workspaceSelectItemClass} value="primary">
              Primary
            </SelectItem>
            <SelectItem className={workspaceSelectItemClass} value="on_light">
              On light
            </SelectItem>
            <SelectItem className={workspaceSelectItemClass} value="on_dark">
              On dark
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <p className={`text-xs ${workspaceTextMuted}`}>
        {resolved
          ? exact
            ? 'Uses the matching logo from Brand settings.'
            : 'That variant is not uploaded — using the next available brand logo.'
          : 'No workspace logo yet. Add one in Brand settings.'}
      </p>
    </>
  );
}

function MergeChips({
  disabled,
  onInsert,
  tokens = CAMPAIGN_MERGE_FIELDS,
}: {
  disabled?: boolean;
  onInsert: (token: string) => void;
  tokens?: readonly { token: string; label: string }[];
}) {
  if (tokens.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tokens.map((field) => (
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
  accountId,
  src,
  alt,
  href,
  align,
  size,
  width,
  height,
  showLayout,
  disabled,
  onChange,
}: {
  accountId?: string;
  src: string;
  alt: string;
  href?: string;
  align?: CampaignAlign;
  size?: CampaignImageSize;
  width?: number;
  height?: number;
  showLayout?: boolean;
  disabled?: boolean;
  onChange: (patch: {
    src?: string;
    alt?: string;
    href?: string;
    align?: CampaignAlign;
    size?: CampaignImageSize;
    width?: number;
    height?: number;
  }) => void;
}) {
  return (
    <>
      <CampaignImagePicker
        accountId={accountId}
        src={src}
        disabled={disabled}
        onChange={(next) => onChange({ src: next })}
      />
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
      {showLayout ? (
        <>
          <AlignField
            value={align}
            disabled={disabled}
            onChange={(next) => onChange({ align: next })}
          />
          <Field label="Size">
            <Select
              value={size ?? 'default'}
              disabled={disabled}
              onValueChange={(value) => {
                if (value === 'default') {
                  onChange({
                    size: undefined,
                    width: undefined,
                    height: undefined,
                  });
                  return;
                }
                onChange({ size: value as CampaignImageSize });
              }}
            >
              <SelectTrigger data-test="campaign-image-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem
                  className={workspaceSelectItemClass}
                  value="default"
                >
                  Default
                </SelectItem>
                <SelectItem className={workspaceSelectItemClass} value="full">
                  Full width
                </SelectItem>
                <SelectItem className={workspaceSelectItemClass} value="large">
                  Large
                </SelectItem>
                <SelectItem className={workspaceSelectItemClass} value="medium">
                  Medium
                </SelectItem>
                <SelectItem className={workspaceSelectItemClass} value="small">
                  Small
                </SelectItem>
                <SelectItem className={workspaceSelectItemClass} value="custom">
                  Custom
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {size === 'custom' ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width (px)">
                <Input
                  type="number"
                  min={40}
                  max={600}
                  value={width ?? 544}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      size: 'custom',
                      width: Math.min(
                        600,
                        Math.max(40, Number(event.target.value) || 544),
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Height (px)">
                <Input
                  type="number"
                  min={20}
                  max={1200}
                  value={height ?? ''}
                  placeholder="Auto"
                  disabled={disabled}
                  onChange={(event) => {
                    const raw = event.target.value;
                    onChange({
                      size: 'custom',
                      height: raw
                        ? Math.min(1200, Math.max(20, Number(raw) || 20))
                        : undefined,
                    });
                  }}
                />
              </Field>
            </div>
          ) : null}
          {size === 'full' ? (
            <p className={`text-xs ${workspaceTextMuted}`}>
              Full width spans the email. Set padding to None for edge-to-edge.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function ColumnFields({
  title,
  accountId,
  value,
  disabled,
  onChange,
}: {
  title: string;
  accountId?: string;
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
          accountId={accountId}
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

function BlockLayoutFields({
  block,
  brand,
  disabled,
  onChange,
}: {
  block: CampaignBlock;
  brand: CampaignBrand;
  disabled?: boolean;
  onChange: (patch: Partial<CampaignBlock>) => void;
}) {
  const imageSize = block.type === 'image' ? block.size : undefined;
  const preset = detectCampaignPaddingPreset(
    block.padding,
    block.type,
    imageSize,
  );
  const padding =
    block.padding ?? defaultCampaignBlockPadding(block.type, imageSize);
  const background =
    block.backgroundColor === 'transparent' ||
    block.backgroundColor === '' ||
    block.backgroundColor === null
      ? ''
      : (block.backgroundColor ?? '');
  const swatches = [
    brand.primary_color,
    brand.secondary_color,
    brand.accent_color,
  ].filter((value): value is string => isCampaignHexColor(value));

  return (
    <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-3">
      <p className={`text-xs font-medium ${workspaceText}`}>Layout</p>
      <Field label="Background">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-[color:var(--workspace-shell-border)] bg-transparent disabled:opacity-50"
            value={
              background.startsWith('#') ? background.slice(0, 7) : '#ffffff'
            }
            disabled={disabled}
            aria-label="Background colour"
            onChange={(event) =>
              onChange({ backgroundColor: event.target.value })
            }
          />
          <Input
            value={background}
            disabled={disabled}
            placeholder="None"
            className="max-w-[120px] font-mono text-sm"
            spellCheck={false}
            onChange={(event) =>
              onChange({
                backgroundColor: event.target.value.trim() || 'transparent',
              })
            }
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            disabled={disabled}
            onClick={() => onChange({ backgroundColor: 'transparent' })}
          >
            None
          </Button>
        </div>
      </Field>
      {swatches.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((color) => (
            <button
              key={color}
              type="button"
              disabled={disabled}
              title={color}
              aria-label={`Use brand colour ${color}`}
              className="h-6 w-6 rounded-full border border-[color:var(--workspace-shell-border)] disabled:opacity-50"
              style={{ background: color }}
              onClick={() => onChange({ backgroundColor: color })}
            />
          ))}
        </div>
      ) : null}
      {block.type === 'logo' && !block.backgroundColor ? (
        <p className={`text-xs ${workspaceTextMuted}`}>
          Default background is the brand primary colour. Choose None to sit the
          logo on the email body.
        </p>
      ) : null}

      <Field label="Padding">
        <Select
          value={preset}
          disabled={disabled}
          onValueChange={(value) => {
            const next = value as CampaignPaddingPreset;
            if (next === 'default') {
              onChange({ padding: undefined });
              return;
            }
            if (next === 'custom') {
              onChange({ padding });
              return;
            }
            onChange({ padding: { ...CAMPAIGN_PADDING_PRESETS[next] } });
          }}
        >
          <SelectTrigger data-test="campaign-block-padding">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={workspaceSelectContentClass}>
            <SelectItem className={workspaceSelectItemClass} value="default">
              Default
            </SelectItem>
            <SelectItem className={workspaceSelectItemClass} value="none">
              None
            </SelectItem>
            <SelectItem className={workspaceSelectItemClass} value="tight">
              Tight
            </SelectItem>
            <SelectItem
              className={workspaceSelectItemClass}
              value="comfortable"
            >
              Comfortable
            </SelectItem>
            <SelectItem className={workspaceSelectItemClass} value="custom">
              Custom
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {preset === 'custom' ? (
        <CustomPaddingFields
          value={padding}
          disabled={disabled}
          onChange={(next) => onChange({ padding: next })}
        />
      ) : null}
    </div>
  );
}

function CustomPaddingFields({
  value,
  disabled,
  onChange,
}: {
  value: CampaignPadding;
  disabled?: boolean;
  onChange: (padding: CampaignPadding) => void;
}) {
  const side = (label: keyof CampaignPadding, display: string) => (
    <Field label={display}>
      <Input
        type="number"
        min={0}
        max={160}
        value={value[label]}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value === '') return;
          onChange({
            ...value,
            [label]: Math.min(
              160,
              Math.max(0, Number(event.target.value) || 0),
            ),
          });
        }}
      />
    </Field>
  );

  return (
    <div className="space-y-2">
      <Field label="All sides">
        <Input
          type="number"
          min={0}
          max={160}
          value={
            value.top === value.right &&
            value.right === value.bottom &&
            value.bottom === value.left
              ? value.top
              : ''
          }
          placeholder="Mixed"
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value === '') return;
            const next = Math.min(
              160,
              Math.max(0, Number(event.target.value) || 0),
            );
            onChange({ top: next, right: next, bottom: next, left: next });
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {side('top', 'Top')}
        {side('right', 'Right')}
        {side('bottom', 'Bottom')}
        {side('left', 'Left')}
      </div>
    </div>
  );
}
