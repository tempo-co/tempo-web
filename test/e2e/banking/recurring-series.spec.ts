import type {Page} from '@playwright/test';

import type {
  RecurringSeries,
  RecurringSeriesList,
} from '../../../src/features/banking/types/recurring-series';
import {expect, test} from '../../fixtures';
import {fulfillJson, mockBankConnections, mockJson} from '../../utils/api-mocks';
import {expectNoHorizontalOverflow} from '../../utils/layout';

// Every API call is mocked, so no seeded session is needed.
test.use({storageState: {cookies: [], origins: []}, timezoneId: 'Europe/Amsterdam'});

const GYM_KEY = 'a'.repeat(32);
const STREAMING_KEY = 'b'.repeat(32);
const ENERGY_KEY = 'c'.repeat(32);
const OLD_KEY = 'd'.repeat(32);
const SALARY_KEY = 'e'.repeat(32);

function series(overrides: Partial<RecurringSeries> & Pick<RecurringSeries, 'key' | 'name'>) {
  return {
    direction: 'EXPENSE',
    cadence: 'MONTHLY',
    amountKind: 'FIXED',
    currency: 'EUR',
    typicalAmount: '30.00',
    latestAmount: '30.00',
    monthlyEquivalent: '30.00',
    transactionCount: 6,
    firstDate: '2026-04-03',
    lastDate: '2026-09-03',
    nextExpectedDate: '2026-10-03',
    status: 'ACTIVE',
    flags: [],
    decision: null,
    ...overrides,
  } satisfies RecurringSeries;
}

/** Synthetic series behind a fake API that applies decisions the way the real one does. */
async function mockRecurring(page: Page) {
  const state = {
    expenses: [
      series({key: GYM_KEY, name: 'Example Gym', decision: 'CONFIRMED'}),
      series({
        key: STREAMING_KEY,
        name: 'Example Streaming',
        typicalAmount: '12.99',
        latestAmount: '14.99',
        monthlyEquivalent: '12.99',
        flags: ['PRICE_INCREASED'],
      }),
      series({
        key: ENERGY_KEY,
        name: 'Example Energy',
        amountKind: 'VARIABLE',
        typicalAmount: '85.00',
        monthlyEquivalent: '85.00',
        flags: ['LATE'],
      }),
      series({
        key: OLD_KEY,
        name: 'Example Old Plan',
        status: 'ENDED',
        lastDate: '2026-03-03',
      }),
    ] as RecurringSeries[],
    income: [
      series({
        key: SALARY_KEY,
        name: 'Example Employer',
        direction: 'INCOME',
        typicalAmount: '2500.00',
        monthlyEquivalent: '2500.00',
      }),
    ] as RecurringSeries[],
    writes: [] as Array<{key: string; decision: RecurringSeries['decision']}>,
    incomeRequests: 0,
  };
  await mockJson(page, '**/accounts/me', {
    id: '00000000-0000-4000-8000-000000000300',
    name: 'Alex Example',
    email: 'user@example.com',
    isEmailVerified: true,
  });
  await mockBankConnections(page, () => []);
  await page.route('**/recurring-series?**', (route) => {
    const url = new URL(route.request().url());
    const income = url.searchParams.get('direction') === 'INCOME';
    if (income) state.incomeRequests += 1;
    const list = income ? state.income : state.expenses;
    const confirmed = list.filter((s) => s.decision === 'CONFIRMED' && s.status === 'ACTIVE');
    const total = confirmed.reduce((sum, s) => sum + Number(s.monthlyEquivalent), 0);
    return fulfillJson(route, {
      series: list,
      confirmedMonthlyTotal: total.toFixed(2),
      unconvertedConfirmedCount: 0,
      baseCurrency: 'EUR',
    } satisfies RecurringSeriesList);
  });
  await page.route('**/recurring-series/*/decision', (route) => {
    const parts = route.request().url().split('/');
    const key = parts[parts.length - 2];
    const {decision} = route.request().postDataJSON() as {decision: RecurringSeries['decision']};
    state.writes.push({key, decision});
    state.expenses = state.expenses.map((s) => (s.key === key ? {...s, decision} : s));
    return route.fulfill({status: 204});
  });
  return state;
}

