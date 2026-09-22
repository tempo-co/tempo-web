import {expect, test} from '@playwright/test';

import {VERIFIED_USER_AUTH_FILE} from '../../constants/auth.constants';

const DETAIL_TRANSACTION_ID = '00000000-0000-4000-8000-000000000011';
const BANK_ACCOUNT_ID = '00000000-0000-4000-8000-000000000021';
const RULE_ID = '00000000-0000-4000-8000-000000000031';

const rule = {
  id: RULE_ID,
  bankAccountId: BANK_ACCOUNT_ID,
  name: 'Coffee shop rule',
  category: 'FOOD_AND_DRINK',
  active: true,
  direction: 'EXPENSE',
  transactionType: 'CARD',
  currency: 'EUR',
  amount: '100.50',
  matchField: 'BANK_TRANSACTION_DESCRIPTION',
  matchText: 'Coffee shop',
  createdAt: '2026-08-26T10:00:00.000Z',
  updatedAt: '2026-08-26T10:00:00.000Z',
};

function asManualTransaction(transaction: Record<string, unknown>) {
  return {
    ...transaction,
    id: DETAIL_TRANSACTION_ID,
    category: 'FOOD_AND_DRINK',
    categoryStatus: 'COMPLETED',
    categorySource: 'MANUAL',
    categoryRuleId: null,
    categoryRuleName: null,
    providerTransactionDescription: 'Coffee shop',
    remittanceInformation: null,
  };
}

test.describe('bank transaction rules', () => {
  test.use({storageState: VERIFIED_USER_AUTH_FILE});

  test('previews and saves a rule from a manually categorized transaction', async ({page}) => {
    let manualTransaction: Record<string, unknown> | undefined;

    await page.route('**/bank-transactions?*', async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        transactions: Array<Record<string, unknown>>;
        total: number;
      };
      manualTransaction ??= asManualTransaction(payload.transactions[0]);
      await route.fulfill({
        response,
        json: {
          ...payload,
          transactions: payload.transactions.map((transaction) =>
            transaction.id === DETAIL_TRANSACTION_ID ? manualTransaction : transaction,
          ),
        },
      });
    });

    await page.route(`**/bank-transactions/${DETAIL_TRANSACTION_ID}`, async (route) => {
      if (!manualTransaction) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(manualTransaction),
      });
    });

    await page.route('**/bank-transaction-rules/preview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bankAccountId: BANK_ACCOUNT_ID,
          direction: 'EXPENSE',
          transactionType: 'CARD',
          currency: 'EUR',
          amount: '100.50',
          matchField: 'BANK_TRANSACTION_DESCRIPTION',
          matchText: 'Coffee shop',
          totalMatches: 2,
          existingManualMatches: 1,
          existingEligibleMatches: 1,
          conflictingRuleNames: [],
          matches: [
            {
              id: DETAIL_TRANSACTION_ID,
              bookingDate: '2026-08-26',
              amount: '-100.50',
              currency: 'EUR',
              displayDescription: 'Coffee shop',
              category: 'FOOD_AND_DRINK',
              categorySource: 'MANUAL',
              isManual: true,
            },
          ],
        }),
      });
    });

    await page.route('**/bank-transaction-rules', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({rule, appliedToTransactionIds: [DETAIL_TRANSACTION_ID]}),
      });
    });

    await page.goto('/bank-transactions');
    const row = page
      .getByTestId(/^bank-transaction-row-/)
      .filter({hasText: 'Coffee shop'})
      .first();
    await row.click({position: {x: 8, y: 8}});

    const inspector = page.getByTestId('bank-transaction-inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole('button', {name: 'Create rule'})).toBeVisible();
    await inspector.getByRole('button', {name: 'Create rule'}).click();

    await expect(page.getByRole('dialog', {name: 'Create a transaction rule'})).toBeVisible();
    await page.getByLabel('Rule name').fill('Coffee shop rule');
    await page.getByRole('button', {name: 'Preview matches'}).click();
    await expect(page.getByTestId('bank-transaction-rule-preview')).toContainText(
      'This rule matches 2 existing transactions',
    );
    await expect(page.getByTestId('bank-transaction-rule-preview')).toContainText(
      '1 are eligible to update; 1 manual categorization will remain unchanged',
    );

    await page.getByText('Apply to existing non-manual matches', {exact: false}).click();
    const createRequest = page.waitForRequest(
      (request) => request.url().endsWith('/bank-transaction-rules') && request.method() === 'POST',
    );
    await page.getByRole('button', {name: 'Save rule'}).click();
    const request = await createRequest;
    expect(JSON.parse(request.postData() ?? '{}')).toMatchObject({
      name: 'Coffee shop rule',
      applyToExisting: true,
      matchText: 'Coffee shop',
    });
    await expect(page.getByRole('dialog', {name: 'Create a transaction rule'})).toBeHidden();
  });

  test('lists and disables rules in settings', async ({page}) => {
    let disabled = false;
    await page.route('**/bank-transaction-rules/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      disabled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({...rule, active: false}),
      });
    });
    await page.route('**/bank-transaction-rules', async (route) => {
      if (route.request().method() === 'DELETE') {
        disabled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({...rule, active: false}),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([disabled ? {...rule, active: false} : rule]),
      });
    });

    await page.goto('/settings/rules');
    const card = page.getByTestId('bank-transaction-rule-card');
    await expect(card).toContainText('Coffee shop rule');
    await expect(card).toContainText('Outgoing CARD from the current account, exactly EUR 100.50.');
    await expect(card).toContainText('Bank description contains “Coffee shop”');
    await card.getByRole('button', {name: 'Disable rule'}).click();
    await expect(page.getByText('Rule “Coffee shop rule” disabled.')).toBeVisible();
  });
});
