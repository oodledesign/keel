'use client';

import Link from 'next/link';

import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import pathsConfig from '~/config/paths.config';
import type {
  ProjectFieldDefinition,
  ProjectFieldValue,
} from '~/lib/campaign-projects/types';

type LinkOptions = {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function CampaignFieldCell({
  field,
  value,
  canEdit,
  accountSlug,
  linkOptions,
  onChange,
}: {
  field: ProjectFieldDefinition;
  value: ProjectFieldValue;
  canEdit: boolean;
  accountSlug: string;
  linkOptions: LinkOptions;
  onChange: (value: ProjectFieldValue) => void;
}) {
  if (!canEdit) {
    return <CampaignFieldDisplay field={field} value={value} accountSlug={accountSlug} linkOptions={linkOptions} />;
  }

  switch (field.fieldType) {
    case 'checkbox':
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
        </div>
      );
    case 'select':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={(next) => onChange(next || null)}
        >
          <SelectTrigger className="h-8 border-white/10 bg-transparent text-xs text-white">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1A2535] text-white">
            {(field.options.choices ?? []).map((choice) => (
              <SelectItem key={choice} value={choice}>
                {choice}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'client_link':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={(next) => onChange(next || null)}
        >
          <SelectTrigger className="h-8 border-white/10 bg-transparent text-xs text-white">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1A2535] text-white">
            {linkOptions.clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'project_link':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={(next) => onChange(next || null)}
        >
          <SelectTrigger className="h-8 border-white/10 bg-transparent text-xs text-white">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1A2535] text-white">
            {linkOptions.projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'currency':
    case 'number':
      return (
        <Input
          type="number"
          defaultValue={typeof value === 'number' ? String(value) : ''}
          onBlur={(event) => {
            const raw = event.target.value.trim();
            onChange(raw ? Number(raw) : null);
          }}
          className="h-8 border-white/10 bg-transparent text-xs text-white"
        />
      );
    case 'date':
      return (
        <Input
          type="date"
          defaultValue={typeof value === 'string' ? value : ''}
          onBlur={(event) => onChange(event.target.value || null)}
          className="h-8 border-white/10 bg-transparent text-xs text-white"
        />
      );
    case 'url':
      return (
        <Input
          type="url"
          defaultValue={typeof value === 'string' ? value : ''}
          onBlur={(event) => onChange(event.target.value.trim() || null)}
          placeholder="https://"
          className="h-8 border-white/10 bg-transparent text-xs text-white"
        />
      );
    case 'email':
      return (
        <Input
          type="email"
          defaultValue={typeof value === 'string' ? value : ''}
          onBlur={(event) => onChange(event.target.value.trim() || null)}
          className="h-8 border-white/10 bg-transparent text-xs text-white"
        />
      );
    default:
      return (
        <Input
          defaultValue={typeof value === 'string' ? value : ''}
          onBlur={(event) => onChange(event.target.value.trim() || null)}
          className="h-8 border-white/10 bg-transparent text-xs text-white"
        />
      );
  }
}

export function CampaignFieldDisplay({
  field,
  value,
  accountSlug,
  linkOptions,
}: {
  field: ProjectFieldDefinition;
  value: ProjectFieldValue;
  accountSlug: string;
  linkOptions: LinkOptions;
}) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-zinc-500">—</span>;
  }

  switch (field.fieldType) {
    case 'checkbox':
      return <span>{value === true ? 'Yes' : 'No'}</span>;
    case 'currency':
      return (
        <span>{typeof value === 'number' ? formatCurrency(value) : String(value)}</span>
      );
    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer"
          className="text-[#5eead4] hover:underline"
        >
          {String(value).replace(/^https?:\/\//, '')}
        </a>
      );
    case 'client_link': {
      const client = linkOptions.clients.find((row) => row.id === value);
      if (!client) return <span>{String(value)}</span>;
      const href = `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${client.id}`;
      return (
        <Link href={href} className="text-[#5eead4] hover:underline">
          {client.name}
        </Link>
      );
    }
    case 'project_link': {
      const project = linkOptions.projects.find((row) => row.id === value);
      if (!project) return <span>{String(value)}</span>;
      const href = pathsConfig.app.accountCampaignDetail
        .replace('[account]', accountSlug)
        .replace('[id]', project.id);
      return (
        <Link href={href} className="text-[#5eead4] hover:underline">
          {project.name}
        </Link>
      );
    }
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}
