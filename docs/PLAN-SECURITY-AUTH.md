# Plan de trabajo — Hardening de seguridad del flujo de auth

Última actualización: 2026-08-23 (Fases 1–2 completas)

Alcance: vulnerabilidades y fallas encontradas en la auditoría del flujo `/login`, `/register`, `/verify-email` y la capa de sesión/roles. Continúa el trabajo de [PLAN.md](./PLAN.md) (Fases 0–3, completas). No incluye catálogo, checkout ni pagos.

Convención de estado: `[ ]` pendiente · `[~]` en progreso · `[x]` listo

## Cómo usar este plan

- Las fases van en orden de riesgo descendente. La Fase 0 es bloqueante: las Fases 1 y 3 dependen de sus helpers.
- Cada fase es un commit propio, verificable de forma aislada.
- Al completar: marcar `[x]`, anotar hallazgos del camino y actualizar la fecha de "Última actualización".
- Los IDs `V1`…`V12` refieren a los hallazgos de la auditoría del 2026-08-08, listados al final.

---

## Fase 0 — Base compartida (bloqueante) — completo (2026-08-08)

Sin estos helpers, las Fases 1 y 3 duplican lógica de rate limiting.

- [x] `src/lib/request-ip.ts` — `getClientIp()`: lee `headers()` de `next/headers` (async en esta versión de Next), y devuelve `UNKNOWN_IP` cuando no hay nada confiable. Usable solo desde server actions y route handlers (no desde `authorize()`, que no tiene acceso al store de headers).
- [x] `src/lib/rate-limit.ts` — extendido:
  - `rateLimit()` devuelve `{ allowed, retryAfter }` en vez de `boolean`; call site de `auth.ts` actualizado.
  - `rateLimitMany(buckets)` — `INCR` + `TTL` de todos los buckets en un `pipeline` de ioredis, y un segundo pipeline solo para los `EXPIRE` que hagan falta. Cuenta todos los buckets aunque uno ya haya bloqueado, para que los contadores de email e IP no se desincronicen.
  - `retryAfter` sale del TTL real del bucket bloqueado; si hay varios bloqueados, gana el más largo.
- [x] Normalizar email (**V8**) — `emailSchema` compartido en `src/lib/validation.ts`, usado por `src/app/login/schema.ts` y `src/app/register/schema.ts`.
- [x] Verificado el impacto en datos existentes: 0 filas con mayúsculas o espacios, 0 colisiones sobre 4 usuarios. **No hizo falta migration.**
- [x] Env vars nuevas, cada una con su triple registro (`src/lib/env.ts` + `.env.example` + bloque `env:` de `.github/workflows/ci.yml`):
  - `LOGIN_IP_RATE_LIMIT` — default `20` (por minuto)
  - `RESEND_RATE_LIMIT` — default `1` (por 5 minutos)
  - `REGISTER_RATE_LIMIT` — default `5` (por hora)
  - `TRUSTED_PROXY_HOPS` — default `1` (ver nota abajo)
- [x] Tests: `src/lib/rate-limit.test.ts` (9 casos, Redis mockeado) y `src/lib/validation.test.ts` (4 casos).

### Desvíos del plan original

- **`TRUSTED_PROXY_HOPS` es una env var extra, no estaba planificada.** El plan decía "toma el primer valor de `x-forwarded-for`", que es el atajo habitual y también un agujero: ese header es append-only, la parte izquierda la manda el cliente y se puede falsificar entera. Con la lectura leftmost, cualquiera rota el header en cada request y el rate limit por IP de la Fase 1 no frena nada. Se lee la posición N-ésima desde la derecha, que es la que apendó nuestra propia infraestructura. Con `TRUSTED_PROXY_HOPS=0` (app expuesta directo, sin proxy) no se confía en ningún header y todo cae al bucket `unknown`.
- **`vitest.config.mts` necesitó el alias `@`.** Vite no lee los `paths` de `tsconfig.json`; ningún test anterior importaba un módulo que usara `@/...`, así que el problema recién apareció acá.
- **El schema de email quedó en `src/lib/validation.ts`, no duplicado en cada ruta.** Si login y registro normalizan distinto, una cuenta creada como `Jose@x.com` deja de ser alcanzable desde un login tipeado en minúsculas.
- **Orden de la normalización:** `z.string().trim().toLowerCase().pipe(z.email())`, no `z.email().trim()`. Encadenado al revés, `z.email()` rechaza el espacio antes de que el `trim` llegue a limpiarlo.

