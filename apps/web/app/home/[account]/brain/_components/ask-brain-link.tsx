'use client';

import Link from 'next/link';

import { MessageSquare } from 'lucide-react';

import { Button } from '@kit/ui/button';

import {
  buildBrainChatUrl,
  type BrainChatUrlParams,
} from '~/lib/brain/build-brain-chat-url';

export function AskBrainLink({
  accountSlug,
  params,
  label = 'Ask AI',
  className,
  variant = 'outline',
  size = 'sm',
}: {
  accountSlug: string;
  params?: BrainChatUrlParams;
  label?: string;
  className?: string;
  variant?: 'outline' | 'ghost' | 'default';
  size?: 'sm' | 'default';
}) {
  return (
    <Button
      asChild
      type="button"
      variant={variant}
      size={size}
      className={className}
    >
      <Link href={buildBrainChatUrl(accountSlug, params)}>
        <MessageSquare className="mr-1.5 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
