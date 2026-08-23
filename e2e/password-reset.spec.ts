import 'dotenv/config';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { expect, test } from '@playwright/test';
import { Client } from 'pg';

// Each test owns a fresh user (unique email) — fullyParallel workers must not
// share accounts. The DB reads/writes use raw pg like session-role.spec.ts:
// the generated Prisma client is ESM with import.meta, which Playwright's
// spec transform rejects.
//
// Resend only delivers to verified addresses in dev, so the outgoing email
// itself is untested here; the specs assert on the PasswordResetToken row and
// drive the reset through a token they inserted directly.

const OLD_PASSWORD = 'Vieja1234!';
const NEW_PASSWORD = 'Nueva1234!';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function createUser(email: string, password: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO "User" (id, email, "emailVerified", password, role, "createdAt", "updatedAt")
       VALUES ($1, $2, now(), $3, 'CUSTOMER', now(), now())`,
      [email, email, await bcrypt.hash(password, 12)],
    );
  });
}

async function deleteUser(email: string): Promise<void> {
  await withClient(async (client) => {
    // The token row has no FK to User, so it must go explicitly.
    await client.query(`DELETE FROM "PasswordResetToken" WHERE identifier = $1`, [email]);
    await client.query(`DELETE FROM "User" WHERE email = $1`, [email]);
  });
}

async function insertResetToken(email: string, rawToken: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO "PasswordResetToken" (identifier, "tokenHash", expires, "createdAt")
       VALUES ($1, $2, now() + interval '1 hour', now())`,
      [email, sha256(rawToken)],
    );
  });
}

async function countResetTokens(email: string): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT count(*)::int AS count FROM "PasswordResetToken" WHERE identifier = $1`,
      [email],
    );
    return rows[0].count;
  });
}

test('request with a registered email shows the generic message and creates a token row', async ({
  page,
}) => {
  const email = `e2e-reset-${Date.now()}@cloudflax.test`;
  await createUser(email, OLD_PASSWORD);

  try {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Enviar link de recuperación' }).click();

    await expect(page.getByText('Si existe una cuenta para ese email')).toBeVisible();
    expect(await countResetTokens(email)).toBe(1);
  } finally {
    await deleteUser(email);
  }
});

test('request with an unknown email shows the same message and creates nothing', async ({
  page,
}) => {
  const email = `e2e-no-such-${Date.now()}@cloudflax.test`;

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Enviar link de recuperación' }).click();

  await expect(page.getByText('Si existe una cuenta para ese email')).toBeVisible();
  expect(await countResetTokens(email)).toBe(0);
});

test('full flow: reset link sets a new password that logs in', async ({ page }) => {
  const email = `e2e-reset-flow-${Date.now()}@cloudflax.test`;
  // tokenHash is globally unique, and the specs run fullyParallel — each test
  // needs its own raw token.
  const token = `e2e-token-flow-${Date.now()}`;
  await createUser(email, OLD_PASSWORD);
  await insertResetToken(email, token);

  try {
    await page.goto(`/reset-password?token=${token}`);
    await expect(page.getByText('Elegí una contraseña nueva')).toBeVisible();

    await page.getByLabel('Contraseña nueva').fill(NEW_PASSWORD);
    await page.getByLabel('Repetí la contraseña').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await page.waitForURL(/\/login\?reset=1/);
    await expect(page.getByText('Contraseña actualizada.')).toBeVisible();

    // Old password is dead.
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill(OLD_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();

    // New password works. React 19 resets uncontrolled fields after a form
    // action, so both fields must be filled again.
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.waitForURL(/\/account/);
  } finally {
    await deleteUser(email);
  }
});

test('the link is single-use: a second visit shows the invalid page', async ({ page }) => {
  const email = `e2e-reset-reuse-${Date.now()}@cloudflax.test`;
  const token = `e2e-token-reuse-${Date.now()}`;
  await createUser(email, OLD_PASSWORD);
  await insertResetToken(email, token);

  try {
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel('Contraseña nueva').fill(NEW_PASSWORD);
    await page.getByLabel('Repetí la contraseña').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await page.waitForURL(/\/login/);

    await page.goto(`/reset-password?token=${token}`);
    await expect(page.getByText('Link inválido')).toBeVisible();
  } finally {
    await deleteUser(email);
  }
});

test('a password reset kills an existing session', async ({ page, browser }) => {
  const email = `e2e-reset-session-${Date.now()}@cloudflax.test`;
  const token = `e2e-token-session-${Date.now()}`;
  await createUser(email, OLD_PASSWORD);

  // Two contexts on purpose: /reset-password bounces logged-in users home, so
  // the reset must run in a separate, anonymous context while the session
  // under test stays open in its own.
  const sessionContext = await browser.newContext();
  const sessionPage = await sessionContext.newPage();

  try {
    await sessionPage.goto('/login');
    await sessionPage.getByLabel('Email').fill(email);
    await sessionPage.getByLabel('Contraseña').fill(OLD_PASSWORD);
    await sessionPage.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await sessionPage.waitForURL(/\/account/);

    await insertResetToken(email, token);
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel('Contraseña nueva').fill(NEW_PASSWORD);
    await page.getByLabel('Repetí la contraseña').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await page.waitForURL(/\/login/);

    // V12 propagates on the next jwt revalidation (2s in e2e, see
    // playwright.config.ts) — afterwards the old session must bounce.
    await sessionPage.waitForTimeout(2500);
    await sessionPage.goto('/account');
    await sessionPage.waitForURL(/\/login/);
  } finally {
    await sessionContext.close();
    await deleteUser(email);
  }
});
