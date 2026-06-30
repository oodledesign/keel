'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PROPERTY_DOCUMENT_TYPES } from '../document-types';
import { createPropertiesService } from './properties.service';

function getService() {
  return createPropertiesService(getSupabaseServerClient());
}

const ListPropertiesSchema = z.object({
  accountId: z.string().uuid(),
});

const GetPropertySchema = z.object({
  propertyId: z.string().uuid(),
});

const PropertyInputSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional().nullable(),
  propertyType: z.enum(['residential', 'commercial', 'land', 'other']).default('residential'),
  status: z.enum(['active', 'vacant', 'maintenance', 'sold', 'archived']).default('active'),
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().min(0).optional().nullable(),
  squareFootage: z.number().int().min(0).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.number().int().min(0).optional().nullable(),
  currentValue: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const UpdatePropertySchema = PropertyInputSchema.extend({
  propertyId: z.string().uuid(),
}).omit({ accountId: true });

const DeletePropertySchema = z.object({
  propertyId: z.string().uuid(),
});

const ListDocumentsSchema = z.object({
  propertyId: z.string().uuid(),
});

const CreateDocumentSchema = z.object({
  propertyId: z.string().uuid(),
  accountId: z.string().uuid(),
  uploadedBy: z.string().uuid(),
  name: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  documentType: z.enum(PROPERTY_DOCUMENT_TYPES).default('other'),
  financialYear: z.string().max(20).optional().nullable(),
});

const UpdateDocumentSchema = z.object({
  documentId: z.string().uuid(),
  name: z.string().min(1).optional(),
  documentType: z.enum(PROPERTY_DOCUMENT_TYPES).optional(),
  financialYear: z.string().max(20).optional().nullable(),
});

const DeleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

export const listProperties = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listProperties(input.accountId);
  },
  { schema: ListPropertiesSchema },
);

export const getProperty = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getProperty(input.propertyId);
  },
  { schema: GetPropertySchema },
);

export const createProperty = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createProperty(input);
  },
  { schema: PropertyInputSchema },
);

export const updateProperty = enhanceAction(
  async (input) => {
    const { propertyId, ...rest } = input;
    const service = getService();
    return service.updateProperty(propertyId, rest);
  },
  { schema: UpdatePropertySchema },
);

export const deleteProperty = enhanceAction(
  async (input) => {
    const service = getService();
    await service.deleteProperty(input.propertyId);
    return { success: true };
  },
  { schema: DeletePropertySchema },
);

export const listDocuments = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listDocuments(input.propertyId);
  },
  { schema: ListDocumentsSchema },
);

export const createDocument = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createDocument(input);
  },
  { schema: CreateDocumentSchema },
);

export const updateDocument = enhanceAction(
  async (input) => {
    const { documentId, ...rest } = input;
    const service = getService();
    return service.updateDocument(documentId, rest);
  },
  { schema: UpdateDocumentSchema },
);

export const deleteDocument = enhanceAction(
  async (input) => {
    const service = getService();
    await service.deleteDocument(input.documentId);
    return { success: true };
  },
  { schema: DeleteDocumentSchema },
);
