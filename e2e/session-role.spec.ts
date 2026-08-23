import 'dotenv/config';
import { test } from '@playwright/test';
import { Client } from 'pg';

// V7 — a role change in the database must reach an existing session without
// re-login, within ROLE_REVALIDATE_SECONDS (the Playwright webServer overrides
// it to 2s; see the note in playwright.config.ts).
//
// The DB update uses raw pg rather than the Prisma client: the generated
// client is ESM with import.meta, which Playwright's spec transform rejects.

const EMAIL = 'repartidor.test@resend.dev';

async function setRole(email: string, role: 'CUSTOMER' | 'DELIVERY') {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`UPDATE "User" SET role = $1 WHERE email = $2`, [role, email]);
  await client.end();
}

test('role change in the database reaches the session without re-login', async ({ page }) => {
  // Own seed user (repartidor.test, DELIVERY): the other specs log in as
  // cliente.test, and with fullyParallel workers mutating a shared account
  // the suites race each other.
  try {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Contraseña').fill('password');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.waitForURL(/\/delivery/);

    // Demote DELIVERY → CUSTOMER behind the session's back.
    await setRole(EMAIL, 'CUSTOMER');

    // Next protected-page hit revalidates and the proxy bounces the session to
    // the new role's home.
    await page.waitForTimeout(2500);
    await page.goto('/delivery');
    await page.waitForURL(/\/account/);
  } finally {
    await setRole(EMAIL, 'DELIVERY');
  }
});
