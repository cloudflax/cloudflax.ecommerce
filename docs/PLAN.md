# Plan de trabajo — Auth: Login, Registro y Dashboards por Rol

Última actualización: 2026-08-07 (Fase 0 completa)

Alcance: sistema de autenticación, roles y acceso a dashboards. Catálogo, checkout, pagos, logística y notificaciones NO están en este plan — quedan como contexto (ver abajo) para cuando les toque su propio plan.

Convención de estado: `[ ]` pendiente · `[~]` en progreso · `[x]` listo

## Cómo usar este plan

- Las tareas dentro de un mismo **Track** de una fase son independientes — se pueden abordar en cualquier orden o en paralelo.
- Una fase empieza en cuanto su dependencia explícita esté lista, no hace falta 100% de la fase anterior.
- Al completar: marcar `[x]` y actualizar la fecha de "Última actualización".

---

## Fase 0 — Modelo de roles (bloqueante, hacer primero)

- [x] `role` enum en `User` (`ADMIN`, `STAFF`, `DELIVERY`, `CUSTOMER`) + migration (`prisma/migrations/20260807193016_add_user_role`)
- [x] Default `role` para registro público = `CUSTOMER` (enforced a nivel DB, no en código — mientras no se setee `role` explícito en el insert queda en CUSTOMER)

## Fase 1 — Paralelizable tras Fase 0

### Track A: Registro cliente — completo (2026-08-07)

- [x] Página `/register` (UI) — `src/app/register/page.tsx`
- [x] Server action `registerAction`: hash password (bcryptjs), valida email único, crea `User` con `role: CUSTOMER` (default), auto-login con `signIn` y redirect a `/account` — `src/app/register/actions.ts`
- [x] Validación de formulario (zod) — `src/app/register/schema.ts`: nombre, email, teléfono, password (min 8 + mayús + número + símbolo), confirmar password, checkbox términos
- [x] Schema: agregado `phone` y `termsAcceptedAt` a `User` (migration `20260807215247_add_user_phone_terms_accepted`)
- [x] Componentes shadcn agregados: `input`, `label`, `checkbox`
- [x] Fix: excepción eslint `jsx-a11y/label-has-associated-control` para `src/components/ui/**` (primitivos shadcn, falso positivo)
- Nota: `/account` todavía no existe (Fase 2) — el redirect post-registro a `/account` dará 404 hasta esa fase

### Track B: Login UI — completo (2026-08-07)

- [x] Página `/login` (UI) — `src/app/login/page.tsx`
- [x] Manejo de errores visibles: `src/lib/auth.ts` ahora tira `InvalidLoginError` / `RateLimitedError` (subclases de `CredentialsSignin`, cada una con su `code`) en vez de devolver `null` en ambos casos — `src/app/login/actions.ts` distingue el mensaje
- [x] `pages.signIn: '/login'` en `auth.ts` — cualquier redirect de NextAuth cae en nuestra página, no en la default
- Probado en navegador: credenciales inválidas, rate-limit al 6to intento, login válido (admin) redirige a `/`
- Nota: redirect post-login es fijo a `/` por ahora — el redirect según `role` es tarea de Track C, no se adelantó acá

### Track C: Protección de rutas — completo (2026-08-07)

- [x] `src/proxy.ts` — bloquea `/admin`, `/account`, `/delivery` sin sesión, redirige a `/login?callbackUrl=...` (esta versión de Next.js renombró `middleware.ts` a `proxy.ts`/`export const proxy`, no `middleware`)
- [x] `role` propagado al JWT/session vía callbacks en `auth.ts` (`session.user.role`), con módulo de tipos `src/types/next-auth.d.ts` para `Session`/`User`
- [x] Redirect post-login según `role` (`ROLE_HOME` en `auth.ts`, reusado por `proxy.ts` y `login/actions.ts`) — respeta `callbackUrl` si es una ruta interna segura, si no cae al home del rol
- [x] Bloqueo cruzado entre roles: si un rol entra a un área que no es la suya, rebota a su propio home (no 403 genérico)
- [x] Edge case: sesión con JWT sin `role` (emitida antes de este cambio) se trata como no-autenticada en vez de romper con una URL inválida
- Probado en navegador: sin sesión → login con callbackUrl; login admin → `/admin`; admin en `/account` → rebota a `/admin`; cliente en `/admin` → rebota a `/account`
- Nota: `/admin`, `/account`, `/delivery` siguen dando 404 — son shells vacíos, eso es Fase 2

