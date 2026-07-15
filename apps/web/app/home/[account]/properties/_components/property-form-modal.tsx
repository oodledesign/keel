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

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { Property } from '../_lib/server/properties.service';
import { createProperty, updateProperty } from '../_lib/server/server-actions';

interface PropertyFormModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  property?: Property | null;
  onSaved: () => void;
}

const emptyForm = {
  name: '',
  address: '',
  registeredOwner: '',
  propertyType: 'residential' as Property['propertyType'],
  status: 'active' as Property['status'],
  buildingType: '',
  propertyStyle: '',
  bedrooms: '',
  bathrooms: '',
  squareFootage: '',
  purchaseDate: '',
  purchasePrice: '',
  currentValue: '',
  monthlyRent: '',
  isTenanted: '',
  isHmo: '',
  isFamilyLet: '',
  isLimitedCompany: '',
  mortgageLender: '',
  mortgageReference: '',
  mortgageBalance: '',
  mortgageInterestRate: '',
  mortgageMonthlyPayment: '',
  mortgageStartDate: '',
  mortgageEndDate: '',
  remortgageDate: '',
  mortgageNotes: '',
  notes: '',
};

function poundsFromPence(value: number | null | undefined) {
  return value != null ? String(value / 100) : '';
}

/** Tri-state boolean <-> select value ('' = unknown). */
function triStateFromBool(value: boolean | null | undefined) {
  return value == null ? '' : value ? 'yes' : 'no';
}

