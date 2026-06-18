'use client';

import { useEffect } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

export function PersonalIntegrationsToasts() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const calendarConnected = searchParams.get('calendar_connected');
    const calendarError = searchParams.get('calendar_error');
    const emailConnected = searchParams.get('email_connected');
    const emailError = searchParams.get('email_error');

    if (
      calendarConnected !== '1' &&
      !calendarError &&
      emailConnected !== '1' &&
      !emailError
    ) {
      return;
    }

    if (calendarConnected === '1') {
      toast.success('Google Calendar connected');
    } else if (calendarError) {
      toast.error(decodeURIComponent(calendarError));
    }

    if (emailConnected === '1') {
      toast.success('Gmail connected');
    } else if (emailError) {
      toast.error(decodeURIComponent(emailError));
    }

    router.replace(pathsConfig.app.personalAccountSettings);
  }, [router, searchParams]);

  return null;
}
