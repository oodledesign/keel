import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

export function useUserSettings(userId: string) {
  const client = useSupabase();

  return useQuery({
    queryKey: ['user-settings', userId],
    queryFn: async () => {
      const { data, error } = await client
        .from('user_settings')
        .select('first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return {
        first_name: data?.first_name ?? null,
        last_name: data?.last_name ?? null,
      };
    },
    enabled: !!userId,
  });
}
