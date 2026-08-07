import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Nombre requerido'),
    email: z.email('Email inválido'),
    phone: z.string().min(7, 'Teléfono inválido'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir una mayúscula')
      .regex(/[0-9]/, 'Debe incluir un número')
      .regex(/[^A-Za-z0-9]/, 'Debe incluir un símbolo'),
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
