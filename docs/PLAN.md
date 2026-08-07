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

### Track C: Protección de rutas

- [ ] Middleware: bloquear `/admin`, `/account`, `/delivery` sin sesión
- [ ] Redirect post-login según `role` (`ADMIN`/`STAFF` → `/admin`, `DELIVERY` → `/delivery`, `CUSTOMER` → `/account`)

## Fase 2 — Shells de dashboard (paralelizable, depende de Fase 1 Track C)

- [ ] `/admin` — layout + nav, guard `ADMIN` + `STAFF` (sin contenido real todavía, solo shell protegido)
- [ ] `/account` — layout + nav, guard `CUSTOMER`
- [ ] `/delivery` — layout + nav, guard `DELIVERY`

## Fase 3 — Verificación de email (evaluar si va en MVP o después)

- [ ] Token de verificación (modelo `VerificationToken` ya existe en el schema, es de Auth.js)
- [ ] Flujo de verificación obligatoria antes de loguear
- Nota: depende de tener un email service (ver Backlog — Resend no está integrado aún). Si se quiere esto en MVP, hay que traer esa dependencia antes.

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
