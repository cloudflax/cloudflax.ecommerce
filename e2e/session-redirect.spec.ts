import { test } from '@playwright/test';

// V4 — with an active session, /login and /register redirect to the role's
// home instead of letting another account be logged in on top of the session.

test('authenticated user is redirected away from /login and /register', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('cliente.test@resend.dev');
  await page.getByLabel('Contraseña').fill('password');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL(/\/account/);

  await page.goto('/login');
  await page.waitForURL(/\/account/);

  await page.goto('/register');
  await page.waitForURL(/\/account/);
});
