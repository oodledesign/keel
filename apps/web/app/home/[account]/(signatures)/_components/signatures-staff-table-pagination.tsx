'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { SIGNATURES_STAFF_PAGE_SIZES } from '../_lib/signatures-staff-pagination';

export function SignaturesStaffTablePagination({
  page,
  pageSize,
  totalCount,
  pageSizes = SIGNATURES_STAFF_PAGE_SIZES,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  pageSizes?: readonly number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const searchActive = Boolean(searchParams.get('q')?.trim());

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--workspace-shell-border)] px-4 py-3">
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        {searchActive
          ? `Showing ${rangeStart}–${rangeEnd} of ${totalCount} matching`
          : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {pageSizes.length > 1 ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              updateParams({ pageSize: value, page: '1' })
            }
          >
            <SelectTrigger className="h-8 w-[110px] border-[color:var(--workspace-shell-border)] bg-transparent text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[color:var(--workspace-shell-border)]"
          disabled={page <= 1}
          onClick={() => updateParams({ page: String(page - 1) })}
        >
          Previous
        </Button>
        <span className="text-xs text-[var(--workspace-shell-text-muted)] tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[color:var(--workspace-shell-border)]"
          disabled={page >= totalPages}
          onClick={() => updateParams({ page: String(page + 1) })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
