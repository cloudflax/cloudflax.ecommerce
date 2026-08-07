@AGENTS.md

## Project conventions

- Package manager: pnpm only (`packageManager` field pins the version). Never use npm or yarn.
- Env vars: always read through `src/lib/env.ts` (`@t3-oss/env-nextjs` + zod), never `process.env` directly in app code. A new var needs all three: the schema in `env.ts`, a line in `.env.example`, and an entry in the `env:` block of `.github/workflows/ci.yml` — skipping the last one passes locally but fails the CI build.
- Structure: `src/app` — routes (App Router). `src/lib` — server-side utils (`prisma.ts`, `auth.ts`, `env.ts`). `src/components/ui` — shadcn components.
- Prisma: schema lives in `prisma/schema.prisma`. Client is generated into `src/generated/prisma` — never edit that folder by hand, it's regenerated on `postinstall`.
- Commits: Conventional Commits, enforced by commitlint on `commit-msg`. `pre-commit` runs lint-staged, `pre-push` runs typecheck + unit tests — a clean push means CI's lint/format/typecheck/test/build steps are already covered locally.
- Errors: reported to Sentry via `src/instrumentation.ts` (server/edge) and `src/instrumentation-client.ts` (browser). Don't add a separate logging/error-tracking path for app code.
- Redis: shared client is `src/lib/redis.ts`, rate limiting is `src/lib/rate-limit.ts` (used by the credentials login flow). Reuse both for any new caching/throttling need instead of creating another client.
