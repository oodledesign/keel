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
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Connected: {props.success}
      </div>
    );
  }
  return null;
}
