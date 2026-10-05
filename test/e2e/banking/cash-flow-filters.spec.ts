import {
  type BankTransaction,
  BankTransactionDirection,
} from '@/features/banking/types/bank-transaction';

import {VERIFIED_USER_AUTH_FILE} from '../../constants/auth.constants';
import {API_URL, expect, test} from '../../fixtures';

test.use({storageState: VERIFIED_USER_AUTH_FILE});

for (const [value, label] of [
  ['SPENDING', 'Spending'],
  ['INCOME', 'Income'],
  ['INTERNAL', 'Internal movements'],
  ['CURRENCY_EXCHANGE', 'Currency exchange'],
  ['OWN_TRANSFER', 'Own transfer'],
  ['UNKNOWN', 'Unknown direction'],
]) {
  test(`cash flow ${label} is selectable and renders real filtered results`, async ({page}) => {
    await page.goto('/bank-transactions');
    await page.getByRole('button', {name: 'Cash flow', exact: true}).click();
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes(`filter%5BcashFlows%5D%5B%5D=${value}`),
    );
    await page.getByRole('option', {name: label, exact: true}).click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const list = (await response.json()) as {total: number; transactions: BankTransaction[]};
    expect(JSON.parse(new URL(page.url()).searchParams.get('cashFlows')!)).toEqual([value]);
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', {name: `Cash flow: ${label}`, exact: true}),
    ).toBeVisible();
    if (list.total === 0) {
      await expect(
        page.getByText('The applied filters did not match any transactions.'),
      ).toBeVisible();
    } else {
      for (const row of list.transactions) {
        await expect(page.getByTestId(`bank-transaction-row-${row.id}`)).toBeVisible();
        if (value === 'SPENDING' || value === 'INCOME' || value === 'UNKNOWN') {
          expect(row.financialEventType).not.toBe('CURRENCY_EXCHANGE');
          expect(row.ownTransfer).toBeNull();
        }
        if (value === 'SPENDING') {
          expect(
            row.direction === BankTransactionDirection.EXPENSE ||
              (row.direction === BankTransactionDirection.INCOME && row.category === 'REFUND'),
          ).toBe(true);
        }
        if (value === 'CURRENCY_EXCHANGE') expect(row.financialEventType).toBe('CURRENCY_EXCHANGE');
        if (value === 'OWN_TRANSFER') expect(row.ownTransfer).not.toBeNull();
        if (value === 'INCOME') {
          expect(row.direction).toBe(BankTransactionDirection.INCOME);
          expect(row.category).not.toBe('REFUND');
        }
      }
    }
  });
}

test('mobile pickers share combined drills, preserve category status and clear all', async ({
  page,
}) => {
  await page.setViewportSize({width: 390, height: 844});
  const params = new URLSearchParams({
    cashFlows: JSON.stringify(['SPENDING', 'INCOME', 'UNKNOWN']),
    baseAmount: 'MISSING',
    categoryStatuses: JSON.stringify(['FAILED']),
    pageIndex: '2',
  });
  await page.goto(`/bank-transactions?${params}`);
  await expect(page.getByRole('button', {name: 'Remove filter: Not categorized'})).toBeVisible();
  await page.getByTestId('bank-transaction-mobile-filters-trigger').click();
  const drawer = page.getByTestId('bank-transaction-mobile-filters');
  await expect(drawer.getByRole('heading', {name: 'Cash flow'})).toBeVisible();
  const cashFlow = drawer
    .locator('section')
    .filter({has: page.getByRole('heading', {name: 'Cash flow', exact: true})});
  for (const label of ['Spending', 'Income', 'Unknown direction']) {
    await expect(cashFlow.getByRole('option', {name: label, exact: true})).toHaveAttribute(
      'data-filter-selected',
      'true',
    );
  }
  await drawer.getByRole('option', {name: 'Internal movements', exact: true}).click();
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('pageIndex') ?? 0)).toBe(0);
  await expect(
    drawer.getByRole('option', {name: 'Not available yet', exact: true}),
  ).toHaveAttribute('data-filter-selected', 'true');
  await drawer.getByRole('option', {name: 'Available', exact: true}).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('baseAmount')).toBe('PRESENT');
  expect(JSON.parse(new URL(page.url()).searchParams.get('categoryStatuses')!)).toEqual(['FAILED']);
  await drawer.getByRole('button', {name: 'Clear all', exact: true}).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('cashFlows')).toBe(false);
  expect(new URL(page.url()).searchParams.has('baseAmount')).toBe(false);
  expect(new URL(page.url()).searchParams.has('categoryStatuses')).toBe(false);
  await drawer.getByRole('button', {name: 'Done', exact: true}).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('amount availability picker shares direct URL filters and clears combinations', async ({
  page,
}) => {
  const params = new URLSearchParams({
    cashFlows: JSON.stringify(['INCOME']),
    baseAmount: 'PRESENT',
    pageIndex: '2',
  });
  await page.goto(`/bank-transactions?${params}`);
  await expect(page.getByRole('button', {name: 'Cash flow: Income', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Amount in EUR: Available', exact: true}).click();
  await expect(page.getByRole('option', {name: 'Available', exact: true})).toHaveAttribute(
    'data-filter-selected',
    'true',
  );
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('filter%5BbaseAmount%5D=MISSING'),
  );
  await page.getByRole('option', {name: 'Not available yet', exact: true}).click();
  expect((await responsePromise).ok()).toBe(true);
  await expect(
    page.getByRole('button', {name: 'Amount in EUR: Not available yet', exact: true}),
  ).toBeVisible();
  let search = new URL(page.url()).searchParams;
  expect(search.get('baseAmount')).toBe('MISSING');
  expect(JSON.parse(search.get('cashFlows')!)).toEqual(['INCOME']);
  expect(Number(search.get('pageIndex') ?? 0)).toBe(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'Clear filters', exact: true}).first().click();
  await expect(page.getByRole('button', {name: 'Amount in EUR', exact: true})).toBeVisible();
  search = new URL(page.url()).searchParams;
  expect(search.has('baseAmount')).toBe(false);
  expect(search.has('cashFlows')).toBe(false);
});

test('cash flow picker applies the real spending predicate and resets pagination', async ({
  page,
}) => {
  await page.goto('/bank-transactions?pageIndex=2');
  await page.getByRole('button', {name: 'Cash flow', exact: true}).click();
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('filter%5BcashFlows%5D%5B%5D=SPENDING'),
  );
  await page.getByRole('option', {name: 'Spending', exact: true}).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const list: unknown = await response.json();
  const expected = await page.request.get(
    `${API_URL}/bank-transactions?filter[cashFlows][]=SPENDING&pagination[pageIndex]=0&pagination[pageSize]=10`,
  );
  expect(expected.ok()).toBe(true);
  expect(list).toEqual(await expected.json());
  await expect(page).toHaveURL(/cashFlows/);
  const search = new URL(page.url()).searchParams;
  expect(JSON.parse(search.get('cashFlows')!)).toEqual(['SPENDING']);
  expect(Number(search.get('pageIndex') ?? 0)).toBe(0);
  await expect(page.getByRole('option', {name: 'Spending', exact: true})).toHaveAttribute(
    'data-filter-selected',
    'true',
  );
  await page.getByRole('option', {name: 'Reset', exact: true}).click();
  await expect(page).not.toHaveURL(/cashFlows/);
});
