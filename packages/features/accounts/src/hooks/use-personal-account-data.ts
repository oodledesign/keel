import { useCallback } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Json } from '@kit/supabase/database';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import { toSupabasePublicStorageUrl } from '../lib/public-storage-url';

export function usePersonalAccountData(
  userId: string,
  partialAccount?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
    public_data?: Json;
  },
) {
  const client = useSupabase();
  const queryKey = ['account:data', userId];

  const queryFn = async () => {
    if (!userId) {
      return null;
    }

    const response = await client
      .from('accounts')
      .select(
        `
        id,
        name,
        picture_url,
        public_data
    `,
      )
      .eq('primary_owner_user_id', userId)
      .eq('is_personal_account', true)
      .maybeSingle();

    if (response.error) {
      throw response.error;
    }

    if (!response.data) {
      return null;
    }

    return {
      ...response.data,
      picture_url: toSupabasePublicStorageUrl(response.data.picture_url),
    };
  };

  return useQuery({
    queryKey,
    queryFn,
    enabled: !!userId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    initialData: partialAccount?.id
      ? {
          id: partialAccount.id,
          name: partialAccount.name,
          picture_url: toSupabasePublicStorageUrl(partialAccount.picture_url),
          public_data: partialAccount.public_data,
        }
      : undefined,
  });
}

export function useRevalidatePersonalAccountDataQuery() {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string) =>
      queryClient.invalidateQueries({
        queryKey: ['account:data', userId],
      }),
    [queryClient],
  );
}
