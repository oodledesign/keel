'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { Filter } from 'lucide-react';

import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

const ALL = '__all__';

export function SignaturesStaffFilters({
  branches,
  departments,
}: {
  branches: Array<{ id: string; name: string }>;
  departments: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === ALL) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 md:grid-cols-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Filter className="h-4 w-4 text-[#39AEB3]" />
        Filter staff
      </div>
      <div className="space-y-2">
        <Label>Branch</Label>
        <Select
          value={searchParams.get('branch') ?? ALL}
          onValueChange={(value) => setFilter('branch', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All branches</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Department / Status</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={searchParams.get('department') ?? ALL}
            onValueChange={(value) => setFilter('department', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={searchParams.get('status') ?? ALL}
            onValueChange={(value) => setFilter('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="pushed">Pushed</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
