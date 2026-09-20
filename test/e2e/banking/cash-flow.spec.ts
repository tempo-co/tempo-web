import {expect, test} from '@playwright/test';
import type {Page} from '@playwright/test';

import {VERIFIED_USER_AUTH_FILE} from '../../constants/auth.constants';

test.describe('cash-flow dashboard', () => {
  test.use({storageState: VERIFIED_USER_AUTH_FILE});

  test('renders period totals, hover values, granularity changes, and transaction drill-through', async ({
    page,
  }) => {
    await installCashFlowFixture(page);
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto('/');

    await expect(page.getByRole('heading', {name: 'Cash flow', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'month', exact: true})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('cash-flow-chart')).toBeVisible();
    await expect(page.getByTestId('cash-flow-period-detail')).toBeVisible();
    await expect(page.getByText('€120.00')).toHaveCount(3);
    await expect(page.getByText('€34.50')).toHaveCount(3);
    await expect(page.getByText('€85.50')).toHaveCount(3);

    const chartBars = page.getByTestId('cash-flow-chart').locator('.recharts-bar-rectangle');
    await chartBars
      .filter({has: page.locator('path')})
      .last()
      .hover();
    await expect(page.getByText('Money in', {exact: true}).last()).toBeVisible();
    await expect(page.getByText('€120.00').last()).toBeVisible();

    await page.getByRole('button', {name: 'Inspect transactions'}).click();
    await expect(page).toHaveURL(/\/bank-transactions(?:\?.*)?$/);
    expect(new URL(page.url()).searchParams.get('currency')).toBe('EUR');

    await page.getByRole('button', {name: 'Clear filters'}).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('currency')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.has('bookingDate')).toBe(false);

    await page.goto('/');
    await page.getByRole('button', {name: 'week', exact: true}).click();
    await expect(page.getByRole('button', {name: 'week', exact: true})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('cash-flow-period-detail')).toBeVisible();
  });

  test('keeps the chart and period table usable on a narrow viewport', async ({page}) => {
    await installCashFlowFixture(page);
    await page.setViewportSize({width: 393, height: 852});
    await page.goto('/');

    await expect(page.getByTestId('cash-flow-chart')).toBeVisible();
    await expect(page.getByTestId('cash-flow-period-detail')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      393,
    );
  });

  test('shows empty and error states from the cash-flow endpoint', async ({page}) => {
    await page.route('**/bank-transactions/cash-flow?*', async (route) => {
      if (new URL(route.request().url()).searchParams.get('from') === 'error') {
        await route.fulfill({status: 500, contentType: 'application/json', body: '{}'});
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          granularity: 'MONTH',
          from: '2026-04-01',
          to: '2026-09-30',
          series: [],
          dataQuality: {missingBookingDateCount: 0},
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', {name: 'No dated transactions yet'})).toBeVisible();

    await page.route('**/bank-transactions/cash-flow?*', async (route) => {
      await route.fulfill({status: 500, contentType: 'application/json', body: '{}'});
    });
    await page.reload();
    await expect(page.getByRole('heading', {name: 'Cash flow could not be loaded'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Try again'})).toBeVisible();
  });
});

async function installCashFlowFixture(page: Page) {
  await page.route('**/bank-transactions/cash-flow?*', async (route) => {
    const granularity = new URL(route.request().url()).searchParams.get('granularity') ?? 'month';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createCashFlowFixture(granularity)),
    });
  });
}

function createCashFlowFixture(granularity: string) {
  const monthlyBuckets = [
    ['2026-04-01', '2026-04-30'],
    ['2026-05-01', '2026-05-31'],
    ['2026-06-01', '2026-06-30'],
    ['2026-07-01', '2026-07-31'],
    ['2026-08-01', '2026-08-31'],
    ['2026-09-01', '2026-09-30'],
  ];
  const buckets =
    granularity === 'month'
      ? monthlyBuckets
      : Array.from({length: granularity === 'week' ? 12 : 3}, (_, index) => {
          const start = new Date(Date.UTC(2026, granularity === 'week' ? 6 : 0, 6));
          if (granularity === 'week') {
            start.setUTCDate(start.getUTCDate() + index * 7);
          } else {
            start.setUTCFullYear(start.getUTCFullYear() + index);
          }
          const end = new Date(start);
          if (granularity === 'week') {
            end.setUTCDate(end.getUTCDate() + 6);
          } else {
            end.setUTCFullYear(end.getUTCFullYear() + 1);
            end.setUTCDate(end.getUTCDate() - 1);
          }
          return [toDateOnly(start), toDateOnly(end)];
        });
  const bucketRows = buckets.map(([startDate, endDate]) => ({
    startDate,
    endDate,
    income: startDate === '2026-08-01' ? '120' : '0',
    expenses: startDate === '2026-08-01' ? '34.5' : '0',
    net: startDate === '2026-08-01' ? '85.5' : '0',
    transactionCount: startDate === '2026-08-01' ? 4 : 0,
    includedTransactionCount: startDate === '2026-08-01' ? 4 : 0,
    internalCount: 0,
    unknownCount: 0,
  }));

  return {
    granularity: granularity.toUpperCase(),
    from: bucketRows[0].startDate,
    to: bucketRows.at(-1)?.endDate,
    series: [
      {
        currency: 'EUR',
        buckets: bucketRows,
        totals: {
          income: '120',
          expenses: '34.5',
          net: '85.5',
          transactionCount: 4,
          includedTransactionCount: 4,
          internalCount: 0,
          unknownCount: 0,
        },
      },
    ],
    dataQuality: {missingBookingDateCount: 0},
  };
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
