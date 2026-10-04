import type {BankTransactionSummary} from '@/features/dashboard/types/bank-transaction-summary';

import {VERIFIED_USER_AUTH_FILE} from '../../constants/auth.constants';
import {API_URL, expect, test} from '../../fixtures';

test.use({storageState: VERIFIED_USER_AUTH_FILE});

test('real category count and amount reconcile with its transaction drill', async ({page}) => {
  const response = await page.request.get(
    `${API_URL}/bank-transactions/summary?month=2026-08&asOf=2026-10-04`,
  );
  expect(response.ok()).toBe(true);
  const summary = (await response.json()) as BankTransactionSummary;
  const category = summary.categories.find(
    (row: {category: string}) => row.category === 'UNCATEGORIZED',
  );
  if (!category) throw new Error('Missing seeded uncategorized spending');
  expect(category.count).toBeGreaterThan(0);
  const spendingCents = Math.round(Number(category.spending) * 100);
  expect(spendingCents).toBeGreaterThan(0);
  await page.goto('/?month=2026-08');
  const row = page.getByTestId('category-breakdown').getByRole('link', {name: /Uncategorized/});
  await expect(row).toContainText(
    new Intl.NumberFormat(undefined, {style: 'currency', currency: summary.baseCurrency!}).format(
      Number(category.spending),
    ),
  );
  await expect(row).toContainText(`${category.count} transactions`);
  await row.click();
  const search = new URL(page.url()).searchParams;
  expect(JSON.parse(search.get('categories')!)).toEqual(['UNCATEGORIZED']);
  expect(search.get('baseAmount')).toBe('PRESENT');
  const params = new URLSearchParams({
    'filter[bookingDate][from]': '2026-08-01',
    'filter[bookingDate][to]': '2026-08-31',
    'filter[categories][]': 'UNCATEGORIZED',
    'filter[cashFlows][]': 'SPENDING',
    'filter[baseAmount]': 'PRESENT',
    'pagination[pageSize]': '100',
  });
  const listResponse = await page.request.get(`${API_URL}/bank-transactions?${params}`);
  expect(listResponse.ok()).toBe(true);
  const list = (await listResponse.json()) as {
    total: number;
    transactions: {amountInBaseCurrency: string | null}[];
  };
  expect(list.total).toBe(category.count);
  expect(
    list.transactions.reduce(
      (sum, row) => sum - Math.round(Number(row.amountInBaseCurrency) * 100),
      0,
    ),
  ).toBe(spendingCents);
  await expect(page.getByText(`${category.count} transactions`, {exact: true})).toBeVisible();
});