Verificado: `pnpm typecheck`, `pnpm test` (15 pass), `pnpm lint`, `pnpm format:check`, `pnpm build`. Además smoke test del rate limiter contra el Redis real (los unit tests mockean Redis entero, así que no cubren el uso de la API de ioredis): bloqueo al 4to intento con `LOGIN_RATE_LIMIT=3`, TTL que no se extiende en cada hit, y multi-bucket bloqueando por el contador correcto.

Commit: `refactor(auth): add ip helper and rate-limit primitives`

---

## Fase 1 — Crítico: open redirect, brute force, timing — completo (2026-08-23)

Depende de Fase 0. Sin cambios de UI ni de schema.

- [x] **V1 — Open redirect en `callbackUrl`** (`src/app/login/actions.ts`)
  - `isSafeRedirect` actual bloquea `//evil.com` pero deja pasar `/\evil.com`; los navegadores normalizan `\` a `/` (WHATWG URL), así que el `Location` sale a dominio externo.
  - Reescribir: rechazar backslash, control chars y whitespace, después resolver con `new URL(url, base)` y exigir mismo origen.
  - Test unitario `src/app/login/actions.test.ts` con la lista de vectores: `//e.com`, `/\e.com`, `/\/e.com`, `/%09/e.com`, `/%2F%2Fe.com`, `https://e.com`, `javascript:alert(1)`, y los casos válidos `/admin`, `/account?tab=1`.
- [x] **V2a — Password spraying** — rate limit por IP en `loginAction`, antes del `signIn`. Va en la action y no en `authorize()` porque ahí sí hay acceso a `headers()`.
- [x] **V2b — DoS de cuenta** — el contador por email de `auth.ts:60` bloquea una cuenta ajena con 3 intentos fallidos. Cambiar la ventana fija de 60s por backoff creciente (60s, 5min, 30min según cantidad de bloqueos consecutivos), y usar el `retryAfter` de Fase 0 para que el mensaje diga cuánto falta.
- [x] **V3 — Enumeración por timing** (`src/lib/auth.ts`) — cuando `!user?.password`, comparar contra un hash dummy constante en vez de retornar de una. Hoy el camino "email inexistente" cuesta ~0ms y el "email existente" ~100ms de bcrypt: diferencia medible.

### Desvíos del plan original

- **`isSafeRedirect` quedó en `src/lib/safe-redirect.ts`, no inline en `actions.ts`.** Importar `actions.ts` desde vitest arrastra `next-auth`, `prisma` y `@/lib/env` (que valida env vars al importar); el test unitario queda en `src/lib/safe-redirect.test.ts` en vez de `actions.test.ts`. Misma lista de vectores del plan.
- **V2b implementado como lock escalonado, no como ventana del contador.** El contador de intentos (`login:${email}`, ventana 60s) sigue detectando el bloqueo; al dispararse, un streak (`login:locks:${email}`, TTL 24h) fija un lock (`login:lock:${email}`) de 60s → 5min → 30min según bloqueos consecutivos. Un login exitoso borra streak y lock. Ventaja: el bloqueo sobrevive a la expiración del contador de intentos, que era exactamente el bypass del esquema original.
- **`e2e/global-setup.ts` limpia `login:*` antes de la suite.** Los specs cuentan intentos contra Redis; sobras de corridas anteriores los vuelven flaky (ej. el bucket por IP disparando temprano). Wire en `playwright.config.ts` (`globalSetup`).
- **Dos detalles del spec e2e:** el lockout test usa email único por corrida (Redis queda con llaves de corridas viejas solo por el TTL); el selector del botón de submit es `button[type="submit"]`, no por nombre accesible — la label cambia a "Ingresando..." mientras la action está pendiente y rompe el locator.

