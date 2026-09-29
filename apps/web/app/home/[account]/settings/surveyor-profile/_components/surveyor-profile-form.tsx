'use client';

import { useState, useTransition } from 'react';

import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import type {
  SurveyorProfile,
  SurveyorQualification,
} from '~/lib/building-surveyor/survey-report-details';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { saveSurveyorProfileAction } from '../../../surveys/_lib/server/survey-report-details-actions';

type TextField = Exclude<keyof SurveyorProfile, 'qualifications'>;

const FIELDS: Array<{
  key: TextField;
  label: string;
  placeholder: string;
  type?: string;
}> = [
  { key: 'displayName', label: 'Name on reports', placeholder: 'Jane Smith' },
  {
    key: 'ricsNumber',
    label: 'RICS number',
    placeholder: '1234567',
  },
  { key: 'phone', label: 'Phone', placeholder: '01892 000000', type: 'tel' },
  {
    key: 'email',
    label: 'Email',
    placeholder: 'jane@example.co.uk',
    type: 'email',
  },
  {
    key: 'website',
    label: 'Website',
    placeholder: 'www.example.co.uk',
  },
];

const EMPTY_QUALIFICATION: SurveyorQualification = {
  year: '',
  establishment: '',
  qualification: '',
};

export function SurveyorProfileForm({
  accountId,
  accountSlug,
  initialProfile,
}: {
  accountId: string;
  accountSlug: string;
  initialProfile: SurveyorProfile;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [pending, startTransition] = useTransition();

  const setField = (key: TextField, value: string) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  const setQualification = (
    index: number,
    patch: Partial<SurveyorQualification>,
  ) =>
    setProfile((prev) => ({
      ...prev,
      qualifications: prev.qualifications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));

  const handleSave = () => {
    startTransition(async () => {
      try {
        const saved = await saveSurveyorProfileAction({
          accountId,
          accountSlug,
          ...profile,
        });
        setProfile(saved);
        toast.success('Surveyor profile saved');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div className="space-y-5" data-test="surveyor-profile-form">
      <section className={`${workspacePanelCard} p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Surveyor profile
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Your details appear on the report cover, in section A and in the
          surveyor&apos;s declaration. Each surveyor in the workspace keeps
          their own profile.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`surveyor-${field.key}`}>{field.label}</Label>
              <Input
                id={`surveyor-${field.key}`}
                type={field.type ?? 'text'}
                value={profile[field.key] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => setField(field.key, event.target.value)}
              />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="surveyor-address">Address</Label>
            <Textarea
              id="surveyor-address"
              value={profile.address ?? ''}
              placeholder="Office address"
              className="min-h-20"
              onChange={(event) => setField('address', event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className={`${workspacePanelCard} p-4 sm:p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Qualifications
            </h2>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Listed in the declaration table in section K.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={profile.qualifications.length >= 12}
            onClick={() =>
              setProfile((prev) => ({
                ...prev,
                qualifications: [
                  ...prev.qualifications,
                  { ...EMPTY_QUALIFICATION },
                ],
              }))
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {profile.qualifications.length === 0 ? (
          <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
            No qualifications added yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {profile.qualifications.map((item, index) => (
              <li
                key={index}
                className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <Input
                  aria-label="Year"
                  value={item.year}
                  placeholder="Year"
                  onChange={(event) =>
                    setQualification(index, { year: event.target.value })
                  }
                />
                <Input
                  aria-label="Establishment"
                  value={item.establishment}
                  placeholder="Establishment"
                  onChange={(event) =>
                    setQualification(index, {
                      establishment: event.target.value,
                    })
                  }
                />
                <Input
                  aria-label="Qualification"
                  value={item.qualification}
                  placeholder="Qualification"
                  onChange={(event) =>
                    setQualification(index, {
                      qualification: event.target.value,
                    })
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove qualification"
                  onClick={() =>
                    setProfile((prev) => ({
                      ...prev,
                      qualifications: prev.qualifications.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button
        type="button"
        className={workspaceBtnPrimaryMd}
        disabled={pending}
        onClick={handleSave}
        data-test="surveyor-profile-save"
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save profile
      </Button>
    </div>
  );
}
