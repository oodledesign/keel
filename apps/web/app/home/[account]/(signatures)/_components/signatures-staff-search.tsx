'use client';

import { useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { Search } from 'lucide-react';

import { Input } from '@kit/ui/input';

export function SignaturesStaffSearch({
  placeholder = 'Search name, email, job title…',
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get('q') ?? '';
  const [value, setValue] = useState(queryFromUrl);

  useEffect(() => {
    setValue(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmed = value.trim();
      const current = searchParams.get('q') ?? '';
      if (trimmed === current) {
        return;
      }

      const next = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        next.set('q', trimmed);
      } else {
        next.delete('q');
      }
      next.delete('page');
      router.replace(`?${next.toString()}`, { scroll: false });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [value, router, searchParams]);

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="border-[color:var(--workspace-shell-border)] bg-transparent pl-9"
      />
    </div>
  );
}
