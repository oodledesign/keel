'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { AccountBranch } from '~/lib/brand/account-branches';

import { saveAccountBranchesAction } from '../_lib/server/account-branch-actions';

type BranchDraft = {
  id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  is_default: boolean;
};

function toDraft(branch: AccountBranch): BranchDraft {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address ?? '',
    phone: branch.phone ?? '',
    email: branch.email ?? '',
    is_default: branch.isDefault,
  };
}

function emptyDraft(isDefault: boolean): BranchDraft {
  return {
    name: '',
    address: '',
    phone: '',
    email: '',
    is_default: isDefault,
  };
}

export function BrandBranchesSection({
  accountId,
  initialBranches,
  canEdit,
}: {
  accountId: string;
  initialBranches: AccountBranch[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [branches, setBranches] = useState<BranchDraft[]>(
    initialBranches.length > 0
      ? initialBranches.map(toDraft)
      : [emptyDraft(true)],
  );
  const [saving, setSaving] = useState(false);

  const setDefault = (index: number) => {
    setBranches((rows) =>
      rows.map((row, i) => ({ ...row, is_default: i === index })),
    );
  };

  const updateRow = (index: number, patch: Partial<BranchDraft>) => {
    setBranches((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const addBranch = () => {
    setBranches((rows) => [...rows, emptyDraft(rows.length === 0)]);
  };

  const removeBranch = (index: number) => {
    setBranches((rows) => {
      const next = rows.filter((_, i) => i !== index);
      if (next.length === 0) return [emptyDraft(true)];
      if (!next.some((row) => row.is_default)) {
        next[0] = { ...next[0]!, is_default: true };
      }
      return next;
    });
  };

  const save = async () => {
    const valid = branches.filter((b) => b.name.trim());
    if (valid.length === 0) {
      toast.error('Add at least one branch with a name');
      return;
    }

    setSaving(true);
    try {
      await saveAccountBranchesAction({
        accountId,
        branches: valid.map((b) => ({
          id: b.id ?? null,
          name: b.name.trim(),
          address: b.address.trim() || null,
          phone: b.phone.trim() || null,
          email: b.email.trim() || null,
          is_default: b.is_default,
        })),
      });
      toast.success('Branches saved');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
      <div>
        <h2 className="text-lg font-semibold">Branches</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Office locations used in email signatures. Staff pick a branch;
          address, phone, and email fall back to branch details when not
          overridden on their profile.
        </p>
      </div>

      <div className="space-y-4">
        {branches.map((branch, index) => (
          <div
            key={branch.id ?? `new-${index}`}
            className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Branch {index + 1}</p>
              {canEdit && branches.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-400"
                  onClick={() => removeBranch(index)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Location name</Label>
                <Input
                  value={branch.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                  placeholder="Main office"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={branch.address}
                  onChange={(e) =>
                    updateRow(index, { address: e.target.value })
                  }
                  placeholder="123 High Street, London, SW1A 1AA"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={branch.phone}
                  onChange={(e) => updateRow(index, { phone: e.target.value })}
                  placeholder="020 7946 0958"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={branch.email}
                  onChange={(e) => updateRow(index, { email: e.target.value })}
                  placeholder="office@example.com"
                  disabled={!canEdit}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={branch.is_default}
                onCheckedChange={() => setDefault(index)}
                disabled={!canEdit}
              />
              Default branch (used when staff have no branch selected)
            </label>
          </div>
        ))}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addBranch}>
            <Plus className="mr-2 h-4 w-4" />
            Add branch
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving branches...
              </>
            ) : (
              'Save branches'
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