const row = (page: Page, key: string) => page.getByTestId(`recurring-series-${key}`);

/** Uses the keyboard, which works while a toast covers the bottom of a phone screen. */
async function press(page: Page, name: string) {
  await page.getByText(name, {exact: true}).focus();
  await page.keyboard.press('Enter');
}

for (const viewport of [
  {width: 1280, height: 800},
  {width: 390, height: 844},
]) {
  test(`groups recurring payments and records decisions at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    const state = await mockRecurring(page);
    await page.goto('/recurring');

    await expect(page.getByRole('heading', {name: 'Recurring', level: 1})).toBeVisible();
    await expect(page.getByTestId('recurring-summary')).toContainText('€30.00');
    await expect(page.getByTestId('recurring-summary')).toContainText('1 confirmed payment');

    const confirmed = page.getByRole('region', {name: 'Confirmed'});
    const suggested = page.getByRole('region', {name: 'Suggested'});
    await expect(confirmed.getByText('Example Gym')).toBeVisible();
    await expect(suggested.getByText('Example Streaming')).toBeVisible();
    await expect(row(page, STREAMING_KEY)).toContainText('Price went up to €14.99');
    await expect(row(page, ENERGY_KEY)).toContainText('Variable amount');
    await expect(row(page, ENERGY_KEY)).toContainText('~€85.00');
    await expect(row(page, ENERGY_KEY)).toContainText('Late');
    // Ended series stay folded away until asked for.
    await expect(row(page, OLD_KEY)).toBeHidden();
    await page.getByText('Ended (1)').click();
    await expect(row(page, OLD_KEY)).toContainText('Last paid');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', {name: 'Confirm Example Streaming'}).click();
    await expect(page.getByText('Confirmed as recurring.')).toBeVisible();
    await expect(confirmed.getByText('Example Streaming')).toBeVisible();
    await expect(page.getByTestId('recurring-summary')).toContainText('€42.99');
    await page.getByRole('button', {name: 'Dismiss Example Energy'}).focus();
    await page.keyboard.press('Enter');
    await expect(suggested.getByText('No new suggestions.')).toBeVisible();
    await press(page, 'Dismissed (1)');
    await page.getByRole('button', {name: 'Undo dismiss for Example Energy'}).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Back to suggested.')).toBeVisible();
    await expect(suggested.getByText('Example Energy')).toBeVisible();

    expect(state.writes).toEqual([
      {key: STREAMING_KEY, decision: 'CONFIRMED'},
      {key: ENERGY_KEY, decision: 'DISMISSED'},
      {key: ENERGY_KEY, decision: null},
    ]);
  });
}

for (const wakeAfterMidnight of [false, true]) {
  test(`refreshes the local date and stops counting an ended payment ${wakeAfterMidnight ? 'when waking next day' : 'after midnight'}`, async ({
    page,
  }) => {
    await page.clock.install({time: new Date('2026-06-18T21:59:50Z')});
    await mockRecurring(page);
    const dates: string[] = [];
    await page.route('**/recurring-series?**', (route) => {
      const asOf = new URL(route.request().url()).searchParams.get('asOf')!;
      dates.push(asOf);
      const ended = asOf >= '2026-06-19';
      return fulfillJson(route, {
        series: [
          series({
            key: GYM_KEY,
            name: 'Example Gym',
            decision: 'CONFIRMED',
            status: ended ? 'ENDED' : 'ACTIVE',
            nextExpectedDate: '2026-06-13',
            flags: ended ? [] : ['LATE'],
          }),
        ],
        confirmedMonthlyTotal: ended ? '0.00' : '30.00',
        unconvertedConfirmedCount: 0,
        baseCurrency: 'EUR',
      } satisfies RecurringSeriesList);
    });
    await page.goto('/recurring');
    await expect(
      page.getByRole('region', {name: 'Confirmed'}).getByText('Example Gym'),
    ).toBeVisible();
    await expect(page.getByTestId('recurring-summary')).toContainText('€30.00');

    if (wakeAfterMidnight) {
      await page.clock.setSystemTime(new Date('2026-06-18T22:00:05Z'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    } else {
      await page.clock.fastForward(15_000);
    }
    await expect.poll(() => dates[dates.length - 1]).toBe('2026-06-19');
    await expect(
      page.getByRole('region', {name: 'Confirmed'}).getByText('Example Gym'),
    ).toHaveCount(0);
    await expect(page.getByTestId('recurring-summary')).toContainText('Only confirmed ones');
    await page.getByText('Ended (1)').click();
    await expect(row(page, GYM_KEY)).toContainText('Last paid');
  });
}

test('loads recurring income only when its section is opened', async ({page}) => {
  const state = await mockRecurring(page);
  await page.goto('/recurring');
  await expect(row(page, GYM_KEY)).toBeVisible();
  expect(state.incomeRequests).toBe(0);

  await page.getByText('Recurring income').click();
  await expect(row(page, SALARY_KEY)).toContainText('Example Employer');
  expect(state.incomeRequests).toBe(1);
});

test('opens a series as a removable filter on the transactions list', async ({page}) => {
  await mockRecurring(page);
  const listRequests: URL[] = [];
  const lastSeriesFilter = () =>
    listRequests[listRequests.length - 1]?.searchParams.get('filter[recurringSeriesKey]');
  await page.route('**/bank-transactions?**', (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue();
    listRequests.push(new URL(route.request().url()));
    return fulfillJson(route, {transactions: [], total: 0});
  });
  await page.goto('/recurring');

  await page.getByRole('link', {name: 'Example Gym, 6 payments'}).click();
  await expect(page).toHaveURL(new RegExp(`recurringSeriesKey=${GYM_KEY}`));
  await expect.poll(lastSeriesFilter).toBe(GYM_KEY);

  await page.getByRole('button', {name: 'Remove filter: One recurring payment'}).click();
  await expect(page).not.toHaveURL(/recurringSeriesKey/);
  await expect.poll(lastSeriesFilter).toBeNull();
});

test('lets a drill be cleared when its series is no longer found', async ({page}) => {
  await mockRecurring(page);
  await page.route('**/bank-transactions?**', (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue();
    const url = new URL(route.request().url());
    // A correction moved a payment out, so the series is gone; a rate limit keeps the test from waiting out retries.
    return url.searchParams.get('filter[recurringSeriesKey]')
      ? fulfillJson(route, {statusCode: 429, message: 'ThrottlerException: Too Many Requests'}, 429)
      : fulfillJson(route, {transactions: [], total: 0});
  });
  await page.goto(`/bank-transactions?recurringSeriesKey=${GYM_KEY}`);
  await expect(page.getByText('Could not load bank transactions')).toBeVisible();

  await page.getByRole('button', {name: 'Clear filters'}).click();
  await expect(page).not.toHaveURL(/recurringSeriesKey/);
  await expect(page.getByText('Could not load bank transactions')).toBeHidden();
});

test('says so when nothing recurring is found and when loading fails', async ({page}) => {
  await mockJson(page, '**/accounts/me', {
    id: '00000000-0000-4000-8000-000000000301',
    name: 'Alex Example',
    email: 'user@example.com',
    isEmailVerified: true,
  });
  await mockBankConnections(page, () => []);
  let fail = false;
  // A rate limit is final, so the page shows the error without waiting out the retries.
  await page.route('**/recurring-series?**', (route) =>
    fail
      ? fulfillJson(route, {statusCode: 429, message: 'ThrottlerException: Too Many Requests'}, 429)
      : fulfillJson(route, {
          series: [],
          confirmedMonthlyTotal: '0.00',
          unconvertedConfirmedCount: 0,
          baseCurrency: 'EUR',
        }),
  );
  await page.goto('/recurring');
  await expect(page.getByText('No recurring payments found yet')).toBeVisible();
  await expect(
    page.getByText('Annual subscriptions can be suggested after two payments', {exact: false}),
  ).toBeVisible();

  fail = true;
  await page.reload();
  await expect(page.getByText('Recurring payments are unavailable right now')).toBeVisible();
  fail = false;
  await page.getByRole('button', {name: 'Try again'}).click();
  await expect(page.getByText('No recurring payments found yet')).toBeVisible();
});
