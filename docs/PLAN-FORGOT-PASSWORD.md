# Plan: Recuperación de contraseña

## Objetivo

Implementar el flujo "Olvidaste tu contraseña?" desde `/login` (botón ya existente en `src/app/login/login-form.tsx:79`): el usuario pide un link de reset por email, entra a una página para definir una contraseña nueva, y vuelve a iniciar sesión.

## Flujo de usuario

1. En `/login`, clic en "Olvidaste tu contraseña?" navega a `/forgot-password`.
2. `/forgot-password`: formulario con solo email. Al enviar, SIEMPRE muestra mensaje genérico de éxito ("Si existe una cuenta para ese email, te enviamos un link de recuperación"). Sin importar si el email existe o no.
3. Si la cuenta existe: se crea un token de un solo uso, se envía email con link `/reset-password?token=...`.
4. `/reset-password`: valida el token. Si es válido, muestra formulario de contraseña nueva + confirmación. Al enviar, actualiza `User.password`, invalida el token y redirige a `/login` con mensaje de éxito.
5. Token inválido, expirado o ya usado: error genérico con link para volver a `/forgot-password`.

## Decisiones de diseño

- **Nuevo modelo `PasswordResetToken`** en `prisma/schema.prisma` (no reutilizar `VerificationToken`, que pertenece al flujo de verificación de email y NextAuth lo administra). Requiere migración Prisma.
- **Anti-enumeración** (mismo criterio que registro V6b): respuesta idéntica exista o no la cuenta. No se envía email si el email no está registrado. Sin timing oracle porque no hay bcrypt en el path de solicitud.
- **Rate limiting**: reutilizar `src/lib/rate-limit.ts` (ya usado por login de credenciales). Límites por IP en los dos endpoints: solicitud de reset y envío de contraseña nueva.
- **Token**: `randomBytes(32).toString('hex')`, TTL corto (1 hora), un solo uso. Se borra al consumirse. Al pedir uno nuevo se elimina el anterior del mismo usuario (`deleteMany`), igual que `src/lib/verification-token.ts`.
- **Hash de la contraseña nueva**: `bcryptjs` (misma dependencia que usa `src/lib/auth.ts` para login).
- **Email**: Resend vía `src/lib/email.ts`, agregar `sendPasswordResetEmail(to, token)` siguiendo el patrón de `sendVerificationEmail`.
- **Invalidar sesiones activas**: al cambiar la contraseña, borrar las `Session` del usuario para forzar re-login en otros dispositivos.

## Fases de trabajo

### Fase 1 — Modelo y migración

- Agregar a `prisma/schema.prisma`:
  - `model PasswordResetToken`: `identifier` (email), `token`, `expires`, `createdAt`. Sin relación FK con User (identificador por email, igual que `VerificationToken`).
- Generar migración (`pnpm prisma migrate dev`) y regenerar `src/generated/prisma`.

### Fase 2 — Lógica compartida

- `src/lib/password-reset.ts`:
  - `issuePasswordResetToken(email)`: `deleteMany` previos + create token + `sendPasswordResetEmail`.
  - `consumePasswordResetToken(token)`: busca token válido y no expirado, borra en transacción, devuelve email.
  - `resetPassword(email, newPassword)`: `bcrypt.hash`, actualiza `User.password`, borra sesiones del usuario.
- `src/lib/email.ts`: agregar `sendPasswordResetEmail`.
- `src/lib/validation.ts` o esquema propio: validación de contraseña (reutilizar las reglas de fortaleza del registro, ver `src/app/register/schema.ts`).

### Fase 3 — Página `/forgot-password`

- `src/app/forgot-password/page.tsx`, `forgot-password-form.tsx`, `schema.ts`, `actions.ts` (mismo patrón que `src/app/login/`).
- Server action: valida email con zod, aplica rate limit, si el usuario existe emite token y manda email; SIEMPRE responde éxito genérico. No exponer si la cuenta existía.

### Fase 4 — Página `/reset-password`

- `src/app/reset-password/page.tsx`, `reset-password-form.tsx`, `schema.ts`, `actions.ts`.
- Lee `token` de `searchParams`, valida estado al renderizar (muestra error genérico si es inválido/expirado).
- Server action: valida token nuevamente (no confiar solo en el render), rate limit, valida contraseña nueva, consume token, actualiza password, redirige a `/login`.
- Usar `safeRedirect`/redirect interno existente para evitar open redirect si aplica.

### Fase 5 — Seguridad y detalles

- Límites de rate-limit: por IP, distinto bucket para `forgot-password` y `reset-password`.
- Error de envío de email: reportar a Sentry pero mantener el mensaje de éxito genérico al usuario (patrón de `email.ts`, que ya lanza error de Resend).
- Link del email: usar `env.NEXTAUTH_URL` como en `sendVerificationEmail`.

### Fase 6 — Tests

- Unit (Vitest):
  - `password-reset`: token expirado, token ya usado, `deleteMany` de tokens previos, `resetPassword` actualiza hash y borra sesiones.
  - Rate limit de los dos endpoints.
- e2e (Playwright, dir `e2e/`):
  - Flujo completo: login → forgot → email → reset → login con nueva contraseña.
  - Email inexistente: muestra mismo mensaje de éxito, no envía email.
  - Token reutilizado: segundo uso falla.
  - Contraseña nueva débil: error de validación.

### Fase 7 — Integración y CI

- Verificar typecheck, lint y tests locales (`pnpm` hooks pre-push ya los cubren).
- Si hay vars de entorno nuevas, seguir la regla de las tres ubicaciones (`env.ts`, `.env.example`, `ci.yml`). No se esperan vars nuevas: RESEND y NEXTAUTH_URL ya existen.
- Commit(s) con Conventional Commits (`feat(auth): password reset flow`).

## Fuera de alcance

- Cambio de contraseña para usuario ya autenticado (eso va en `/account`).
- Verificación de email en el flujo de reset (el reset no modifica `emailVerified`).
