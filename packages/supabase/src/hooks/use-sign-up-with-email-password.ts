import { useMutation } from '@tanstack/react-query';

interface Credentials {
  email: string;
  password: string;
  emailRedirectTo: string;
  captchaToken?: string;
}

const _WeakPasswordReasons = ['length', 'characters', 'pwned'] as const;

export type WeakPasswordReason = (typeof _WeakPasswordReasons)[number];

export class WeakPasswordError extends Error {
  readonly code = 'weak_password';
  readonly reasons: WeakPasswordReason[];

  constructor(reasons: WeakPasswordReason[]) {
    super('weak_password');
    this.name = 'WeakPasswordError';
    this.reasons = reasons;
  }
}

export function useSignUpWithEmailAndPassword() {
  const mutationKey = ['auth', 'sign-up-with-email-password'];

  const mutationFn = async (params: Credentials) => {
    const { emailRedirectTo, captchaToken, ...credentials } = params;

    const response = await fetch('/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...credentials,
        emailRedirectTo,
        captchaToken,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      reasons?: WeakPasswordReason[];
      user?: {
        identities?: Array<{ id: string }>;
      } | null;
      session?: unknown;
    } | null;

    if (!response.ok || !payload) {
      if (payload?.error === 'weak_password') {
        throw new WeakPasswordError(payload.reasons ?? []);
      }

      throw payload?.error ?? 'sign_up_failed';
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

  return useMutation({
    mutationKey,
    mutationFn,
  });
}
