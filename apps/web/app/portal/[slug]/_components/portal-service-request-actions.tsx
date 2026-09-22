import Link from 'next/link';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

export function PortalServiceRequestActions({
  clientSlug,
  canRequest,
  size = 'sm',
}: {
  clientSlug: string;
  canRequest: boolean;
  size?: 'sm' | 'default';
}) {
  const listHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );
  const requestHref = `${listHref}?request=${canRequest ? 'service' : 'new'}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRequest ? (
        <Button asChild size={size} data-test="portal-request-service">
          <Link href={requestHref}>Request service</Link>
        </Button>
      ) : null}
      <Button
        asChild
        size={size}
        variant="outline"
        data-test="portal-view-services"
      >
        <Link href={listHref}>View services</Link>
      </Button>
    </div>
  );
}
