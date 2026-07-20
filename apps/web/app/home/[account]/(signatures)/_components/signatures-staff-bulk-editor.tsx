'use client';

import { useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Save, Table2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { AccountBranch } from '~/lib/brand/account-branches';
import {
  isManualStaffSource,
  staffSourceLabel,
} from '~/lib/signatures/staff-source';

import type {
  SignatureStaff,
  SignatureTemplate,
} from '../_lib/server/signatures-data';
import { bulkUpdateSignatureStaff } from '../_lib/server/signatures-module-actions';

const NO_TEMPLATE = '__none__';
const NO_BRANCH = '__none__';
const MAX_PHOTO_EDGE_PX = 640;

type DraftRow = {
  staffId: string;
  source: SignatureStaff['source'];
  email: string;
  full_name: string;
  job_title: string;
  department: string;
  phone_direct: string;
  phone_mobile: string;
  signature_email: string;
  branch_id: string;
  templateId: string;
  photo_url: string | null;
  photoDataUrl: string | null;
  dirty: boolean;
};

async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a PNG, JPEG, or WebP image');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image'));
      img.src = objectUrl;
    });

    const scale = Math.min(
      1,
      MAX_PHOTO_EDGE_PX / Math.max(image.width, image.height),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image');
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function toDraft(staff: SignatureStaff): DraftRow {
  return {
    staffId: staff.id,
    source: staff.source,
    email: staff.email,
    full_name: staff.full_name ?? '',
    job_title: staff.job_title ?? '',
    department: staff.department ?? '',
    phone_direct: staff.phone_direct ?? '',
    phone_mobile: staff.phone_mobile ?? '',
    signature_email: staff.signature_email ?? '',
    branch_id: staff.branch_id ?? NO_BRANCH,
    templateId: staff.template_id ?? NO_TEMPLATE,
    photo_url: staff.photo_url,
    photoDataUrl: null,
    dirty: false,
  };
}

function CellInput({
  value,
  onChange,
  className,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Input
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-9 min-w-[8rem] border-transparent bg-transparent px-2 shadow-none focus-visible:border-[color:var(--workspace-shell-border)] focus-visible:bg-[var(--ozer-surface-canvas)]',
        className,
      )}
    />
  );
}

