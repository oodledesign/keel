'use client';

import Link from 'next/link';

import { FormInput } from 'lucide-react';

import { Badge } from '@kit/ui/badge';

import pathsConfig from '~/config/paths.config';
import { WORKSPACE_FORM_DESTINATION_LABELS } from '~/lib/workspace-forms/form-fields';
import type { WorkspaceFormsMode } from '~/lib/workspace-forms/forms-mode';
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
  formsMode: WorkspaceFormsMode;
};

export function FormsList({
  accountId,
  accountSlug,
  forms,
  showListingDestination,
  formsMode,
}: Props) {
  const audienceOnly = formsMode === 'audience';

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className={`max-w-2xl text-sm ${workspaceTextMuted}`}>
          {audienceOnly
            ? 'Create subscribe forms for different mailing lists. Share a public link or embed a signup on your website.'
            : 'Create a form, share a public link, or embed it on your website. Submissions can create a pipeline enquiry, a listing enquiry, or a mailing-list contact.'}
        </p>
        <CreateFormDialog
          accountId={accountId}
          accountSlug={accountSlug}
          showListingDestination={showListingDestination}
          formsMode={formsMode}
        />
      </div>

      {forms.length === 0 ? (
        <div className={`${workspacePanelCard} px-6 py-12 text-center`}>
          <FormInput className={`mx-auto h-10 w-10 ${workspaceTextMuted}`} />
          <h2 className={`mt-4 text-lg font-semibold ${workspaceText}`}>
            No forms yet
          </h2>
          <p className={`mx-auto mt-2 max-w-md text-sm ${workspaceTextMuted}`}>
            {audienceOnly
              ? 'Start with a subscribe form and point it at a mailing list. You can create more than one form for different lists.'
              : 'Start with a contact or quote form. For property pages, create a listing-bound form and pass the listing id in the embed URL.'}
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
