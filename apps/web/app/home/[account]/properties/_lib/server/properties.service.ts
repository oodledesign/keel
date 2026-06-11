import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type Property = {
  id: string;
  accountId: string;
  name: string;
  address: string | null;
  propertyType: 'residential' | 'commercial' | 'land' | 'other';
  status: 'active' | 'vacant' | 'maintenance' | 'sold' | 'archived';
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PropertyDocument = {
  id: string;
  propertyId: string;
  accountId: string;
  uploadedBy: string | null;
  name: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  documentType: string;
  createdAt: string;
};

type PropertyRow = {
  id: string;
  account_id: string;
  name?: string | null;
  address?: string | null;
  property_type?: string | null;
  status?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_footage?: number | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  property_id: string;
  account_id: string;
  uploaded_by?: string | null;
  name?: string | null;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  document_type?: string | null;
  created_at: string;
};

function mapProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name ?? 'Untitled',
    address: row.address ?? null,
    propertyType: (row.property_type as Property['propertyType']) ?? 'residential',
    status: (row.status as Property['status']) ?? 'active',
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    squareFootage: row.square_footage ?? null,
    purchaseDate: row.purchase_date ?? null,
    purchasePrice: row.purchase_price ?? null,
    currentValue: row.current_value ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row: DocumentRow): PropertyDocument {
  return {
    id: row.id,
    propertyId: row.property_id,
    accountId: row.account_id,
    uploadedBy: row.uploaded_by ?? null,
    name: row.name ?? 'Document',
    filePath: row.file_path,
    fileSize: row.file_size ?? null,
    mimeType: row.mime_type ?? null,
    documentType: row.document_type ?? 'other',
    createdAt: row.created_at,
  };
}

export function createPropertiesService(client: SupabaseClient) {
  return {
    async listProperties(accountId: string): Promise<Property[]> {
      const { data, error } = await client
        .from('properties')
        .select('*')
        .eq('account_id', accountId)
        .not('status', 'eq', 'archived')
        .order('name');

      if (error) {
        console.error('[properties] listProperties error:', error.message);
        return [];
      }

      return ((data ?? []) as PropertyRow[]).map(mapProperty);
    },

    async getProperty(propertyId: string): Promise<Property | null> {
      const { data, error } = await client
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .maybeSingle();

      if (error || !data) return null;
      return mapProperty(data as PropertyRow);
    },

    async createProperty(input: {
      accountId: string;
      name: string;
      address?: string | null;
      propertyType?: string;
      status?: string;
      bedrooms?: number | null;
      bathrooms?: number | null;
      squareFootage?: number | null;
      purchaseDate?: string | null;
      purchasePrice?: number | null;
      currentValue?: number | null;
      notes?: string | null;
    }): Promise<Property> {
      const { count, error: countError } = await client
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', input.accountId)
        .neq('status', 'archived');

      if (countError) {
        throw new Error(countError.message);
      }

      const { assertPropertyCreateAllowed } = await import(
        '~/lib/billing/entitlements'
      );
      const gate = await assertPropertyCreateAllowed(
        client,
        input.accountId,
        count ?? 0,
      );
      if (!gate.allowed) {
        throw new Error(gate.reason ?? 'Property limit reached for your plan.');
      }

      const { data, error } = await client
        .from('properties')
        .insert({
          account_id: input.accountId,
          name: input.name,
          address: input.address ?? null,
          property_type: input.propertyType ?? 'residential',
          status: input.status ?? 'active',
          bedrooms: input.bedrooms ?? null,
          bathrooms: input.bathrooms ?? null,
          square_footage: input.squareFootage ?? null,
          purchase_date: input.purchaseDate ?? null,
          purchase_price: input.purchasePrice ?? null,
          current_value: input.currentValue ?? null,
          notes: input.notes ?? null,
        })
        .select('*')
        .single();

      if (error || !data) throw new Error(error?.message ?? 'Failed to create property');
      return mapProperty(data as PropertyRow);
    },

    async updateProperty(
      propertyId: string,
      input: {
        name?: string;
        address?: string | null;
        propertyType?: string;
        status?: string;
        bedrooms?: number | null;
        bathrooms?: number | null;
        squareFootage?: number | null;
        purchaseDate?: string | null;
        purchasePrice?: number | null;
        currentValue?: number | null;
        notes?: string | null;
      },
    ): Promise<Property> {
      const { data, error } = await client
        .from('properties')
        .update({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.propertyType !== undefined && { property_type: input.propertyType }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.bedrooms !== undefined && { bedrooms: input.bedrooms }),
          ...(input.bathrooms !== undefined && { bathrooms: input.bathrooms }),
          ...(input.squareFootage !== undefined && { square_footage: input.squareFootage }),
          ...(input.purchaseDate !== undefined && { purchase_date: input.purchaseDate }),
          ...(input.purchasePrice !== undefined && { purchase_price: input.purchasePrice }),
          ...(input.currentValue !== undefined && { current_value: input.currentValue }),
          ...(input.notes !== undefined && { notes: input.notes }),
        })
        .eq('id', propertyId)
        .select('*')
        .single();

      if (error || !data) throw new Error(error?.message ?? 'Failed to update property');
      return mapProperty(data as PropertyRow);
    },

    async deleteProperty(propertyId: string): Promise<void> {
      const { error } = await client
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw new Error(error.message);
    },

    async listDocuments(propertyId: string): Promise<PropertyDocument[]> {
      const { data, error } = await client
        .from('property_documents')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) return [];
      return ((data ?? []) as DocumentRow[]).map(mapDocument);
    },

    async createDocument(input: {
      propertyId: string;
      accountId: string;
      uploadedBy: string;
      name: string;
      filePath: string;
      fileSize?: number | null;
      mimeType?: string | null;
      documentType?: string;
    }): Promise<PropertyDocument> {
      const { data, error } = await client
        .from('property_documents')
        .insert({
          property_id: input.propertyId,
          account_id: input.accountId,
          uploaded_by: input.uploadedBy,
          name: input.name,
          file_path: input.filePath,
          file_size: input.fileSize ?? null,
          mime_type: input.mimeType ?? null,
          document_type: input.documentType ?? 'other',
        })
        .select('*')
        .single();

      if (error || !data) throw new Error(error?.message ?? 'Failed to create document record');
      return mapDocument(data as DocumentRow);
    },

    async deleteDocument(documentId: string): Promise<void> {
      const { error } = await client
        .from('property_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw new Error(error.message);
    },
  };
}
