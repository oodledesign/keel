import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { LoadingOverlay } from '@kit/ui/loading-overlay';

export function RolesDataProvider(props: {
  maxRoleHierarchy: number;
  /** Roles to hide from the selector (e.g. owner on invite). */
  excludeRoles?: string[];
  children: (roles: string[]) => React.ReactNode;
}) {
  const rolesQuery = useFetchRoles(props);

  if (rolesQuery.isLoading) {
    return <LoadingOverlay fullPage={false} />;
  }

  if (rolesQuery.isError) {
    return null;
  }

  return <>{props.children(rolesQuery.data ?? [])}</>;
}

/** Product account roles only (excludes test/seed roles like custom-role). */
const PRODUCT_ROLES = new Set([
  'owner',
  'admin',
  'staff',
  'contractor',
  'client',
]);

function useFetchRoles(props: {
  maxRoleHierarchy: number;
  excludeRoles?: string[];
}) {
  const supabase = useSupabase();
  const excludeRoles = props.excludeRoles ?? [];

  return useQuery({
    queryKey: ['roles', props.maxRoleHierarchy, excludeRoles],
    queryFn: async () => {
      const { error, data } = await supabase
        .from('roles')
        .select('name, hierarchy_level')
        .order('hierarchy_level', { ascending: true });

      if (error) {
        throw error;
      }

      const productRoles = (data ?? []).filter((item) =>
        PRODUCT_ROLES.has(item.name),
      );

      // Makerkit classic: lower hierarchy_level = more elevated (owner=1).
      // Product migration path: higher hierarchy_level = more elevated (owner=100).
      const ownerLevel =
        productRoles.find((role) => role.name === 'owner')?.hierarchy_level ??
        1;
      const lowerIsMoreElevated = ownerLevel <= 10;

      const assignable = productRoles.filter((role) => {
        if (excludeRoles.includes(role.name)) {
          return false;
        }

        if (lowerIsMoreElevated) {
          return role.hierarchy_level >= props.maxRoleHierarchy;
        }

        return role.hierarchy_level <= props.maxRoleHierarchy;
      });

      // Most privileged first in the selector.
      assignable.sort((a, b) =>
        lowerIsMoreElevated
          ? a.hierarchy_level - b.hierarchy_level
          : b.hierarchy_level - a.hierarchy_level,
      );

      return assignable.map((item) => item.name);
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