function boolFromTriState(value: string): boolean | null {
  return value === 'yes' ? true : value === 'no' ? false : null;
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
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (property) {
      setForm({
        name: property.name,
        address: property.address ?? '',
        registeredOwner: property.registeredOwner ?? '',
        propertyType: property.propertyType,
        status: property.status,
        buildingType: property.buildingType ?? '',
        propertyStyle: property.propertyStyle ?? '',
        bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
        bathrooms: property.bathrooms != null ? String(property.bathrooms) : '',
        squareFootage:
          property.squareFootage != null ? String(property.squareFootage) : '',
        purchaseDate: property.purchaseDate ?? '',
        purchasePrice: poundsFromPence(property.purchasePrice),
        currentValue: poundsFromPence(property.currentValue),
        monthlyRent: poundsFromPence(property.monthlyRent),
        isTenanted: triStateFromBool(property.isTenanted),
        isHmo: triStateFromBool(property.isHmo),
        isFamilyLet: triStateFromBool(property.isFamilyLet),
        isLimitedCompany: triStateFromBool(property.isLimitedCompany),
        mortgageLender: property.mortgageLender ?? '',
        mortgageReference: property.mortgageReference ?? '',
        mortgageBalance: poundsFromPence(property.mortgageBalance),
        mortgageInterestRate:
          property.mortgageInterestRate != null
            ? String(property.mortgageInterestRate)
            : '',
        mortgageMonthlyPayment: poundsFromPence(
          property.mortgageMonthlyPayment,
        ),
        mortgageStartDate: property.mortgageStartDate ?? '',
        mortgageEndDate: property.mortgageEndDate ?? '',
        remortgageDate: property.remortgageDate ?? '',
        mortgageNotes: property.mortgageNotes ?? '',
        notes: property.notes ?? '',
      });
    } else {
      setForm(emptyForm);
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
          registeredOwner: form.registeredOwner.trim() || null,
          propertyType: form.propertyType,
          status: form.status,
          buildingType: form.buildingType.trim() || null,
          propertyStyle: form.propertyStyle.trim() || null,
          monthlyRent: form.monthlyRent
            ? Math.round(parseFloat(form.monthlyRent) * 100)
            : null,
          isTenanted: boolFromTriState(form.isTenanted),
          isHmo: boolFromTriState(form.isHmo),
          isFamilyLet: boolFromTriState(form.isFamilyLet),
          isLimitedCompany: boolFromTriState(form.isLimitedCompany),
          remortgageDate: form.remortgageDate || null,
          bedrooms: form.bedrooms ? parseInt(form.bedrooms, 10) : null,
          bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
          squareFootage: form.squareFootage
            ? parseInt(form.squareFootage, 10)
            : null,
          purchaseDate: form.purchaseDate || null,
          purchasePrice: form.purchasePrice
            ? Math.round(parseFloat(form.purchasePrice) * 100)
            : null,
          currentValue: form.currentValue
            ? Math.round(parseFloat(form.currentValue) * 100)
            : null,
          mortgageLender: form.mortgageLender.trim() || null,
          mortgageReference: form.mortgageReference.trim() || null,
          mortgageBalance: form.mortgageBalance
            ? Math.round(parseFloat(form.mortgageBalance) * 100)
            : null,
          mortgageInterestRate: form.mortgageInterestRate
            ? parseFloat(form.mortgageInterestRate)
            : null,
          mortgageMonthlyPayment: form.mortgageMonthlyPayment
            ? Math.round(parseFloat(form.mortgageMonthlyPayment) * 100)
            : null,
          mortgageStartDate: form.mortgageStartDate || null,
          mortgageEndDate: form.mortgageEndDate || null,
          mortgageNotes: form.mortgageNotes.trim() || null,
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

  const field = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            {isEdit ? 'Edit Property' : 'Add Property'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Property Name *
            </Label>
            <Input
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              placeholder="e.g. 12 Oak Lane"
              required
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Address
            </Label>
            <Input
              value={form.address}
              onChange={(e) => field('address', e.target.value)}
              placeholder="Full address"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Registered owner
            </Label>
            <Input
              value={form.registeredOwner}
              onChange={(e) => field('registeredOwner', e.target.value)}
              placeholder="Person or limited company name"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Type
              </Label>
              <Select
                value={form.propertyType}
                onValueChange={(v) =>
                  field('propertyType', v as Property['propertyType'])
                }
              >
                <SelectTrigger className={inputClass}>
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
              <Label className="text-[var(--workspace-shell-text)]/70">
                Status
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => field('status', v as Property['status'])}
              >
                <SelectTrigger className={inputClass}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Building type
              </Label>
              <Input
                value={form.buildingType}
                onChange={(e) => field('buildingType', e.target.value)}
                placeholder="e.g. House, Flat, Bungalow"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Property style
              </Label>
              <Input
                value={form.propertyStyle}
                onChange={(e) => field('propertyStyle', e.target.value)}
                placeholder="e.g. Terrace, Semi-detached"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Bedrooms
              </Label>
              <Input
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={(e) => field('bedrooms', e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Bathrooms
              </Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.bathrooms}
                onChange={(e) => field('bathrooms', e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Sq ft
              </Label>
              <Input
                type="number"
                min={0}
                value={form.squareFootage}
                onChange={(e) => field('squareFootage', e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Purchase Date
              </Label>
              <Input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => field('purchaseDate', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Purchase Price (£)
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.purchasePrice}
                onChange={(e) => field('purchasePrice', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Current Value (£)
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.currentValue}
                onChange={(e) => field('currentValue', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
              <p className="text-[11px] text-[var(--workspace-shell-text)]/40">
                Saves as this month&apos;s valuation on the property page.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Letting
              </p>
              <p className="text-xs text-[var(--workspace-shell-text)]/45">
                Rent and tenancy details for this property.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Monthly rent (£)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.monthlyRent}
                  onChange={(e) => field('monthlyRent', e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              {(
                [
                  ['isTenanted', 'Currently tenanted?'],
                  ['isHmo', 'HMO?'],
                  ['isFamilyLet', 'Family let?'],
                  ['isLimitedCompany', 'Limited company?'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-[var(--workspace-shell-text)]/70">
                    {label}
                  </Label>
                  <Select
                    value={form[key] || 'unknown'}
                    onValueChange={(v) => field(key, v === 'unknown' ? '' : v)}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">—</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Mortgage
              </p>
              <p className="text-xs text-[var(--workspace-shell-text)]/45">
                Optional lender and balance details for this property.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Lender
                </Label>
                <Input
                  value={form.mortgageLender}
                  onChange={(e) => field('mortgageLender', e.target.value)}
                  placeholder="e.g. Nationwide"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Reference number
                </Label>
                <Input
                  value={form.mortgageReference}
                  onChange={(e) => field('mortgageReference', e.target.value)}
                  placeholder="Account / mortgage reference"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Balance (£)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.mortgageBalance}
                  onChange={(e) => field('mortgageBalance', e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Interest rate (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.001}
                  value={form.mortgageInterestRate}
                  onChange={(e) =>
                    field('mortgageInterestRate', e.target.value)
                  }
                  placeholder="4.250"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Monthly payment (£)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.mortgageMonthlyPayment}
                  onChange={(e) =>
                    field('mortgageMonthlyPayment', e.target.value)
                  }
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Start date
                </Label>
                <Input
                  type="date"
                  value={form.mortgageStartDate}
                  onChange={(e) => field('mortgageStartDate', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  End / term date
                </Label>
                <Input
                  type="date"
                  value={form.mortgageEndDate}
                  onChange={(e) => field('mortgageEndDate', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Remortgage / further advance date
                </Label>
                <Input
                  type="date"
                  value={form.remortgageDate}
                  onChange={(e) => field('remortgageDate', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Mortgage notes
                </Label>
                <Textarea
                  value={form.mortgageNotes}
                  onChange={(e) => field('mortgageNotes', e.target.value)}
                  placeholder="Product type, fixed period, remortgage notes…"
                  rows={2}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Notes
            </Label>
            <Textarea
              value={form.notes}
              onChange={(e) => field('notes', e.target.value)}
              placeholder="Additional notes about the property…"
              rows={3}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-500/15 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">
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
              className={workspaceBtnPrimaryMd}
            >
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
