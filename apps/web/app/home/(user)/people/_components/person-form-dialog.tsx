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

import {
  CATCHUP_CADENCE_OPTIONS,
  DEFAULT_PERSON_CIRCLE_TIER,
  RELATIONSHIP_PRESETS,
  type PersonRow,
} from '../_lib/schema/people.schema';
import { CIRCLE_TIER_OPTIONS } from '../_lib/circle-tiers';
import {
  createPersonAction,
  updatePersonAction,
} from '../_lib/actions/people-actions';
import { PersonImageUploader } from './person-image-uploader';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: PersonRow | null;
  onSaved?: (id: string) => void;
  onPhotoUpdated?: () => void;
};

export function PersonFormDialog({
  open,
  onOpenChange,
  person,
  onSaved,
  onPhotoUpdated,
}: Props) {
  const isEdit = Boolean(person);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [relationship, setRelationship] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [cadence, setCadence] = useState<string>('off');
  const [circleTier, setCircleTier] = useState(DEFAULT_PERSON_CIRCLE_TIER);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setFullName(person?.full_name ?? '');
    setNickname(person?.nickname ?? '');
    setRelationship(person?.relationship_label ?? '');
    setEmail(person?.email ?? '');
    setPhone(person?.phone ?? '');
    setGeneralNotes(person?.general_notes ?? '');
    setCadence(
      person?.catchup_cadence_days
        ? String(person.catchup_cadence_days)
        : 'off',
    );
    setCircleTier(person?.circle_tier ?? DEFAULT_PERSON_CIRCLE_TIER);
    setError(null);
  }, [open, person]);

  const cadenceDays =
    cadence === 'off' ? null : Number.parseInt(cadence, 10) || null;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const payload = {
        fullName,
        nickname: nickname || null,
        relationshipLabel: relationship || null,
        email: email || null,
        phone: phone || null,
        generalNotes: generalNotes || null,
        catchupCadenceDays: cadenceDays,
        circleTier,
      };

      const result = isEdit && person
        ? await updatePersonAction({ ...payload, id: person.id })
        : await createPersonAction(payload);

      if (!result.success) {
        setError(result.error ?? 'Could not save');
        return;
      }

      onOpenChange(false);
      if (!isEdit && 'id' in result && result.id) {
        onSaved?.(result.id);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit person' : 'Add person'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {isEdit && person ? (
            <div className="flex items-center gap-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
              <PersonImageUploader
                personId={person.id}
                personName={person.nickname?.trim() || person.full_name}
                avatarUrl={person.avatar_url}
                size="md"
                onUpdated={() => onPhotoUpdated?.()}
              />
              <p className="text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
                Click to add or change their photo. Shown in list and orbit
                views.
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="fullName">Name</Label>
            <Input
              id="fullName"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Relationship</Label>
              <Select value={relationship || 'none'} onValueChange={(v) => setRelationship(v === 'none' ? '' : v)}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
                  <SelectItem value="none">—</SelectItem>
                  {RELATIONSHIP_PRESETS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Circle of trust</Label>
            <Select
              value={circleTier}
              onValueChange={(value) =>
                setCircleTier(value as typeof circleTier)
              }
            >
              <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
                {CIRCLE_TIER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {CIRCLE_TIER_OPTIONS.find((option) => option.value === circleTier)
                ?.description}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Catch-up reminder</Label>
            <Select value={cadence} onValueChange={setCadence}>
              <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
                {CATCHUP_CADENCE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.label}
                    value={opt.value === null ? 'off' : String(opt.value)}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              className="min-h-[80px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Anything worth remembering…"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            disabled={pending || !fullName.trim()}
            onClick={handleSubmit}
          >
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add person'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
