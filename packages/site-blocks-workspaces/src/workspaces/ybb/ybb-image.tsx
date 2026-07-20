'use client';

import type { ComponentProps } from 'react';

import { SiteMediaImg } from '@kit/site-blocks-core';

import { resolveYbbMediaUrl } from './ybb-assets';

type YbbImageProps = Omit<ComponentProps<typeof SiteMediaImg>, 'src'> & {
  src?: string | null;
};

/** Site media + YBB CDN URLs with Supabase public-path normalization. */
export function YbbImage({ src, alt = '', ...rest }: YbbImageProps) {
  return <SiteMediaImg src={resolveYbbMediaUrl(src)} alt={alt} {...rest} />;
}
