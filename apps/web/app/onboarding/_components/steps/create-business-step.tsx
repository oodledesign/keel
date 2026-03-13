'use client';

import { useState } from 'react';

import { createTeamAndContinueOnboarding } from '../../_lib/server/onboarding.actions';
import { PrimaryButton } from '../primary-button';

export function CreateBusinessStep() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await createTeamAndContinueOnboarding(
        name.trim(),
        slug.trim() || null,
      );
      if (result.error) {
        if (result.error === 'already_has_business' && result.accountId) {
          // One business only: redirect to continue existing onboarding
          window.location.href = `/onboarding?account_id=${result.accountId}&step=2`;
          return;
        }
        setError(
          result.error === 'duplicate_slug'
            ? 'This URL is already taken. Choose another.'
            : result.error,
        );
        return;
      }
      if (result.accountId) {
        // Full navigation so the server sees the new account and "rendering" state clears
        window.location.href = `/onboarding?account_id=${result.accountId}&step=2`;
        return;
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch (_e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Create your business
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Set up your team account to get started.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="business-name"
          className="text-sm font-medium text-zinc-300"
        >
          Business name
        </label>
        <input
          id="business-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          placeholder="Acme Ltd"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="business-slug"
          className="text-sm font-medium text-zinc-300"
        >
          URL slug (optional)
        </label>
        <input
          id="business-slug"
          type="text"
          value={slug}
          onChange={(e) =>
            setSlug(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-'),
            )
          }
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          placeholder="acme"
        />
        <p className="text-xs text-zinc-500">
          Your workspace URL: /home/{slug || 'your-slug'}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <PrimaryButton type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Continue'}
      </PrimaryButton>
    </form>
  );
}
