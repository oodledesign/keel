'use client';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { AddressSearchField } from '~/components/commercial/address-search-field';
import {
  COMMERCIAL_PROPERTY_TYPES,
  DISPOSAL_TYPES,
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
} from '~/lib/commercial/commercial-constants';
import {
  type InstructionPropertyDraft,
  applyAddressToDraft,
} from '~/lib/commercial/instruction-property-draft';

const UNSET = 'unset';

const controlClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]';

const labelClass = 'text-[var(--workspace-shell-text-muted)]';

function showsRent(disposalType: string) {
  return (
    !disposalType ||
    disposalType === 'to_let' ||
    disposalType === 'to_let_and_for_sale'
  );
}

function showsPrice(disposalType: string) {
  return (
    !disposalType ||
    disposalType === 'for_sale' ||
    disposalType === 'investment' ||
    disposalType === 'to_let_and_for_sale'
  );
}

/**
 * The property an instruction is about, plus the client's asking terms. What
 * is captured here is copied into the disposal when one is created, so it
 * never has to be retyped. `compact` keeps just the address and type for the
 * quick "Add instruction" dialog.
 */
export function InstructionPropertySection({
  value,
  onChange,
  compact = false,
}: {
  value: InstructionPropertyDraft;
  onChange: (next: InstructionPropertyDraft) => void;
  compact?: boolean;
}) {
  const set = <K extends keyof InstructionPropertyDraft>(
    key: K,
    next: InstructionPropertyDraft[K],
  ) => onChange({ ...value, [key]: next });

  const pinned = Boolean(value.latitude && value.longitude);

  return (
    <div className="space-y-3" data-test="instruction-property-section">
      <AddressSearchField
        onSelect={(suggestion) =>
          onChange(applyAddressToDraft(value, suggestion))
        }
        label="Find address"
        hint={
          pinned
            ? 'Map pin set. The disposal will use this address and location.'
            : 'Pick a result to fill the address and map pin. You can still edit the fields.'
        }
        inputClassName={controlClass}
      />

      <div className="space-y-2">
        <Label htmlFor="instruction-address-1" className={labelClass}>
          Address
        </Label>
        <Input
          id="instruction-address-1"
          value={value.addressLine1}
          onChange={(e) => set('addressLine1', e.target.value)}
          placeholder="Address line 1"
          className={controlClass}
        />
        <Input
          value={value.addressLine2}
          onChange={(e) => set('addressLine2', e.target.value)}
          placeholder="Address line 2"
          aria-label="Address line 2"
          className={controlClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="instruction-town" className={labelClass}>
            Town
          </Label>
          <Input
            id="instruction-town"
            value={value.town}
            onChange={(e) => set('town', e.target.value)}
            className={controlClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="instruction-postcode" className={labelClass}>
            Postcode
          </Label>
          <Input
            id="instruction-postcode"
            value={value.postcode}
            onChange={(e) => set('postcode', e.target.value)}
            className={controlClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className={labelClass}>Instruction type</Label>
          <Select
            value={value.disposalType || UNSET}
            onValueChange={(next) =>
              set('disposalType', next === UNSET ? '' : next)
            }
          >
            <SelectTrigger
              className={controlClass}
              aria-label="Instruction type"
            >
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
              <SelectItem value={UNSET}>Not set</SelectItem>
              {DISPOSAL_TYPES.map((type: DisposalType) => (
                <SelectItem key={type} value={type}>
                  {DISPOSAL_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className={labelClass}>Property type</Label>
          <Select
            value={value.propertyType || UNSET}
            onValueChange={(next) =>
              set('propertyType', next === UNSET ? '' : next)
            }
          >
            <SelectTrigger className={controlClass} aria-label="Property type">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
              <SelectItem value={UNSET}>Not set</SelectItem>
              {COMMERCIAL_PROPERTY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
              {value.propertyType &&
              !(COMMERCIAL_PROPERTY_TYPES as readonly string[]).includes(
                value.propertyType,
              ) ? (
                <SelectItem value={value.propertyType}>
                  {value.propertyType}
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      </div>

      {compact ? null : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="instruction-size" className={labelClass}>
              Size (ft²)
            </Label>
            <Input
              id="instruction-size"
              inputMode="decimal"
              value={value.sizeSqft}
              onChange={(e) => set('sizeSqft', e.target.value)}
              placeholder="e.g. 1,200"
              className={controlClass}
            />
          </div>
          {showsRent(value.disposalType) ? (
            <div className="space-y-2">
              <Label htmlFor="instruction-rent" className={labelClass}>
                Asking rent (£ pa)
              </Label>
              <Input
                id="instruction-rent"
                inputMode="decimal"
                value={value.askingRent}
                onChange={(e) => set('askingRent', e.target.value)}
                placeholder="e.g. 25,000"
                className={controlClass}
              />
            </div>
          ) : null}
          {showsPrice(value.disposalType) ? (
            <div className="space-y-2">
              <Label htmlFor="instruction-price" className={labelClass}>
                Asking price (£)
              </Label>
              <Input
                id="instruction-price"
                inputMode="decimal"
                value={value.askingPrice}
                onChange={(e) => set('askingPrice', e.target.value)}
                placeholder="e.g. 400,000"
                className={controlClass}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
