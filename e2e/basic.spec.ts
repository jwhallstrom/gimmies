import { test, expect } from '@playwright/test';

test('create event and add golfer', async ({ page }) => {
  await page.goto('/');
  await page.getByText('New Event').click();
  // Opens event page after clicking Open link
  await page.getByRole('link', { name: 'Open' }).last().click();
  await page.getByRole('tab', { name: 'Setup' }).isVisible();
  // Add golfer via prompt - intercept prompt
  page.once('dialog', dialog => dialog.accept('Alice'));
  await page.getByText('Add Golfer').click();
  await expect(page.locator('input[value="Alice"]')).toBeVisible();
});
