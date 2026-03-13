'use client';

import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  createClient,
  updateClient,
  deleteClient,
} from '../_lib/server/server-actions';

type Client = {
  id: string;
  account_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  picture_url: string | null;
};

export type CreateInitialValues = {
  first_name?: string;
  company_name?: string;
};

export function ClientForm({
  accountId,
  mode,
  client,
  initialValues,
  canEdit = true,
  onSaved,
  onDeleted,
  onCancel,
}: {
  accountId: string;
  mode: 'create' | 'edit';
  client?: Client | null;
  /** Prefill when mode is create (e.g. from pipeline deal won). */
  initialValues?: CreateInitialValues;
  canEdit?: boolean;
  onSaved: () => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [first_name, setFirstName] = useState(
    mode === 'create' && initialValues?.first_name !== undefined
      ? initialValues.first_name
      : (client?.first_name ?? ''),
  );
  const [last_name, setLastName] = useState(client?.last_name ?? '');
  const [company_name, setCompanyName] = useState(
    mode === 'create' && initialValues?.company_name !== undefined
      ? initialValues.company_name
      : (client?.company_name ?? ''),
  );
  const [email, setEmail] = useState(client?.email ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [address_line_1, setAddressLine1] = useState(
    client?.address_line_1 ?? '',
  );
  const [address_line_2, setAddressLine2] = useState(
    client?.address_line_2 ?? '',
  );
  const [city, setCity] = useState(client?.city ?? '');
  const [postcode, setPostcode] = useState(client?.postcode ?? '');
  const [country, setCountry] = useState(client?.country ?? '');

  const isReadOnly = mode === 'edit' && !canEdit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        await createClient({
          accountId,
          first_name: first_name.trim(),
          last_name: last_name.trim() || undefined,
          company_name: company_name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address_line_1: address_line_1.trim() || undefined,
          address_line_2: address_line_2.trim() || undefined,
          city: city.trim() || undefined,
          postcode: postcode.trim() || undefined,
          country: country.trim() || undefined,
        });
        toast.success('Client created');
        onSaved();
      } else if (client) {
        await updateClient({
          accountId,
          clientId: client.id,
          first_name: first_name.trim(),
          last_name: last_name.trim() || null,
          company_name: company_name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          address_line_1: address_line_1.trim() || null,
          address_line_2: address_line_2.trim() || null,
          city: city.trim() || null,
          postcode: postcode.trim() || null,
          country: country.trim() || null,
        });
        toast.success('Client updated');
        onSaved();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client || !onDeleted || !confirm('Delete this client? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteClient({ accountId, clientId: client.id });
      toast.success('Client deleted');
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name *</Label>
          <Input
            id="first_name"
            value={first_name}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. John"
            required
            readOnly={isReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last name</Label>
          <Input
            id="last_name"
            value={last_name}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Smith"
            readOnly={isReadOnly}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company_name">Company</Label>
        <Input
          id="company_name"
          value={company_name}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Company name"
          readOnly={isReadOnly}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            readOnly={isReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            readOnly={isReadOnly}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address_line_1">Address line 1</Label>
        <Input
          id="address_line_1"
          value={address_line_1}
          onChange={(e) => setAddressLine1(e.target.value)}
          placeholder="Street address"
          readOnly={isReadOnly}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address_line_2">Address line 2</Label>
        <Input
          id="address_line_2"
          value={address_line_2}
          onChange={(e) => setAddressLine2(e.target.value)}
          placeholder="Apartment, suite, etc."
          readOnly={isReadOnly}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            readOnly={isReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postcode">Postcode</Label>
          <Input
            id="postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            readOnly={isReadOnly}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          readOnly={isReadOnly}
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {!isReadOnly && (
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : mode === 'create' ? 'Create client' : 'Save changes'}
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {mode === 'edit' && canEdit && onDeleted && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete client'}
          </Button>
        )}
      </div>
    </form>
  );
}
