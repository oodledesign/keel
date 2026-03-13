'use client';

import { useRevalidatePersonalAccountDataQuery } from '../../hooks/use-personal-account-data';
import { useUserSettings } from '../../hooks/use-user-settings';
import { UpdateAccountDetailsForm } from './update-account-details-form';

export function UpdateAccountDetailsFormContainer({
  user,
}: {
  user: {
    name: string | null;
    id: string;
  };
}) {
  const revalidateUserDataQuery = useRevalidatePersonalAccountDataQuery();
  const { data: settings } = useUserSettings(user.id);

  const firstName =
    settings?.first_name ??
    (user.name ? user.name.split(/\s+/)[0] ?? '' : '') ??
    '';
  const lastName =
    settings?.last_name ??
    (user.name ? user.name.split(/\s+/).slice(1).join(' ') : '') ??
    '';

  return (
    <UpdateAccountDetailsForm
      firstName={firstName}
      lastName={lastName}
      userId={user.id}
      onUpdate={() => revalidateUserDataQuery(user.id)}
    />
  );
}
