import { redirect } from 'next/navigation';

import { AdminGuard } from '@kit/admin/components/admin-guard';

async function AdminAccountsRedirectPage() {
  redirect('/admin/workspaces');
  return null;
}

export default AdminGuard(AdminAccountsRedirectPage);
