'use client';

import Link from 'next/link';

import { FormInput } from 'lucide-react';

import { Badge } from '@kit/ui/badge';

import pathsConfig from '~/config/paths.config';
import { WORKSPACE_FORM_DESTINATION_LABELS } from '~/lib/workspace-forms/form-fields';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { WorkspaceFormRecord } from '../_lib/server/workspace-forms.service';
import { CreateFormDialog } from './create-form-dialog';

type Props = {
  accountId: string;
  accountSlug: string;
  forms: WorkspaceFormRecord[];
  showListingDestination: boolean;
};

export function FormsList({
  accountId,
  accountSlug,
  forms,
  showListingDestination,
}: Props) {
  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className={`max-w-2xl text-sm ${workspaceTextMuted}`}>
          Create a form, share a public link, or embed it on your website.
          Submissions create a pipeline enquiry or a listing enquiry in this
          workspace.
        </p>
        <CreateFormDialog
          accountId={accountId}
          accountSlug={accountSlug}
          showListingDestination={showListingDestination}
        />
      </div>

      {forms.length === 0 ? (
        <div className={`${workspacePanelCard} px-6 py-12 text-center`}>
          <FormInput className={`mx-auto h-10 w-10 ${workspaceTextMuted}`} />
          <h2 className={`mt-4 text-lg font-semibold ${workspaceText}`}>
            No forms yet
          </h2>
          <p className={`mx-auto mt-2 max-w-md text-sm ${workspaceTextMuted}`}>
            Start with a contact or quote form. For property pages, create a
            listing-bound form and pass the listing id in the embed URL.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {forms.map((form) => {
            const href = pathsConfig.app.accountFormDetail
              .replace('[account]', accountSlug)
              .replace('[formId]', form.id);

            return (
              <Link
                key={form.id}
                href={href}
                className={`${workspacePanelCard} block p-5 transition-colors hover:border-[var(--ozer-accent)]/30`}
                data-test={`form-card-${form.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className={`text-base font-semibold ${workspaceText}`}>
                      {form.name}
                    </h2>
                    <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                      {WORKSPACE_FORM_DESTINATION_LABELS[form.destination]}
                    </p>
                  </div>
                  <Badge variant={form.enabled ? 'default' : 'secondary'}>
                    {form.enabled ? 'Live' : 'Draft'}
                  </Badge>
                </div>
                <p className={`mt-4 text-sm ${workspaceTextMuted}`}>
                  {form.submissionCount} submission
                  {form.submissionCount === 1 ? '' : 's'}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
