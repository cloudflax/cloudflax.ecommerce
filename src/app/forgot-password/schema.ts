import { z } from 'zod';
import { emailSchema } from '@/lib/validation';

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
