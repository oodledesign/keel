'use client';

import { Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

export function WorkspaceSearchButton(props: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'hidden h-10 gap-2 rounded-lg border-white/12 bg-transparent px-3 text-sm font-medium text-white/90 shadow-none hover:bg-white/[0.06] hover:text-white sm:inline-flex',
        props.className,
      )}
      onClick={() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'k',
            metaKey: true,
            bubbles: true,
          }),
        );
      }}
    >
      <Search className="h-4 w-4 text-white/70" />
      <span>Search</span>
      <kbd className="pointer-events-none hidden rounded border border-white/12 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/55 lg:inline">
        ⌘K
      </kbd>
    </Button>
  );
}
