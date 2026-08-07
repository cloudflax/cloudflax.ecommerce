@AGENTS.md

## Project conventions

- Package manager: pnpm only (`packageManager` field pins the version). Never use npm or yarn.
- Env vars: always read through `src/lib/env.ts` (`@t3-oss/env-nextjs` + zod), never `process.env` directly in app code. Adding a var means adding it to the schema there first, or the build fails.
- Structure: `src/app` — routes (App Router). `src/lib` — server-side utils (`prisma.ts`, `auth.ts`, `env.ts`). `src/components/ui` — shadcn components.
- Prisma: schema lives in `prisma/schema.prisma`. Client is generated into `src/generated/prisma` — never edit that folder by hand, it's regenerated on `postinstall`.
- Commits: Conventional Commits, enforced by commitlint on `commit-msg`. `pre-commit` runs lint-staged, `pre-push` runs typecheck + unit tests — a clean push means CI's lint/format/typecheck/test/build steps are already covered locally.
- Errors: reported to Sentry via `src/instrumentation.ts` (server/edge) and `src/instrumentation-client.ts` (browser). Don't add a separate logging/error-tracking path for app code.
