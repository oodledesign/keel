import { useMutation } from '@tanstack/react-query';

interface RequestPasswordResetMutationParams {
  email: string;
  redirectTo: string;
  captchaToken?: string;
}

/**
 * @name useRequestResetPassword
 * @description Requests a password reset for a user. This function will
 * trigger a password reset email to be sent to the user's email address.
 * After the user clicks the link in the email, they will be redirected to
 * /password-reset where their password can be updated.
 */
export function useRequestResetPassword() {
  const mutationKey = ['auth', 'reset-password'];

  const mutationFn = async (params: RequestPasswordResetMutationParams) => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      ok?: boolean;
    } | null;

    if (!response.ok || !payload?.ok) {
      throw payload?.error ?? 'reset_password_failed';
    }

    return payload;
  };

  return useMutation({
    mutationFn,
    mutationKey,
  });
}
