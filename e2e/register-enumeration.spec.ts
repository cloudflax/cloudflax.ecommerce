import { expect, test, type Page } from '@playwright/test';

const SUCCESS_TEXT = 'Cuenta creada. Revisá tu email para verificarla antes de iniciar sesión.';

// V6b — an existing email must produce exactly the same visible result as a
// brand-new one, so registration can't be used to enumerate accounts.

async function fillRegister(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Nombre').fill('E2E Test');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Teléfono').fill('+5491100000000');
  // registerSchema: min 8 chars, one uppercase, one number, one symbol.
  await page.getByLabel('Contraseña', { exact: true }).fill('Password1!');
  await page.getByLabel('Confirmar contraseña').fill('Password1!');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
}

test('existing and new email show the same message', async ({ page }) => {
  // Existing account — the V6b path. This also sends the real
  // account-exists notice to cliente.test@resend.dev (dev-only side effect).
  await fillRegister(page, 'cliente.test@resend.dev');
  await expect(page.getByText(SUCCESS_TEXT)).toBeVisible();

  // Fresh email — the control case. Creates a throwaway row in the dev DB.
  await fillRegister(page, `e2e-register-${Date.now()}@cloudflax.test`);
  await expect(page.getByText(SUCCESS_TEXT)).toBeVisible();
});
