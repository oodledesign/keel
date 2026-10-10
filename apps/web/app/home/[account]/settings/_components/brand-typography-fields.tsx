'use client';

import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import {
  BRAND_FONT_OPTIONS,
  type BrandFontId,
  type BrandFonts,
  parseBrandFontId,
} from '~/lib/brand/brand-fonts.shared';
import { brandFontFamily, brandFontStyle } from '~/lib/brand/brand-fonts.web';

const STANDARD = 'standard';

const GROUPS = [
  { category: 'sans', label: 'Sans serif' },
  { category: 'serif', label: 'Serif' },
] as const;

export function BrandTypographyFields({
  value,
  onChange,
  primaryColor,
  accentColor,
  disabled,
}: {
  value: BrandFonts;
  onChange: (next: BrandFonts) => void;
  primaryColor: string;
  accentColor: string;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Typography</Label>
        <p className="text-muted-foreground text-xs">
          Used in brochure PDFs, online brochures, public forms, booking pages,
          meeting polls and shared match lists. Standard keeps Lora headings
          with Helvetica text in PDFs and the default fonts on public pages.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FontSelect
          id="brand-heading-font"
          label="Heading font"
          value={value.heading}
          onChange={(heading) => onChange({ ...value, heading })}
          disabled={disabled}
        />
        <FontSelect
          id="brand-body-font"
          label="Body font"
          value={value.body}
          onChange={(body) => onChange({ ...value, body })}
          disabled={disabled}
        />
      </div>

      <div
        className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-white)] text-[var(--ozer-text-on-light)]"
        style={brandFontStyle(value)}
        aria-label="Typography preview"
      >
        <div className="h-1.5" style={{ background: accentColor }} />
        <div className="space-y-2 p-5">
          <p
            className="text-[11px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: primaryColor }}
          >
            To let · Office
          </p>
          <p className="font-heading text-2xl leading-tight font-semibold">
            10 High Street, Otford
          </p>
          <p className="text-sm leading-relaxed text-[var(--ozer-text-on-light-muted)]">
            A bright first-floor suite with excellent natural light, a short
            walk from the station and village amenities.
          </p>
        </div>
      </div>
    </div>
  );
}

function FontSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: BrandFontId | null;
  onChange: (next: BrandFontId | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Select
        value={value ?? STANDARD}
        onValueChange={(next) => onChange(parseBrandFontId(next))}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={STANDARD}>Standard</SelectItem>
          {GROUPS.map((group) => (
            <SelectGroup key={group.category}>
              <SelectLabel>{group.label}</SelectLabel>
              {BRAND_FONT_OPTIONS.filter(
                (option) => option.category === group.category,
              ).map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <span style={{ fontFamily: brandFontFamily(option.id) }}>
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
