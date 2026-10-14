import { z } from 'zod';

export const DEPARTMENTS = [
  'Camera', 'Grip & Electric', 'Sound', 'Art', 'Wardrobe', 'Hair & Makeup',
  'Production', 'Locations', 'Cast', 'Music',
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const unavailabilitySchema = z
  .object({ from: isoDate, to: isoDate, reason: z.string().max(200).optional() })
  .refine((u) => u.to >= u.from, { message: 'to must not be before from', path: ['to'] });

export const crewInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  department: z.enum(DEPARTMENTS),
  roles: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  pronouns: z.string().max(40).optional(),
  unavailable: z.array(unavailabilitySchema).max(100).default([]),
});

export const crewPatchSchema = crewInputSchema.partial().strict();

export const listQuerySchema = z.object({
  department: z.enum(DEPARTMENTS).optional(),
  q: z.string().trim().max(100).optional(),
  availableOn: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