Verificación: `pnpm test` (30 pass, incluye 17 casos de `safe-redirect`), `pnpm test:e2e` (3 pass: bloqueo al 4to intento, `callbackUrl` hostil, home), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`. Smoke en Redis: streak creado con TTL 24h tras el primer bloqueo; lock de 60s aplicado.
Commit: `fix(auth): close open redirect, add ip rate limit and constant-time login`

---

## Fase 2 — Login con sesión activa (V4) — completo (2026-08-23)

Independiente de Fase 1, se puede hacer en paralelo. Es el hallazgo que disparó la auditoría.

Riesgo real: permite sobrescribir sesión. Con la sesión de un ADMIN abierta, cualquiera con acceso momentáneo al equipo loguea otra cuenta encima sin pasar por logout y el JWT anterior se reemplaza sin dejar rastro.

- [x] `src/app/login/page.tsx` pasa a server component: llama `auth()` y, si hay sesión, `redirect(ROLE_HOME[session.user.role])`.
- [x] Mover el formulario a `src/app/login/login-form.tsx` con `'use client'`, recibiendo `callbackUrl` por prop en vez de leer `searchParams` con `use()`.
- [x] Caso borde: sesión presente pero rol sin entrada en `ROLE_HOME` (el mismo que ya contempla `src/proxy.ts:20`) — mostrar el login, no redirigir a `undefined`.
- [x] Mismo tratamiento en `/register`: con sesión activa no tiene sentido mostrar el alta.

Verificación: spec e2e `e2e/session-redirect.spec.ts` — login, navegar de nuevo a `/login` y a `/register`, ambos redirigen a `/account`. Suite completa: 4 specs pass.
Commit: `fix(auth): redirect authenticated users away from login and register`

---

## Fase 3 — Abuso de email y enumeración de cuentas

Depende de Fase 0.

- [ ] **V5 — `resendVerificationAction` sin límite** (`src/app/login/actions.ts`) — no pide auth ni token, así que en loop bombardea el inbox de la víctima y quema la cuota de Resend (plan Free: 100 emails/día). Rate limit por email y por IP.
- [ ] **V6a — `registerAction` sin límite** — rate limit por IP; sin esto se crean cuentas en masa, cada una disparando su email de verificación.
- [ ] **V6b — Enumeración explícita en registro** — `'Ya existe una cuenta con este email'` confirma directamente qué emails están registrados, sin necesidad de trucos de timing. Reemplazar por el mismo mensaje neutral del alta exitosa, y al email ya registrado mandarle un aviso de "alguien intentó registrarse con tu dirección" en lugar de crear nada.
  - Costo de UX aceptado: quien ya tenía cuenta y se olvidó no ve el error en pantalla, se entera por el aviso.

Verificación: spec e2e comparando que email registrado y email nuevo devuelvan texto idéntico.
Commit: `fix(auth): rate limit registration and verification resend, drop account enumeration`

---

## Fase 4 — Ciclo de vida de la sesión (V7)

La fase con más superficie de cambio; por eso va después de las críticas.

Problema: `token.role` se escribe una sola vez en el callback `jwt` y la sesión JWT no tiene `maxAge` explícito (default 30 días). Degradar un ADMIN a CUSTOMER, o borrar la cuenta, no tiene efecto: `proxy.ts` y `requireRole()` siguen leyendo el rol viejo del token hasta que expire.

- [ ] `session: { strategy: 'jwt', maxAge: ... }` explícito en `src/lib/auth.ts`.
- [ ] Revalidar el rol contra la DB en el callback `jwt`, con timestamp en el token para no pegarle a la DB en cada request.
- [ ] Invalidar el token si el usuario ya no existe o quedó sin rol válido.
- [ ] Cachear en Redis el rol leído de la DB, con TTL igual al intervalo de revalidación, para que la relectura no sea una query por request.

Verificación: unit del callback `jwt`; e2e de cambio de rol reflejado sin re-login.
Commit: `fix(auth): bound session lifetime and revalidate role against the database`

---

## Fase 5 — Robustez y hardening

- [ ] **V9** — sacar el `user!.role` y la query redundante de `src/app/login/actions.ts:69-70`: si la cuenta se borra entre el `signIn` y el query, es un 500. El rol ya viene en el JWT recién emitido.
- [ ] **V10a** — `src/app/verify-email/page.tsx` muta estado en un GET: los escáneres de links de Outlook/Gmail consumen el token al prefetchear y el usuario después ve "Link inválido". Pasar la mutación a POST con botón de confirmación.
- [ ] **V10b** — mismo archivo: `prisma.user.update` tira P2025 sin catch si el usuario fue borrado tras emitirse el token. Envolver.
- [ ] **V11** — `src/lib/rate-limit.ts` falla cerrado hacia todos: Redis caído significa que nadie puede loguear. No es un bypass, pero es un SPOF del login. Se mantiene fail-closed por decisión; agregar `Sentry.captureException` en el catch para que la caída se detecte por alerta y no por reportes de usuarios.
- [ ] **V12** — headers en `next.config.ts`: CSP, `frame-ancestors 'none'`, HSTS, `Referrer-Policy`. Hoy `/login` es clickjackeable.

Verificación: `pnpm build` + suite e2e completa + inspección de headers en la respuesta.
Commit: `fix(auth): harden verification flow and add security headers`

---

## Fase 6 — Cierre

- [ ] Wire de `pnpm test:e2e` en `.github/workflows/ci.yml` — el comentario del workflow dice que se conecte "una vez que haya specs de flujo reales"; las Fases 1–3 los agregan, así que acá se cumple la condición.
- [ ] Marcar Fase 4 en `docs/PLAN.md` apuntando a este documento.

Commit: `ci: run e2e suite`

---

## Decisiones tomadas (2026-08-08, no volver a preguntar)

1. **Fase 4 — estrategia de sesión: revalidación de rol dentro del JWT.** No se pasa a sesiones en DB. El modelo `Session` del schema queda sin usar. Se acepta que la revocación de rol tarde hasta el intervalo de revalidación en vez de ser inmediata.
2. **Fase 5 / V11 — Redis caído: fail-closed.** Se mantiene el comportamiento actual (sin Redis no se puede loguear) y se agrega alerta explícita a Sentry. No se implementa fail-open.
3. **Fase 3 / V6b — se corta la enumeración.** Registro con email existente devuelve el mismo mensaje que un alta exitosa; el aviso le llega al dueño de la dirección por email. Se acepta el costo de UX.

## Hallazgos de la auditoría (2026-08-08)

Severidad según impacto en el flujo de auth.

| ID  | Sev   | Hallazgo                                                                 | Fase |
| --- | ----- | ------------------------------------------------------------------------ | ---- |
| V1  | Alta  | Open redirect vía `callbackUrl` con backslash                            | 1    |
| V2  | Alta  | Rate limit solo por email: password spraying libre + DoS de cuenta ajena | 1    |
| V3  | Alta  | Enumeración de usuarios por timing de bcrypt                             | 1    |
| V4  | Media | `/login` accesible con sesión activa, permite sobrescribir sesión        | 2    |
| V5  | Media | `resendVerificationAction` sin rate limit                                | 3    |
| V6  | Media | `registerAction` sin rate limit y con enumeración explícita              | 3    |
| V7  | Media | Rol congelado en el JWT, sin `maxAge`: la revocación no surte efecto     | 4    |
| V8  | Media | Email sin normalizar: cuentas duplicadas por mayúsculas                  | 0    |
| V9  | Baja  | `user!.role` puede tirar 500 + query redundante                          | 5    |
| V10 | Baja  | `/verify-email` muta en GET y no maneja P2025                            | 5    |
| V11 | Baja  | Rate limit falla cerrado hacia todos los usuarios (SPOF)                 | 5    |
| V12 | Baja  | Sin CSP, `frame-ancestors`, HSTS ni `Referrer-Policy`                    | 5    |

No se encontró bypass directo de autenticación. La base es sólida: bcrypt, verificación de email obligatoria y doble capa de autorización (`src/proxy.ts` + `requireRole()`).
