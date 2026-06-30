type FeedflowOauthBannerProps = {
  error?: string | null;
  success?: string | null;
};

export function FeedflowOauthBanner(props: FeedflowOauthBannerProps) {
  if (props.error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
      >
        {props.error}
      </div>
    );
  }
  if (props.success) {
    return (
      <div className="rounded-lg border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-sm text-[var(--ozer-accent-muted)]">
        Connected: {props.success}
      </div>
    );
  }
  return null;
}
