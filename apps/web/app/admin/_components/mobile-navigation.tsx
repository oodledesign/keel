import Link from 'next/link';

import { Menu } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

export function AdminMobileNavigation() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Menu className={'h-8 w-8'} />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem>
          <Link href={'/admin'}>Home</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/users'}>Users</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/workspaces'}>Workspaces</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/billing'}>Billing</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/accounts'}>Accounts</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/support'}>Support</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/email-marketing'}>Email marketing</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/email-log'}>Email log</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/audit'}>Audit log</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
