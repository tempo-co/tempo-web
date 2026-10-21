import type {Page} from '@playwright/test';

import {
  type BankTransaction,
  BankTransactionDirection,
} from '../../../src/features/banking/types/bank-transaction';
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
    continuation: null,
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

/** Synthetic source rows returned by the drill endpoint, not input to a browser-side detector. */
function payment(
  index: number,
  fields: Pick<
    BankTransaction,
    'bookingDate' | 'displayDescription' | 'amount' | 'bankAccountAlias'
  >,
): BankTransaction {
  return {
    id: `00000000-0000-4000-8000-${String(400 + index).padStart(12, '0')}`,
    transactionDate: fields.bookingDate,
    valueDate: fields.bookingDate,
    description: fields.displayDescription ?? null,
    counterpartyName: fields.displayDescription ?? null,
    currency: 'EUR',
    creditDebitIndicator: 'DBIT',
    direction: BankTransactionDirection.EXPENSE,
    transactionType: 'DIRECT_DEBIT',
    transactionStatus: 'BOOK',
    providerTransactionDescription: null,
    merchantCategoryCode: null,
    remittanceInformation: null,
    balanceAfterAmount: null,
    balanceAfterCurrency: null,
    instructedAmount: null,
    instructedCurrency: null,
    exchangeRate: null,
    exchangeRateUnitCurrency: null,
    exchangeRateType: null,
    referenceNumber: null,
    referenceNumberScheme: null,
    bankName: 'Example Bank',
    bankCountry: 'NL',
    bankAccountName: 'Example Account',
    category: 'SUBSCRIPTIONS',
    categoryStatus: 'COMPLETED',
    categorySource: 'MANUAL',
    categoryConfidence: null,
    financialEventType: null,
    financialEventSource: null,
    financialEventRuleVersion: null,
    cashFlowTreatment: 'EXPENSE',
    ...fields,
  };
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

  // The API owns consolidation and eligibility; this only verifies consumption of its DTOs.
  test(`renders consolidated histories, a separate plan and a weekly bill at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const state = await mockRecurring(page);
    const ongoingKey = 'a1'.repeat(16);
    const endedKey = 'b2'.repeat(16);
    const concurrentKey = 'c3'.repeat(16);
    const weeklyKey = 'd4'.repeat(16);
    const histories = [
      {
        entry: series({
          key: ongoingKey,
          name: 'Example Cloud',
          decision: 'CONFIRMED',
          typicalAmount: '24.00',
          latestAmount: '24.00',
          monthlyEquivalent: '24.00',
        }),
        payments: ['04', '05', '06', '07', '08', '09'].map((month, index) =>
          payment(index, {
            bookingDate: `2026-${month}-03`,
            displayDescription: index < 3 ? 'Example Cloud' : 'Example Cloud Billing',
            amount: index < 3 ? '-18.00' : '-24.00',
            bankAccountAlias: index < 3 ? 'Example Original Account' : 'Example Current Account',
          }),
        ),
      },
      {
        entry: series({
          key: endedKey,
          name: 'Example Archive',
          decision: 'CONFIRMED',
          status: 'ENDED',
          typicalAmount: '16.00',
          latestAmount: '16.00',
          monthlyEquivalent: '16.00',
          transactionCount: 4,
          firstDate: '2026-01-03',
          lastDate: '2026-04-03',
          nextExpectedDate: '2026-05-03',
        }),
        payments: ['01', '02', '03', '04'].map((month, index) =>
          payment(10 + index, {
            bookingDate: `2026-${month}-03`,
            displayDescription: index < 2 ? 'Example Archive' : 'Example Archive Billing',
            amount: '-16.00',
            bankAccountAlias: index < 2 ? 'Example Original Account' : 'Example Current Account',
          }),
        ),
      },
      {
        entry: series({
          key: concurrentKey,
          name: 'Example Cloud',
          decision: 'CONFIRMED',
          typicalAmount: '9.00',
          latestAmount: '9.00',
          monthlyEquivalent: '9.00',
          transactionCount: 3,
          firstDate: '2026-07-17',
          lastDate: '2026-09-17',
          nextExpectedDate: '2026-10-17',
        }),
        payments: ['07', '08', '09'].map((month, index) =>
          payment(20 + index, {
            bookingDate: `2026-${month}-17`,
            displayDescription: 'Example Cloud',
            amount: '-9.00',
            bankAccountAlias: 'Example Original Account',
          }),
        ),
      },
      {
        entry: series({
          key: weeklyKey,
          name: 'Example Weekly Bill',
          cadence: 'WEEKLY',
          typicalAmount: '12.00',
          latestAmount: '12.00',
          monthlyEquivalent: '52.00',
          transactionCount: 3,
          firstDate: '2026-09-01',
          lastDate: '2026-09-15',
          nextExpectedDate: '2026-09-22',
        }),
        payments: ['01', '08', '15'].map((day, index) =>
          payment(30 + index, {
            bookingDate: `2026-09-${day}`,
            displayDescription: 'Example Weekly Bill',
            amount: '-12.00',
            bankAccountAlias: 'Example Current Account',
          }),
        ),
      },
    ];
    state.expenses = histories.map(({entry}) => entry);
    const drillKeys: Array<string | null> = [];
    await page.route('**/bank-transactions?**', (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue();
      const key = new URL(route.request().url()).searchParams.get('filter[recurringSeriesKey]');
      drillKeys.push(key);
      const payments = histories.find(({entry}) => entry.key === key)?.payments ?? [];
      return fulfillJson(route, {transactions: [...payments].reverse(), total: payments.length});
    });
    await page.goto('/recurring');

    const confirmed = page.getByRole('region', {name: 'Confirmed'});
    const suggested = page.getByRole('region', {name: 'Suggested'});
    await expect(page.getByTestId('recurring-summary')).toHaveText(
      '€33.00 a month across 2 confirmed payments.',
    );
    await expect(
      suggested.getByText('New suggestions exclude ordinary grocery and shopping patterns.', {
        exact: false,
      }),
    ).toBeVisible();
    await expect(confirmed.getByRole('link', {name: 'Example Cloud, 6 payments'})).toHaveCount(1);
    await expect(confirmed.getByRole('link', {name: 'Example Cloud, 3 payments'})).toHaveCount(1);
    await expect(row(page, ongoingKey)).toContainText('€24.00');
    await expect(row(page, concurrentKey)).toContainText('€9.00');
    await expect(row(page, endedKey)).toBeHidden();
    await expect(
      suggested.getByRole('link', {name: 'Example Weekly Bill, 3 payments'}),
    ).toBeVisible();
    await expect(row(page, weeklyKey)).toContainText('Weekly');
    await expect(row(page, weeklyKey)).toContainText('€12.00');
    await expect(row(page, weeklyKey)).toContainText('≈ €52.00 a month');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', {name: 'Confirm Example Weekly Bill'}).click();
    await expect(
      confirmed.getByRole('link', {name: 'Example Weekly Bill, 3 payments'}),
    ).toBeVisible();
    await expect(page.getByTestId('recurring-summary')).toHaveText(
      '€85.00 a month across 3 confirmed payments.',
    );
    expect(state.writes).toEqual([{key: weeklyKey, decision: 'CONFIRMED'}]);

    for (const {entry, payments} of histories) {
      if (entry.status === 'ENDED') {
        await page.getByText('Ended (1)').click();
        await expect(row(page, endedKey)).toContainText('Last paid');
      }
      await row(page, entry.key)
        .getByRole('link', {name: `${entry.name}, ${payments.length} payments`, exact: true})
        .click();
      await expect(page).toHaveURL(new RegExp(`recurringSeriesKey=${entry.key}`));
      await expect.poll(() => drillKeys[drillKeys.length - 1]).toBe(entry.key);
      const transactionRows = page.getByTestId(/^bank-transaction-row-/);
      await expect(transactionRows).toHaveCount(payments.length);
      await expect
        .poll(() =>
          transactionRows.evaluateAll((rows) => rows.map((r) => r.getAttribute('data-testid'))),
        )
        .toEqual([...payments].reverse().map(({id}) => `bank-transaction-row-${id}`));
      for (const transaction of payments) {
        const transactionRow = page.getByTestId(`bank-transaction-row-${transaction.id}`);
        await expect(transactionRow).toContainText(transaction.displayDescription!);
      }
      await expectNoHorizontalOverflow(page);
      await page.goBack();
      await expect(page.getByTestId('recurring-summary')).toHaveText(
        '€85.00 a month across 3 confirmed payments.',
      );
    }
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

for (const viewport of [
  {width: 1280, height: 800},
  {width: 390, height: 844},
]) {
  test(`answers a same-payment question and undoes the answer at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const state = await mockRecurring(page);
    const previousKey = 'e5'.repeat(16);
    const currentKey = 'f6'.repeat(16);
    const previous = series({
      key: previousKey,
      name: 'Example Motion Ltd',
      status: 'ENDED',
      transactionCount: 3,
      firstDate: '2026-01-11',
      lastDate: '2026-03-11',
      typicalAmount: '24.00',
      monthlyEquivalent: '24.00',
    });
    const asked = {
      choice: null,
      previousName: 'Example Motion Ltd',
      previousFirstDate: '2026-01-11',
      previousLastDate: '2026-03-11',
    } as const;
    const current = series({
      key: currentKey,
      name: 'Example Motion Exampletown',
      transactionCount: 4,
      firstDate: '2026-07-12',
      typicalAmount: '25.00',
      monthlyEquivalent: '25.00',
      continuation: asked,
    });
    const joined = series({
      ...current,
      transactionCount: 7,
      firstDate: '2026-01-11',
      continuation: {...asked, choice: 'LINKED'},
    });
    state.expenses = [current, previous];
    const writes: Array<{key: string; choice: string | null}> = [];
    // Each answer is held until the test releases it, so its saving state can be observed.
    const held: Array<() => void> = [];
    const release = async () => {
      await expect.poll(() => held.length).toBe(1);
      held.shift()!();
    };
    await page.route('**/recurring-series/*/continuation', async (route) => {
      const parts = route.request().url().split('/');
      const key = parts[parts.length - 2];
      const {choice} = route.request().postDataJSON() as {choice: 'LINKED' | 'SEPARATE' | null};
      writes.push({key, choice});
      await new Promise<void>((resolve) => held.push(resolve));
      state.expenses =
        choice === 'LINKED'
          ? [joined]
          : choice === 'SEPARATE'
            ? [{...current, continuation: {...asked, choice}}, previous]
            : [current, previous];
      return route.fulfill({status: 204});
    });
    await page.goto('/recurring');

    const question = row(page, currentKey).getByRole('group', {name: 'Same payment?'});
    await expect(question).toContainText('Same payment as Example Motion Ltd?');
    await expect(question).toContainText('11 Jan – 11 Mar');
    await expectNoHorizontalOverflow(page);

    await question.getByRole('button', {name: 'Link with Example Motion Ltd'}).click();
    await expect(
      question.getByRole('button', {name: 'Link with Example Motion Ltd'}),
    ).toBeDisabled();
    await expect(question).toContainText('Saving…');
    await release();
    await expect(row(page, currentKey)).toContainText(
      'Includes earlier payments to Example Motion Ltd',
    );
    await expect(
      page.getByRole('link', {name: 'Example Motion Exampletown, 7 payments'}),
    ).toBeVisible();
    await expect(row(page, previousKey)).toHaveCount(0);

    await row(page, currentKey).getByRole('button', {name: 'Unlink Example Motion Ltd'}).focus();
    await page.keyboard.press('Enter');
    await release();
    await expect(question).toContainText('Same payment as Example Motion Ltd?');

    await question.getByRole('button', {name: 'Keep separate from Example Motion Ltd'}).focus();
    await page.keyboard.press('Enter');
    await release();
    await expect(row(page, currentKey)).toContainText('Kept separate from Example Motion Ltd');
    await row(page, currentKey)
      .getByRole('button', {name: 'Ask again about Example Motion Ltd'})
      .focus();
    await page.keyboard.press('Enter');
    await release();
    await expect(question).toContainText('Same payment as Example Motion Ltd?');
    await expectNoHorizontalOverflow(page);

    expect(writes).toEqual([
      {key: currentKey, choice: 'LINKED'},
      {key: currentKey, choice: null},
      {key: currentKey, choice: 'SEPARATE'},
      {key: currentKey, choice: null},
    ]);
    expect(state.writes).toEqual([]);
  });
}

