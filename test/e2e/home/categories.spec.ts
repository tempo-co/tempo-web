import {VERIFIED_USER_AUTH_FILE} from '../../constants/auth.constants';
import {SEEDED_TRANSACTION_YEAR_NOW} from '../../constants/seed.constants';
import {categorySummary} from '../../data/home-categories.data';
import {expect, test} from '../../fixtures';
import {mockJson} from '../../utils/api-mocks';
import {expectNoHorizontalOverflow} from '../../utils/layout';

test.use({storageState: VERIFIED_USER_AUTH_FILE});
test.beforeEach(async ({page}) => {
  await page.clock.setFixedTime(SEEDED_TRANSACTION_YEAR_NOW);
  await mockJson(page, '**/bank-transactions/summary**', categorySummary);
});

test('groups fixed costs on one line and ranks everyday categories', async ({page}) => {
  await page.goto('/?month=2026-09');
  const card = page.getByTestId('category-breakdown');
  await expect(card.getByRole('heading', {name: 'Where it went'})).toBeVisible();
  const rows = card.getByTestId('category-rows').getByRole('link');
  const labels = [
    'Fixed costs',
    'Food and drink',
    'Transportation',
    'Shopping',
    'Uncategorized',
    'Transfer out',
    'Other',
    'Refunds (subtracted)',
  ];
  await expect(rows).toHaveCount(labels.length);
  for (const [index, label] of labels.entries()) {
    await expect(rows.nth(index)).toContainText(label);
  }
  await expect(rows.first()).toContainText('€1,080.00');
  await expect(rows.first()).toContainText('Housing and utilities, subscriptions');
  await expect(rows.last()).toContainText('-€40.00');
  await expect(card).not.toContainText('more categories');
});

test('fixed costs drill to exactly their categories', async ({page}) => {
  await page.goto('/?month=2026-09');
  const link = page.getByTestId('category-breakdown').getByRole('link', {name: /Fixed costs/});
  const search = new URL((await link.getAttribute('href'))!, page.url()).searchParams;
  expect(JSON.parse(search.get('categories')!)).toEqual(['HOUSING_AND_UTILITIES', 'SUBSCRIPTIONS']);
  expect(JSON.parse(search.get('cashFlows')!)).toEqual(['SPENDING']);
});

test('lists the biggest everyday changes against usual, by amount', async ({page}) => {
  await page.goto('/?month=2026-09');
  const changes = page.getByTestId('biggest-changes').getByRole('listitem');
  // Shopping moved 11% and Subscriptions is a fixed cost, so neither is listed.
  await expect(changes).toHaveCount(3);
  await expect(changes.nth(0)).toContainText('Food and drink+€200.00 (+100%)');
  await expect(changes.nth(1)).toContainText('Transportation−€100.00 (−25%)');
  // Spending where there usually is none reads as new rather than an infinite percentage.
  await expect(changes.nth(2)).toContainText('Transfer out+€20.00 (new)');
  await changes.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/categories=.*FOOD_AND_DRINK/);
});

test('leaves out the changes list when nothing moved much', async ({page}) => {
  await mockJson(page, '**/bank-transactions/summary**', {
    ...categorySummary,
    categories: categorySummary.categories.map((row) => ({
      ...row,
      baselineAverage: row.baselineAverage === null ? null : row.spending,
    })),
  });
  await page.goto('/?month=2026-09');
  await expect(page.getByTestId('category-breakdown')).toContainText('Food and drink');
  await expect(page.getByTestId('biggest-changes')).toHaveCount(0);
});

test('drills to the exact category and booking range', async ({page}) => {
  await page.goto('/?month=2026-09');
  const link = page
    .getByTestId('category-breakdown')
    .getByRole('link')
    .filter({hasText: '12 transactions'});
  const href = await link.getAttribute('href');
  expect(href).not.toBeNull();
  const search = new URL(href!, page.url()).searchParams;
  expect(JSON.parse(search.get('categories')!)).toEqual(['FOOD_AND_DRINK']);
  expect(JSON.parse(search.get('cashFlows')!)).toEqual(['SPENDING']);
  expect(search.get('baseAmount')).toBe('PRESENT');
  const range = JSON.parse(search.get('bookingDate')!) as {from: string; to: string};
  expect(new Date(range.from).getDate()).toBe(1);
  expect(new Date(range.to).getDate()).toBe(30);
  expect(new Date(range.from).getMonth()).toBe(8);
  expect(new Date(range.to).getFullYear()).toBe(2026);
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/bank-transactions/);
});

test('remaining categories drill excludes the top six and refunds', async ({page}) => {
  await mockJson(page, '**/bank-transactions/summary**', {
    ...categorySummary,
    categories: [
      ...categorySummary.categories,
      {category: 'HEALTH', spending: '12.00', count: 1, baselineAverage: null},
    ],
  });
  await page.goto('/?month=2026-09');
  const link = page.getByTestId('category-breakdown').getByRole('link', {name: /1 more category/});
  const search = new URL((await link.getAttribute('href'))!, page.url()).searchParams;
  expect(JSON.parse(search.get('categories')!)).toEqual(['HEALTH']);
  expect(JSON.parse(search.get('cashFlows')!)).toEqual(['SPENDING']);
  expect(search.get('baseAmount')).toBe('PRESENT');
});

test('shows counts, usual amounts and the usual tick', async ({page}) => {
  await page.goto('/?month=2026-09');
  const card = page.getByTestId('category-breakdown');
  const food = card.getByRole('link').filter({hasText: '12 transactions'});
  await expect(food).toContainText('12 transactions · usually €200.00');
  await expect(food.getByRole('img', {name: 'Usual spending: €200.00'})).toBeVisible();
  await expect(card.getByRole('link').filter({hasText: '6 transactions'})).toContainText(
    '6 transactions · usually €400.00',
  );
  const uncategorized = card.getByRole('link', {name: /Uncategorized/});
  await expect(uncategorized).toHaveText(/2 transactions$/);
  await expect(uncategorized.getByRole('img')).toHaveCount(0);
});

test('empty spending explains the period without a more-categories link', async ({page}) => {
  await mockJson(page, '**/bank-transactions/summary**', {...categorySummary, categories: []});
  await page.goto('/?month=2026-09');
  const card = page.getByTestId('category-breakdown');
  await expect(card).toContainText('No spending this month.');
  await expect(card.getByRole('link')).toHaveCount(0);
});

test('fits a phone with current-month comparison context and a zero baseline', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await mockJson(page, '**/bank-transactions/summary**', {
    ...categorySummary,
    month: '2026-10',
    through: '2026-10-01',
    daysInMonth: 31,
    categories: [categorySummary.categories[6]],
  });
  await page.goto('/');
  const card = page.getByTestId('category-breakdown');
  await expect(card).toContainText('Compared with usual by this day of the month.');
  await expect(
    card.getByTestId('category-rows').getByRole('link', {name: /Transfer out/}),
  ).toContainText('1 transaction · usually €0.00');
  await expectNoHorizontalOverflow(page);
});
