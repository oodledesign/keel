import type { SignInWithPasswordCredentials } from '@supabase/supabase-js';

import { useMutation } from '@tanstack/react-query';

export function useSignInWithEmailPassword() {
  const mutationKey = ['auth', 'sign-in-with-email-password'];

  const mutationFn = async (credentials: SignInWithPasswordCredentials) => {
    if (!('email' in credentials) || typeof credentials.email !== 'string') {
      throw new Error('invalid_credentials');
    }

    const response = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        captchaToken: credentials.options?.captchaToken,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      user?: {
        id?: string;
        identities?: Array<{ id: string }>;
      } | null;
      session?: unknown;
    } | null;

    if (!response.ok || !payload) {
      throw payload?.error ?? 'invalid_credentials';
    }

    const user = payload.user;
    const identities = user?.identities ?? [];

    if (identities.length === 0) {
      throw new Error('User already registered');
    }

    return {
      user: payload.user,
      session: payload.session,
    };
  };

  return useMutation({ mutationKey, mutationFn });
}
