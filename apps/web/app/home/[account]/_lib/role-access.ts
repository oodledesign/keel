import pathsConfig from '~/config/paths.config';

type TeamAccountAccessInput = {
  permissions?: string[] | null;
  role?: string | null;
  company_role?: string | null;
  companyRole?: string | null;
};

export type TeamAccountAccess = ReturnType<typeof getTeamAccountAccess>;

export function getTeamAccountAccess(input?: TeamAccountAccessInput) {
  const permissions = new Set(input?.permissions ?? []);
  const role = normalizeRole(input?.role ?? null, input?.companyRole ?? input?.company_role ?? null);
  const companyRole = input?.companyRole ?? input?.company_role ?? null;

  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';
  const isContractor = role === 'contractor' || companyRole === 'contractor';
  const isClient = role === 'client' || companyRole === 'client';

  const canManageRoles = permissions.has('roles.manage') || isOwner;
  const canManageBilling =
    permissions.has('billing.manage') || isOwner || isAdmin;
  const canManageSettings =
    permissions.has('settings.manage') ||
    isOwner ||
    isAdmin ||
    isStaff ||
    isClient;
  const canManageMembers =
    permissions.has('members.manage') || isOwner || isAdmin;
  const canManageInvites =
    permissions.has('invites.manage') || isOwner || isAdmin || isStaff;
  const canViewProjects =
    permissions.has('projects.view') ||
    permissions.has('projects.edit') ||
    isOwner ||
    isAdmin ||
    isStaff ||
    isContractor ||
    isClient;
  const canEditProjects =
    permissions.has('projects.edit') ||
    isOwner ||
    isAdmin ||
    isStaff ||
    isContractor;
  const canViewClients =
    permissions.has('clients.view') ||
    permissions.has('clients.edit') ||
    isOwner ||
    isAdmin ||
    isStaff ||
    isContractor;
  const canEditClients =
    permissions.has('clients.edit') || isOwner || isAdmin || isStaff;

  // Invoice permissions are not yet part of the shared app permission enum,
  // so we map visibility to the operational roles that should own invoicing.
  const canViewInvoices = isOwner || isAdmin || isStaff;
  const canEditInvoices = isOwner || isAdmin || isStaff;

  const canViewDashboard = isOwner || isAdmin || isStaff;
  const canViewSchedule = canViewProjects && !isClient;
  const canViewMembers = canManageMembers;
  const canViewSettings = canManageSettings;
  const canViewBilling = canManageBilling;

  const canCreateJob = isOwner || isAdmin || isStaff;
  const canCreateClient = canEditClients;
  const canCreateInvoice = canEditInvoices;
  const canUseQuickCreate =
    canCreateJob || canCreateClient || canCreateInvoice;

  return {
    role,
    companyRole,
    isOwner,
    isAdmin,
    isStaff,
    isContractor,
    isClient,
    canManageRoles,
    canManageBilling,
    canManageSettings,
    canManageMembers,
    canManageInvites,
    canViewProjects,
    canEditProjects,
    canViewClients,
    canEditClients,
    canViewInvoices,
    canEditInvoices,
    canViewDashboard,
    canViewSchedule,
    canViewMembers,
    canViewSettings,
    canViewBilling,
    canCreateJob,
    canCreateClient,
    canCreateInvoice,
    canUseQuickCreate,
  };
}

function normalizeRole(
  role: string | null,
  companyRole: string | null,
) {
  if (role) {
    return role;
  }

  switch (companyRole) {
    case 'admin':
      return 'owner';
    case 'staff_member':
      return 'staff';
    case 'contractor':
      return 'contractor';
    case 'client':
      return 'client';
    default:
      return null;
  }
}

export function getDefaultAccountPath(
  accountSlug: string,
  input?: TeamAccountAccessInput,
) {
  const access = getTeamAccountAccess(input);

  if (access.canViewDashboard) {
    return pathsConfig.app.accountHome.replace('[account]', accountSlug);
  }

  if (access.canViewProjects) {
    return pathsConfig.app.accountJobs.replace('[account]', accountSlug);
  }

  if (access.canViewSettings) {
    return pathsConfig.app.accountSettings.replace('[account]', accountSlug);
  }

  return pathsConfig.app.home;
}
