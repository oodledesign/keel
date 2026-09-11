import { resolveBrandLogoForSurface } from '~/lib/brand/resolve-brand-logo';
import type {
  CampaignBrand,
  CampaignDocument,
} from '~/lib/campaigns/campaign-document';
import { campaignListPreviewHints } from '~/lib/campaigns/campaign-list-preview';

const FALLBACK_PRIMARY = '#0D2344';
const FALLBACK_ACCENT = '#57C87F';

/**
 * CSS miniature of the email — brand colours + logo + subject/heading.
 * Does not render HTML, iframes, or remote campaign images.
 */
export function CampaignListThumbnail({
  brand,
  subject,
  bodyDocument,
}: {
  brand: CampaignBrand;
  subject: string;
  bodyDocument: CampaignDocument | null;
}) {
  const hints = campaignListPreviewHints(bodyDocument, subject);
  const primary = brand.primary_color?.trim() || FALLBACK_PRIMARY;
  const accent = brand.accent_color?.trim() || FALLBACK_ACCENT;
  const logo = resolveBrandLogoForSurface(brand, 'light');

  return (
    <div
      aria-hidden
      data-test="campaign-thumbnail"
      className="relative h-[4.75rem] w-14 shrink-0 overflow-hidden rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-cream-50)]"
    >
      <div className="h-3.5" style={{ background: primary }} />
      <div className="space-y-1 px-1.5 py-1.5">
        {logo ? (
          // Brand logo is one shared URL for the workspace — not per-campaign fetches.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            loading="lazy"
            className="h-2.5 w-auto max-w-full object-contain object-left"
          />
        ) : (
          <div
            className="h-1.5 w-6 rounded-[2px] opacity-40"
            style={{ background: primary }}
          />
        )}
        <p className="truncate text-[7px] leading-tight font-[var(--ozer-font-display)] font-semibold text-[var(--ozer-text-on-light)]">
          {hints.heading}
        </p>
        {hints.hasColumns ? (
          <div className="grid grid-cols-2 gap-0.5">
            <div className="h-2.5 rounded-[2px] bg-[var(--ozer-cream-200)]" />
            <div className="h-2.5 rounded-[2px] bg-[var(--ozer-cream-200)]" />
          </div>
        ) : hints.hasImage ? (
          <div className="h-2.5 rounded-[2px] bg-[var(--ozer-cream-200)]" />
        ) : (
          <div className="space-y-0.5">
            <div className="h-0.5 w-full rounded bg-[var(--ozer-plum-950)]/20" />
            <div className="h-0.5 w-4/5 rounded bg-[var(--ozer-plum-950)]/15" />
          </div>
        )}
        <div
          className="h-1.5 w-7 rounded-[2px]"
          style={{ background: accent, opacity: hints.hasButton ? 1 : 0.7 }}
        />
      </div>
    </div>
  );
}