## Fase 2 — Shells de dashboard — completo (2026-08-07)

- [x] `/admin` — layout + nav, guard `ADMIN` + `STAFF`
- [x] `/account` — layout + nav, guard `CUSTOMER`
- [x] `/delivery` — layout + nav, guard `DELIVERY`
- [x] `requireRole()` en `auth.ts` — cada layout vuelve a chequear sesión/rol server-side (no confía solo en `proxy.ts`; los docs de Next 16 lo piden explícitamente)
- [x] `SignOutButton` compartido — probado en navegador: cierra sesión y `/admin` vuelve a bloquear
- Nota: son shells vacíos ("Todavía no hay nada acá") — contenido real de cada dashboard es trabajo futuro fuera de este plan (catálogo, pedidos, entregas, etc. — ver Backlog)

## Fase 3 — Verificación de email — completo (2026-08-07)

- [x] Resend integrado — `src/lib/email.ts` (cliente + `sendVerificationEmail`), env vars `RESEND_API_KEY`/`EMAIL_FROM`
- [x] Token de verificación — `src/lib/verification-token.ts` (`issueVerificationEmail`), usa el `VerificationToken` que ya existía en el schema (Auth.js), TTL 24h, invalida tokens previos del mismo email
- [x] `/verify-email` — valida token, setea `emailVerified`, borra el token (uso único)
- [x] Login bloqueado hasta verificar: `EmailNotVerifiedError` en `authorize()` (`auth.ts`)
- [x] Registro ya no auto-loguea (siempre falla por no-verificado) — muestra mensaje "revisá tu email" en vez de forzar signIn
- [x] Reenvío de verificación desde `/login` (`resendVerificationAction`) — mismo mensaje exista o no la cuenta, para no filtrar qué emails están registrados
- [x] Fallos de envío no bloquean el registro/reenvío (cuenta ya creada, se puede reenviar después) — se reportan a Sentry vía `Sentry.captureException`, no rompen la UX
- [x] Scripts de seed (`create-admin`, `seed-test-users`) actualizados para marcar `emailVerified` — si no, quedaban sin poder loguear con el nuevo bloqueo
- Bug encontrado y corregido en el camino: el SDK de Resend devuelve `{data, error}` en vez de tirar excepción — sin chequear `error` explícitamente, un envío fallido se veía idéntico a uno exitoso (fallaba en silencio)
- Probado en navegador end-to-end: registro → login bloqueado → reenvío → `/verify-email` con token real → login exitoso → usuarios sembrados (ya verificados) sin regresión
- Costo real en producción (Resend): plan Free cubre 3,000 emails/mes (tope 100/día) — alcanza sobrado solo para verificación. Si más adelante se suman notificaciones de pedidos, ahí sí escala a Pro ($20/mes, 50k emails)

---

## Backlog — fuera de este plan (pertenece a otras secciones del producto)

No planificar acá, son decisiones ya tomadas que quedan de contexto para cuando arranque cada sección:

- Catálogo (Product, ProductVariant, stock por variante)
- Checkout + carrito
- Pagos: contraentrega + transferencia con comprobante (necesita storage, ej. Cloudflare R2)
- Logística propia: rol `DELIVERY` ya contemplado arriba en el shell, pero la lógica de asignación de entregas va en su propio plan
- Notificaciones: email (Resend) + WhatsApp (fase aparte, mayor esfuerzo) + dashboard
- Reportes de ventas, devoluciones (`ReturnRequest`), soporte/tickets `STAFF`

## Decisiones tomadas (contexto, no volver a preguntar)

- Modelo de negocio: B2C tienda propia (no marketplace, no B2B)
- Roles: `ADMIN`, `STAFF` (solo pedidos + soporte, sin acceso a catálogo/precios/usuarios), `DELIVERY` (repartidores propios, vista web responsive), `CUSTOMER`
- Login: email + password (ya existe) + verificación de email obligatoria (pendiente de decidir timing, ver Fase 3) + guest checkout (aplica a checkout, no a este plan)
