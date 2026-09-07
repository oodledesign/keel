import { ExternalLink } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { collectRightmoveUrls } from '~/lib/commercial/rightmove-publish-status';

import type { CommercialPortalPublication } from '../_lib/server/listings.service';

export function getRightmovePublication(
  publications: CommercialPortalPublication[],
) {
  return publications.find((publication) => publication.portal === 'rightmove');
}

export function getRightmoveListingUrls(
  publication:
    | Pick<CommercialPortalPublication, 'externalUrl' | 'metadata'>
    | null
    | undefined,
) {
  return collectRightmoveUrls({
    externalUrl: publication?.externalUrl ?? null,
    metadata: publication?.metadata ?? null,
  });
}

export function RightmoveListingLinks({
  publications,
  size = 'sm',
}: {
  publications: CommercialPortalPublication[];
  size?: 'sm' | 'default';
}) {
  const publication = getRightmovePublication(publications);
  const urls = getRightmoveListingUrls(publication);

  if (urls.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url, index) => (
        <Button
          key={url}
          asChild
          variant="outline"
          size={size}
          className="gap-1.5"
        >
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            {urls.length === 1 ? 'Open on Rightmove' : `Rightmove ${index + 1}`}
          </a>
        </Button>
      ))}
    </div>
  );
}
