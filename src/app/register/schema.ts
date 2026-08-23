import { z } from 'zod';
import { emailSchema, passwordSchema } from '@/lib/validation';

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Nombre requerido'),
    email: emailSchema,
    phone: z.string().min(7, 'Teléfono inválido'),
    password: passwordSchema,
    confirmPassword: z.string(),
    terms: z
      .boolean()
      .refine((value) => value === true, 'Debés aceptar los términos y condiciones'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
