import Link from 'next/link';

import { ArrowLeft, Menu } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

import pathsConfig from '~/config/paths.config';

export function AdminMobileNavigation() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Menu className={'h-8 w-8'} />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem>
          <Link href={pathsConfig.app.home} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Link>
        </DropdownMenuItem>

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
          <Link href={'/admin/finances'}>Finances</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/billing/at-risk'}>At-risk</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/branding'}>Branding</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/subprocessors'}>Sub-processors</Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Link href={'/admin/blog'}>Blog</Link>
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