test('says so when a same-payment answer could not be saved', async ({page}) => {
  const state = await mockRecurring(page);
  const key = 'f7'.repeat(16);
  state.expenses = [
    series({
      key,
      name: 'Example Renamed Plan',
      continuation: {
        choice: null,
        previousName: 'Example Plan',
        previousFirstDate: '2026-01-11',
        previousLastDate: '2026-03-11',
      },
    }),
  ];
  await page.route('**/recurring-series/*/continuation', (route) =>
    fulfillJson(route, {statusCode: 404, message: 'Recurring payment not found.'}, 404),
  );
  await page.goto('/recurring');
  await page.getByRole('button', {name: 'Link with Example Plan'}).click();
  await expect(page.getByText('Could not save. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Link with Example Plan'})).toBeEnabled();
});

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
  await page.setViewportSize({width: 390, height: 844});
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
    page.getByText('New suggestions exclude ordinary grocery and shopping patterns.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Annual subscriptions can be suggested after two payments', {exact: false}),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  fail = true;
  await page.reload();
  await expect(page.getByText('Recurring payments are unavailable right now')).toBeVisible();
  fail = false;
  await page.getByRole('button', {name: 'Try again'}).click();
  await expect(page.getByText('No recurring payments found yet')).toBeVisible();
});