export function SignaturesStaffBulkEditor({
  accountId,
  staff,
  templates,
  branches,
}: {
  accountId: string;
  staff: SignatureStaff[];
  templates: SignatureTemplate[];
  branches: AccountBranch[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>(() => staff.map(toDraft));
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const dirtyCount = useMemo(
    () => rows.filter((row) => row.dirty).length,
    [rows],
  );

  const patchRow = (staffId: string, patch: Partial<DraftRow>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.staffId === staffId ? { ...row, ...patch, dirty: true } : row,
      ),
    );
  };

  const onPhoto = async (staffId: string, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      patchRow(staffId, { photoDataUrl: dataUrl });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const saveAll = async () => {
    const dirtyRows = rows.filter((row) => row.dirty);
    if (dirtyRows.length === 0) {
      toast.message('No changes to save');
      return;
    }

    setSaving(true);
    try {
      const result = await bulkUpdateSignatureStaff({
        accountId,
        rows: dirtyRows.map((row) => ({
          staffId: row.staffId,
          full_name: row.full_name,
          job_title: row.job_title,
          department: row.department,
          phone_direct: row.phone_direct,
          phone_mobile: row.phone_mobile,
          signature_email: row.signature_email,
          branch_id: row.branch_id === NO_BRANCH ? null : row.branch_id,
          templateId: row.templateId === NO_TEMPLATE ? null : row.templateId,
          photoDataUrl: row.photoDataUrl,
        })),
      });
      toast.success(
        `Saved ${result.updated} staff member${result.updated === 1 ? '' : 's'}`,
      );
      setRows((prev) =>
        prev.map((row) =>
          row.dirty
            ? {
                ...row,
                dirty: false,
                photo_url: row.photoDataUrl || row.photo_url,
                photoDataUrl: null,
              }
            : row,
        ),
      );
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!staff.length) {
    return (
      <div className="text-muted-foreground rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-8 text-sm">
        No staff yet. Sync from Microsoft 365 or Google Workspace, add people
        manually, or import a CSV.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Table2 className="h-4 w-4 text-[var(--ozer-accent)]" />
          Profile fields are read-only for synced staff. Photos, branch,
          template, and phone overrides remain editable.
        </div>
        <Button
          type="button"
          onClick={() => void saveAll()}
          disabled={saving || dirtyCount === 0}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving
            ? 'Saving…'
            : dirtyCount > 0
              ? `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`
              : 'Save all changes'}
        </Button>
      </div>

      <div className="overflow-auto rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--workspace-shell-sidebar-accent)]">
            <tr className="border-b border-[color:var(--workspace-shell-border)] text-left">
              <th className="px-3 py-3 font-medium">Photo</th>
              <th className="px-3 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Job title</th>
              <th className="px-3 py-3 font-medium">Department</th>
              <th className="px-3 py-3 font-medium">Direct phone</th>
              <th className="px-3 py-3 font-medium">Mobile</th>
              <th className="px-3 py-3 font-medium">Signature email</th>
              <th className="px-3 py-3 font-medium">Branch</th>
              <th className="px-3 py-3 font-medium">Template</th>
              <th className="px-3 py-3 font-medium">Login email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const photoSrc = row.photoDataUrl || row.photo_url;
              const editableProfile = isManualStaffSource(row.source);
              return (
                <tr
                  key={row.staffId}
                  className={cn(
                    'border-b border-[color:var(--workspace-shell-border)] align-middle',
                    row.dirty && 'bg-[var(--ozer-accent-subtle)]/20',
                  )}
                >
                  <td className="px-3 py-2">
                    <>
                      <button
                        type="button"
                        className="group relative h-12 w-12 overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10"
                        onClick={() => fileRefs.current[row.staffId]?.click()}
                        title={
                          editableProfile
                            ? 'Change photo'
                            : 'Override directory photo'
                        }
                      >
                        {photoSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoSrc}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground text-[10px]">
                            Add
                          </span>
                        )}
                        <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-[10px] text-white group-hover:flex">
                          Edit
                        </span>
                      </button>
                      <input
                        ref={(el) => {
                          fileRefs.current[row.staffId] = el;
                        }}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) => {
                          void onPhoto(
                            row.staffId,
                            event.target.files?.[0] ?? null,
                          );
                          event.target.value = '';
                        }}
                      />
                    </>
                  </td>
                  <td className="px-1 py-1">
                    <CellInput
                      value={row.full_name}
                      disabled={!editableProfile}
                      onChange={(value) =>
                        patchRow(row.staffId, { full_name: value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput
                      value={row.job_title}
                      disabled={!editableProfile}
                      onChange={(value) =>
                        patchRow(row.staffId, { job_title: value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput
                      value={row.department}
                      disabled={!editableProfile}
                      onChange={(value) =>
                        patchRow(row.staffId, { department: value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput
                      value={row.phone_direct}
                      onChange={(value) =>
                        patchRow(row.staffId, { phone_direct: value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput
                      value={row.phone_mobile}
                      onChange={(value) =>
                        patchRow(row.staffId, { phone_mobile: value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput
                      value={row.signature_email}
                      placeholder={row.email}
                      onChange={(value) =>
                        patchRow(row.staffId, { signature_email: value })
                      }
                      className="min-w-[12rem]"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Select
                      value={row.branch_id}
                      onValueChange={(value) =>
                        patchRow(row.staffId, { branch_id: value })
                      }
                    >
                      <SelectTrigger className="h-9 min-w-[9rem] border-transparent bg-transparent shadow-none">
                        <SelectValue placeholder="Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_BRANCH}>Default</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1">
                    <Select
                      value={row.templateId}
                      onValueChange={(value) =>
                        patchRow(row.staffId, { templateId: value })
                      }
                    >
                      <SelectTrigger className="h-9 min-w-[9rem] border-transparent bg-transparent shadow-none">
                        <SelectValue placeholder="Template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEMPLATE}>None</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    <div>{row.email}</div>
                    <div className="mt-0.5">{staffSourceLabel(row.source)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
