import {expect, test, type Page} from '@playwright/test';

import type {BankConnection} from '../../../src/features/banking/types/bank-connection';

const CONNECTION_ID = '00000000-0000-4000-8000-000000000096';

const MOCK_CONNECTION: BankConnection = {
  id: CONNECTION_ID,
  provider: 'enable-banking',
  aspspName: 'Mock Bank',
  aspspCountry: 'NL',
  status: 'AUTHORIZED',
  consentValidUntil: null,
  lastSyncedAt: null,
  lastSyncError: null,
  nextSyncAt: '2030-01-01T00:00:00.000Z',
  syncStatus: 'SUCCEEDED',
  bankAccounts: [
    {
      id: '00000000-0000-4000-8000-000000000097',
      name: 'Mock EUR account',
      details: 'Synthetic test account',
      alias: null,
      currency: 'EUR',
      cashAccountType: 'CACC',
      usage: 'PRIV',
      maskedIdentifier: '****1234',
      currentBalanceAmount: '1234.56',
      currentBalanceType: 'AVAILABLE',
      balanceUpdatedAt: null,
      isActive: true,
      latestBalances: [
        {
          name: null,
          balanceType: 'ITAV',
          amount: '1234.56',
          currency: 'EUR',
          lastChangeDateTime: '2030-01-01T10:00:00.000Z',
          referenceDate: '2030-01-01',
          observedAt: '2030-01-01T10:00:00.000Z',
          isPrimary: true,
        },
      ],
    },
    {
      id: '00000000-0000-4000-8000-000000000098',
      name: 'Mock USD account',
      details: 'Synthetic test account',
      alias: null,
      currency: 'USD',
      cashAccountType: 'CACC',
      usage: 'PRIV',
      maskedIdentifier: '****5678',
      currentBalanceAmount: '50.00',
      currentBalanceType: 'AVAILABLE',
      balanceUpdatedAt: null,
      isActive: true,
      latestBalances: [
        {
          name: null,
          balanceType: 'ITBD',
          amount: '50.00',
          currency: 'USD',
          lastChangeDateTime: '2030-01-01T10:00:00.000Z',
          referenceDate: '2030-01-01',
          observedAt: '2030-01-01T10:00:00.000Z',
          isPrimary: true,
        },
      ],
    },
  ],
};

async function mockBankingApi(page: Page) {
  await page.route('**/accounts/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({id: 'synthetic-account', isEmailVerified: true}),
    });
  });
  await page.route('**/bank-connections', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_CONNECTION]),
    });
  });
}

test.describe('bank connection balance presentation', () => {
  test('places multi-currency balances below the bank name on phones', async ({page}) => {
    await mockBankingApi(page);
    await page.setViewportSize({width: 320, height: 852});
    await page.goto('/bank-connections');

    const card = page.getByTestId(`bank-connection-${CONNECTION_ID}`);
    const title = card.getByRole('heading', {name: 'Mock Bank'});
    const balances = card.getByTestId('bank-connection-total');

    await expect(title).toBeVisible();
    await expect(balances).toBeVisible();
    await expect(balances).toContainText('1,234.56');
    await expect(balances).toContainText('50.00');

    for (const width of [320, 393]) {
      await page.setViewportSize({width, height: 852});
      await expect(balances).not.toContainText(/total/i);
      await expect(balances).toHaveAttribute('role', 'group');
      await expect(balances).toHaveAttribute(
        'aria-label',
        'Connection balances: 1234.56 EUR, 50 USD',
      );
      const [titleBox, balancesBox, cardBox] = await Promise.all([
        title.boundingBox(),
        balances.boundingBox(),
        card.boundingBox(),
      ]);
      expect(titleBox).not.toBeNull();
      expect(balancesBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(balancesBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height);
      expect(balancesBox!.x).toBeCloseTo(titleBox!.x, 0);
      expect(balancesBox!.x + balancesBox!.width).toBeLessThanOrEqual(
        cardBox!.x + cardBox!.width,
      );
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
    }

    await page.setViewportSize({width: 1440, height: 900});
    const [titleBox, balancesBox] = await Promise.all([title.boundingBox(), balances.boundingBox()]);
    expect(titleBox).not.toBeNull();
    expect(balancesBox).not.toBeNull();
    expect(balancesBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width);
    await expect(balances).not.toContainText(/total/i);
    await expect(balances).toHaveAttribute('role', 'group');
    await expect(balances).toHaveAttribute(
      'aria-label',
      'Connection balances: 1234.56 EUR, 50 USD',
    );
  });

  test('keeps a plain-language accessible name for expanded account balances', async ({page}) => {
    await mockBankingApi(page);
    await page.setViewportSize({width: 320, height: 852});
    await page.goto('/bank-connections');

    const card = page.getByTestId(`bank-connection-${CONNECTION_ID}`);
    await card.getByTestId(`connection-card-toggle-${CONNECTION_ID}`).click();

    const accountRows = card.getByTestId(`bank-accounts-${CONNECTION_ID}`);
    const accountBalances = accountRows.locator('dl');
    await expect(accountBalances).toHaveCount(2);
    await expect(accountRows).not.toContainText(/ITAV|ITBD/i);
    await expect(accountRows.locator('dt.sr-only')).toHaveText([
      'Account balance',
      'Account balance',
    ]);
    await expect(accountBalances.nth(0).locator('dd')).toContainText('1,234.56');
    await expect(accountBalances.nth(1).locator('dd')).toContainText('50.00');

    await page.setViewportSize({width: 1440, height: 900});
    await expect(accountRows).not.toContainText(/ITAV|ITBD/i);
    await expect(accountRows.locator('dt.sr-only')).toHaveText([
      'Account balance',
      'Account balance',
    ]);
    await expect(accountBalances.nth(0).locator('dd')).toContainText('1,234.56');
    await expect(accountBalances.nth(1).locator('dd')).toContainText('50.00');
  });
});
