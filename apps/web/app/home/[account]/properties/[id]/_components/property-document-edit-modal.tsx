'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import {
  DOCUMENT_TYPE_LABELS,
  PROPERTY_DOCUMENT_TYPES,
  generateFinancialYearOptions,
} from '../../_lib/document-types';
import type { PropertyDocument } from '../../_lib/server/properties.service';
import { updateDocument } from '../../_lib/server/server-actions';

interface PropertyDocumentEditModalProps {
  open: boolean;
  onClose: () => void;
  doc: PropertyDocument | null;
  onSaved: (updated: PropertyDocument) => void;
}

const NO_FINANCIAL_YEAR = '__none__';

export function PropertyDocumentEditModal({
  open,
  onClose,
  doc,
  onSaved,
}: PropertyDocumentEditModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<string>('other');
  const [financialYear, setFinancialYear] = useState<string>(NO_FINANCIAL_YEAR);

  useEffect(() => {
    if (doc) {
      setName(doc.name);
      setDocumentType(doc.documentType);
      setFinancialYear(doc.financialYear ?? NO_FINANCIAL_YEAR);
    }
    setError(null);
  }, [doc, open]);

  const financialYearOptions = useMemo(() => {
    const options = generateFinancialYearOptions();
    // Preserve a legacy/custom value that doesn't match the generated set,
    // so editing other fields never silently drops it.
    if (doc?.financialYear && !options.includes(doc.financialYear)) {
      return [doc.financialYear, ...options];
    }
    return options;
  }, [doc]);

  if (!doc) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    startTransition(async () => {
      try {
        const updated = await updateDocument({
          documentId: doc.id,
          name: trimmedName,
          documentType: documentType as (typeof PROPERTY_DOCUMENT_TYPES)[number],
          financialYear:
            financialYear === NO_FINANCIAL_YEAR ? null : financialYear,
        });

        if (updated) {
          onSaved(updated);
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save changes');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] border border-[color:var(--workspace-shell-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            Edit document
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Document name"
              required
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Category</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_DOCUMENT_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {DOCUMENT_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Financial year</Label>
              <Select value={financialYear} onValueChange={setFinancialYear}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FINANCIAL_YEAR}>None</SelectItem>
                  {financialYearOptions.map((fy) => (
                    <SelectItem key={fy} value={fy}>
                      {fy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-rose-500/15 px-4 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-[var(--workspace-shell-text)]/60 hover:text-[var(--workspace-shell-text)]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="bg-violet-600 hover:bg-violet-700 text-[var(--workspace-shell-text)]"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
