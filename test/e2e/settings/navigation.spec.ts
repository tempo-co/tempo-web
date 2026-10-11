import {expect, test} from '@playwright/test';
import {VERIFIED_USER_AUTH_FILE} from 'test/constants/auth.constants';

test.use({storageState: VERIFIED_USER_AUTH_FILE});

test.describe('Settings navigation', () => {
  test('keeps the section navigation aligned with the active page', async ({page}) => {
    const routes = [
      {path: 'account', label: 'Account'},
      {path: 'security', label: 'Security'},
      {path: 'appearance', label: 'Appearance'},
    ];

    for (const route of routes) {
      await page.goto(`/settings/${route.path}`);
      await expect(page.getByRole('heading', {level: 1})).toBeVisible();

      const activeSectionLinks = page.locator(
        'nav[aria-label="Settings sections"] a[aria-current="page"]',
      );
      await expect(activeSectionLinks).toHaveCount(2);
      await expect(activeSectionLinks.first()).toHaveAttribute('href', `/settings/${route.path}`);
      await expect(activeSectionLinks.last()).toHaveAttribute('href', `/settings/${route.path}`);
    }
  });
});
