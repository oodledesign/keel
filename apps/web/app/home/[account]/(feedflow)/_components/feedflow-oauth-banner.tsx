import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';

type FeedflowOauthBannerProps = {
  error?: string | null;
  success?: string | null;
};

/** Map raw OAuth / gate messages to short, actionable copy. */
function friendlyError(raw: string): { title: string; description: string } {
  const lower = raw.toLowerCase();

  if (lower.includes('not a member')) {
    return {
      title: 'Couldn’t connect',
      description:
        'You need to be a member of this workspace to connect social accounts. Ask an admin to invite you, then try again.',
    };
  }

  if (lower.includes('feedflow add-on') || lower.includes('addon')) {
    return {
      title: 'Feedflow isn’t enabled',
      description:
        'This workspace doesn’t have Feedflow yet. Enable it under Settings → Add-ons, then try again.',
    };
  }

  if (lower.includes('not configured') || lower.includes('instagram is not')) {
    return {
      title: 'Instagram isn’t ready',
      description:
        'Instagram connect isn’t available on this environment yet. Try again later or contact support.',
    };
  }

  if (lower.includes('oauth state') || lower.includes('expired')) {
    return {
      title: 'Connection timed out',
      description: 'That sign-in link expired. Click Connect again to start over.',
    };
  }

  if (lower.includes('authorization code') || lower.includes('access_denied')) {
    return {
      title: 'Connection cancelled',
      description:
        'Instagram didn’t return a connection. Try again and approve access when prompted.',
    };
  }

  return {
    title: 'Couldn’t connect',
    description: raw,
  };
}

function friendlySuccess(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (key === 'instagram') return 'Instagram is connected.';
  if (key === 'tiktok') return 'TikTok is connected.';
  if (key === 'webflow') return 'Webflow is connected.';
  if (key === 'google') return 'Google is connected.';
  return `Connected: ${raw}`;
}

export function FeedflowOauthBanner(props: FeedflowOauthBannerProps) {
  if (props.error) {
    const { title, description } = friendlyError(props.error);

    return (
      <Alert
        variant="destructive"
        className="border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/15"
        data-test="feedflow-oauth-error"
      >
        <AlertCircle className="h-4 w-4" aria-hidden />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    );
  }

  if (props.success) {
    return (
      <Alert
        variant="success"
        className="border-emerald-600/40 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100 dark:[&>svg]:text-emerald-400"
        data-test="feedflow-oauth-success"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        <AlertTitle>Connected</AlertTitle>
        <AlertDescription>{friendlySuccess(props.success)}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
