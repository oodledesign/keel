import { z } from 'zod';

export const CreatePRDSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  overview: z
    .string()
    .min(1, 'Overview is required')
    .max(1000, 'Overview must be less than 1000 characters'),
  problemStatement: z
    .string()
    .min(1, 'Problem statement is required')
    .max(1000, 'Problem statement must be less than 1000 characters'),
  marketOpportunity: z
    .string()
    .min(1, 'Market opportunity is required')
    .max(1000, 'Market opportunity must be less than 1000 characters'),
  targetUsers: z
    .array(z.string().min(1, 'Target user cannot be empty'))
    .min(1, 'At least one target user is required'),
  solutionDescription: z
    .string()
    .min(1, 'Solution description is required')
    .max(1000, 'Solution description must be less than 1000 characters'),
  keyFeatures: z
    .array(z.string().min(1, 'Feature cannot be empty'))
    .min(1, 'At least one key feature is required'),
  successMetrics: z
    .array(z.string().min(1, 'Metric cannot be empty'))
    .min(1, 'At least one success metric is required'),
});

export type CreatePRDData = z.infer<typeof CreatePRDSchema>;
