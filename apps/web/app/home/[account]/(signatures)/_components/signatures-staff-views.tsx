'use client';

import { useState } from 'react';

import { LayoutGrid, Table2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type { AccountBranch } from '~/lib/brand/account-branches';

import type {
  SignatureStaff,
  SignatureTemplate,
} from '../_lib/server/signatures-data';
import { SignaturesStaffBulkEditor } from './signatures-staff-bulk-editor';
import { SignaturesStaffTable } from './signatures-staff-table';

export function SignaturesStaffViews({
  accountId,
  accountSlug,
  staff,
  bulkStaff,
  templates,
  branches,
  openRequestCounts = {},
  page,
  pageSize,
  totalCount,
}: {
  accountId: string;
  accountSlug: string;
  staff: SignatureStaff[];
  bulkStaff: SignatureStaff[];
  templates: SignatureTemplate[];
  branches: AccountBranch[];
  openRequestCounts?: Record<string, number>;
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const [mode, setMode] = useState<'list' | 'bulk'>('bulk');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {mode === 'bulk'
            ? 'Spreadsheet edit — change many people, then save once.'
            : 'List view — open a person for full detail and push.'}
        </p>
        <div className="inline-flex rounded-lg border border-[color:var(--workspace-shell-border)] p-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              mode === 'bulk' && 'bg-[var(--workspace-shell-sidebar-accent)]',
            )}
            onClick={() => setMode('bulk')}
          >
            <Table2 className="mr-2 h-4 w-4" />
            Bulk edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              mode === 'list' && 'bg-[var(--workspace-shell-sidebar-accent)]',
            )}
            onClick={() => setMode('list')}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      {mode === 'bulk' ? (
        <SignaturesStaffBulkEditor
          key={bulkStaff.map((row) => row.id).join(',')}
          accountId={accountId}
          staff={bulkStaff}
          templates={templates}
          branches={branches}
        />
      ) : (
        <SignaturesStaffTable
          accountId={accountId}
          accountSlug={accountSlug}
          staff={staff}
          openRequestCounts={openRequestCounts}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          emptyMessage={
            totalCount === 0
              ? 'No staff match your search or filters.'
              : 'No staff on this page.'
          }
        />
      )}
    </div>
  );
}
