import Link from 'next/link';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

export function PortalMessageActions({
  clientSlug,
  size = 'sm',
}: {
  clientSlug: string;
  size?: 'sm' | 'default';
}) {
  const listHref = pathsConfig.app.clientPortalMessages.replace(
    '[clientSlug]',
    clientSlug,
  );
  const composeHref = `${listHref}?compose=1`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size={size} data-test="portal-send-new-message">
        <Link href={composeHref}>Send new message</Link>
      </Button>
      <Button
        asChild
        size={size}
        variant="outline"
        data-test="portal-view-messages"
      >
        <Link href={listHref}>View messages</Link>
      </Button>
    </div>
  );
}
