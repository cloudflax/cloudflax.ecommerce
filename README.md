# Cloudflax Ecommerce

Ecommerce platform built with Next.js. Includes a customer storefront plus dedicated areas for admin, staff, and delivery roles, with authentication and role-based access control.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Prisma 7** + PostgreSQL
- **NextAuth v5** (credentials login, email verification via Resend)
- **Redis** (caching, rate limiting)
- **Tailwind CSS 4** + shadcn/ui
- **Sentry** (error monitoring)
- **Vitest** + Playwright + Storybook

## Requirements

- Node.js >= 24
- pnpm 11
- Docker (Postgres and Redis run via docker compose)

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

   Set `NEXTAUTH_SECRET` (generate one with `openssl rand -base64 32`) and fill in `RESEND_API_KEY` and `NEXT_PUBLIC_SENTRY_DSN`.

3. Start the databases:

   ```bash
   pnpm docker:up
   ```

4. Run the migration and seed:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. Start the dev server:

   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command           | Description                       |
| ----------------- | --------------------------------- |
| `pnpm dev`        | Start the development server      |
| `pnpm build`      | Production build                  |
| `pnpm lint`       | Run ESLint                        |
| `pnpm typecheck`  | Type-check the project            |
| `pnpm test`       | Run unit tests (Vitest)           |
| `pnpm test:e2e`   | Run end-to-end tests (Playwright) |
| `pnpm db:migrate` | Apply Prisma migrations           |
| `pnpm db:seed`    | Seed the database                 |
| `pnpm db:studio`  | Open Prisma Studio                |
| `pnpm docker:up`  | Start Postgres and Redis          |
| `pnpm storybook`  | Start Storybook on port 6006      |

## Project Structure

- `src/app` — routes (App Router)
- `src/lib` — server-side utilities (Prisma client, auth, env, Redis)
- `src/components/ui` — shadcn/ui components
- `prisma/schema.prisma` — database schema
- `e2e` — Playwright tests
- `scripts` — seed and utility scripts

## Conventions

- Package manager: pnpm (pinned in `packageManager`)
- Env vars: defined in `src/lib/env.ts` with zod validation — add new vars there, in `.env.example`, and in the CI workflow
- Commits: Conventional Commits, enforced by commitlint
- Husky hooks: lint-staged on `pre-commit`, typecheck + unit tests on `pre-push`
- Error reporting goes through Sentry only (`src/instrumentation.ts`)
