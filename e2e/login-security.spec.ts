import { expect, test } from '@playwright/test';

// Runs against the dev database seeded by scripts/seed.ts. The lockout test
// uses a unique email so Redis state from previous runs can't make it flaky;
// the global setup clears `login:*` keys for the same reason.

test('hostile callbackUrl never leaves the origin', async ({ page }) => {
  // %2F%5Ce.com decodes to /\e.com — WHATWG URL parsing turns `\` into `/`,
  // which would make this an external redirect without the V1 check.
  await page.goto('/login?callbackUrl=%2F%5Ce.com');

  await page.getByLabel('Email').fill('cliente.test@resend.dev');
  await page.getByLabel('Contraseña').fill('password');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  await page.waitForURL(/\/account/);
  expect(new URL(page.url()).origin).toBe('http://localhost:3000');
});

test('4th failed attempt on the same email is blocked', async ({ page }) => {
  const email = `e2e-lockout-${Date.now()}@cloudflax.test`;
  await page.goto('/login');

  // Not getByRole({ name: 'Ingresar' }): the label switches to 'Ingresando...'
  // while an action is pending, which breaks the name-based locator mid-wait.
  const submit = page.locator('button[type="submit"]');

  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill('wrong-password');
    await submit.click();

    // Wait for this attempt's action to finish before touching the form
    // again. The error text alone is not enough: attempts 2–3 show the same
    // message as the previous one, so without this the loop would race ahead
    // while the action is still pending (and React 19 resets the form on
    // completion, clearing the fields mid-fill).
    await expect(submit).toBeDisabled();
    await expect(submit).toBeEnabled();

    // LOGIN_RATE_LIMIT=3: attempts 1–3 get the generic error, the 4th trips
    // the per-email bucket and shows the lockout message.
    const expected = attempt <= 3 ? 'Email o contraseña incorrectos.' : 'Demasiados intentos';
    await expect(page.getByText(expected)).toBeVisible();
  }
});
