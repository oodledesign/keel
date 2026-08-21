export type SopRecurrence = 'monthly' | 'weekly' | 'project' | 'ad_hoc';

export type SopPlaybookRow = {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  category: string | null;
  recurrence: SopRecurrence;
  created_at: string;
  updated_at: string;
};

export type SopPlaybookStepRow = {
  id: string;
  playbook_id: string;
  position: number;
  title: string;
  body_md: string | null;
  target_selector: string | null;
  target_route: string | null;
};

export type SopRunRow = {
  id: string;
  account_id: string;
  playbook_id: string;
  title: string;
  period_label: string | null;
  notes_md: string | null;
  status: 'active' | 'completed' | 'archived';
  started_by: string | null;
  assigned_to: string | null;
  assist_mode?: boolean;
  completed_at: string | null;
  created_at: string;
};

/** Seeded commercial-property playbook title (migration). */
export const SOP_ADDING_A_DISPOSAL_TITLE = 'Adding a Disposal';

export function resolveSopTargetRoute(
  template: string | null | undefined,
  accountSlug: string,
): string | null {
  if (!template?.trim()) return null;
  return template.replaceAll('[account]', accountSlug);
}

export type SopTeamMember = {
  user_id: string;
  name: string | null;
  email: string | null;
  picture_url: string | null;
};

export type SopRunStepRow = {
  id: string;
  run_id: string;
  playbook_step_id: string | null;
  position: number;
  title: string;
  body_md: string | null;
  is_complete: boolean;
  step_notes: string | null;
  completed_at: string | null;
};

export function defaultRunTitle(
  playbookTitle: string,
  recurrence: SopRecurrence,
): string {
  const now = new Date();
  const month = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  if (recurrence === 'monthly') {
    return `${playbookTitle} — ${month}`;
  }
  if (recurrence === 'weekly') {
    const week = now.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${playbookTitle} — week of ${week}`;
  }
  return `${playbookTitle} — ${now.toLocaleDateString('en-GB')}`;
}

export function defaultPeriodLabel(recurrence: SopRecurrence): string | null {
  const now = new Date();
  if (recurrence === 'monthly') {
    return now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  }
  if (recurrence === 'weekly') {
    return `Week of ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return null;
}
