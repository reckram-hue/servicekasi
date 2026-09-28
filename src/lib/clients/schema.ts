import { z } from 'zod';

export const LANGUAGES = ['en', 'af', 'zu', 'xh', 'st', 'tn', 'nso', 'ts', 'ss', 've', 'nr', 'pt', 'sn', 'ny', 'sw', 'fr'] as const;

// No server-only imports here — the CSV import preview validates rows with this
// same schema client-side, before anything is sent to the server.
export const ClientSchema = z
  .object({
    firstName: z.string().trim().min(1, { error: 'Enter a first name.' }),
    lastName: z.string().trim().optional(),
    companyName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.union([z.email({ error: 'Enter a valid email address.' }), z.literal('')]).optional(),
    preferredLanguage: z.enum(LANGUAGES).default('en'),
    notes: z.string().trim().optional(),
    whatsappOptIn: z.union([z.literal('on'), z.literal('')]).optional(),
    street: z.string().trim().optional(),
    suburb: z.string().trim().optional(),
    city: z.string().trim().optional(),
    region: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    accessNotes: z.string().trim().optional(),
  })
  .refine((d) => d.phone || d.email, {
    error: 'Enter a phone number or an email address.',
    path: ['phone'],
  });

export type ClientInput = z.infer<typeof ClientSchema>;
