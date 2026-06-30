'use client';

import { useEffect, useState, useTransition } from 'react';

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
import { Textarea } from '@kit/ui/textarea';

import type { Property } from '../_lib/server/properties.service';
import { createProperty, updateProperty } from '../_lib/server/server-actions';

interface PropertyFormModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  property?: Property | null;
  onSaved: () => void;
}

export function PropertyFormModal({
  open,
  onClose,
  accountId,
  property,
  onSaved,
}: PropertyFormModalProps) {
  const isEdit = Boolean(property);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    address: '',
    propertyType: 'residential' as const,
    status: 'active' as const,
    bedrooms: '',
    bathrooms: '',
    squareFootage: '',
    purchaseDate: '',
    purchasePrice: '',
    currentValue: '',
    notes: '',
  });

  useEffect(() => {
    if (property) {
      setForm({
        name: property.name,
        address: property.address ?? '',
        propertyType: property.propertyType,
        status: property.status,
        bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
        bathrooms: property.bathrooms != null ? String(property.bathrooms) : '',
        squareFootage: property.squareFootage != null ? String(property.squareFootage) : '',
        purchaseDate: property.purchaseDate ?? '',
        purchasePrice: property.purchasePrice != null ? String(property.purchasePrice / 100) : '',
        currentValue: property.currentValue != null ? String(property.currentValue / 100) : '',
        notes: property.notes ?? '',
      });
    } else {
      setForm({
        name: '',
        address: '',
        propertyType: 'residential',
        status: 'active',
        bedrooms: '',
        bathrooms: '',
        squareFootage: '',
        purchaseDate: '',
        purchasePrice: '',
        currentValue: '',
        notes: '',
      });
    }
    setError(null);
  }, [property, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const shared = {
          name: form.name.trim(),
          address: form.address.trim() || null,
          propertyType: form.propertyType,
          status: form.status,
          bedrooms: form.bedrooms ? parseInt(form.bedrooms, 10) : null,
          bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
          squareFootage: form.squareFootage ? parseInt(form.squareFootage, 10) : null,
          purchaseDate: form.purchaseDate || null,
          purchasePrice: form.purchasePrice
            ? Math.round(parseFloat(form.purchasePrice) * 100)
            : null,
          currentValue: form.currentValue
            ? Math.round(parseFloat(form.currentValue) * 100)
            : null,
          notes: form.notes.trim() || null,
        };

        if (isEdit && property) {
          await updateProperty({ propertyId: property.id, ...shared });
        } else {
          await createProperty({ accountId, ...shared });
        }

        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  };

  const field = (
    key: keyof typeof form,
    value: string,
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] border border-[color:var(--workspace-shell-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            {isEdit ? 'Edit Property' : 'Add Property'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">Property Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              placeholder="e.g. 12 Oak Lane"
              required
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
            />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">Address</Label>
            <Input
              value={form.address}
              onChange={(e) => field('address', e.target.value)}
              placeholder="Full address"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
            />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Type</Label>
              <Select
                value={form.propertyType}
                onValueChange={(v) => field('propertyType', v)}
              >
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="land">Land</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => field('status', v)}
              >
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bedrooms, Bathrooms, SqFt */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Bedrooms</Label>
              <Input
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={(e) => field('bedrooms', e.target.value)}
                placeholder="0"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Bathrooms</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.bathrooms}
                onChange={(e) => field('bathrooms', e.target.value)}
                placeholder="0"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Sq ft</Label>
              <Input
                type="number"
                min={0}
                value={form.squareFootage}
                onChange={(e) => field('squareFootage', e.target.value)}
                placeholder="0"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
              />
            </div>
          </div>

          {/* Purchase date + prices */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Purchase Date</Label>
              <Input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => field('purchaseDate', e.target.value)}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Purchase Price (£)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.purchasePrice}
                onChange={(e) => field('purchasePrice', e.target.value)}
                placeholder="0.00"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">Current Value (£)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.currentValue}
                onChange={(e) => field('currentValue', e.target.value)}
                placeholder="0.00"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => field('notes', e.target.value)}
              placeholder="Additional notes about the property…"
              rows={3}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
            />
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
              disabled={isPending || !form.name.trim()}
              className="bg-violet-600 hover:bg-violet-700 text-[var(--workspace-shell-text)]"
            >
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
