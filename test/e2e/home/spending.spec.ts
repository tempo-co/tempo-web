import {VERIFIED_USER_AUTH_FILE} from '../../constants/auth.constants';
import {SEEDED_TRANSACTION_YEAR_NOW} from '../../constants/seed.constants';
import {categorySummary} from '../../data/home-categories.data';
import {
  firstMonthSummary,
  octoberFirstSummary,
  septemberSummary,
} from '../../data/home-summary.data';
import {expect, test} from '../../fixtures';
import {mockJson, openDailyPace} from '../../utils/api-mocks';

test.use({storageState: VERIFIED_USER_AUTH_FILE});
test.beforeEach(async ({page}) => {
  await page.clock.setFixedTime(SEEDED_TRANSACTION_YEAR_NOW);
});

test('shows exact spending and an accessible pace alternative', async ({page}) => {
  await mockJson(page, '**/bank-transactions/summary**', septemberSummary);
  await page.goto('/?month=2026-09');
  const card = page.getByTestId('spending-summary');
  await expect(card.getByRole('link', {name: '€1,200.00', exact: true})).toBeVisible();
  const comparison = card.getByTestId('spending-comparison');
  await expect(comparison).toContainText('€150.00 below average · within your normal range');
  await expect(comparison).toContainText('Jun–Aug average: €1,350.00');
  await expect(card).not.toContainText('Usual is the average of');
  // The comparison sits beside the headline on wide screens instead of below it.
  const headline = await card.getByRole('link', {name: '€1,200.00', exact: true}).boundingBox();
  const side = await comparison.boundingBox();
  expect(side!.x).toBeGreaterThan(headline!.x + headline!.width);
  expect(side!.y).toBeLessThan(headline!.y + headline!.height);
  await openDailyPace(page);
  await expect(card).toContainText('Lowest to highest');
  const row = card
    .getByRole('table', {name: 'Exact daily spending', includeHidden: true})
    .getByRole('row', {includeHidden: true})
    .nth(18);
  await expect(row).toContainText('18 Sep');
  await expect(row).toContainText('€720.00');
  await expect(row).toContainText('€810.00');
  await row.getByRole('link', {includeHidden: true}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/bank-transactions/);
  const search = new URL(page.url()).searchParams;
  // Exactly the day's counted spending: the fixture month has rows still missing a base amount.
  expect(JSON.parse(search.get('cashFlows')!)).toEqual(['SPENDING']);
  expect(search.get('baseAmount')).toBe('PRESENT');
  const range = JSON.parse(search.get('bookingDate')!) as {from: string; to: string};
  expect(new Date(range.from).getDate()).toBe(18);
  expect(new Date(range.to).getDate()).toBe(18);
  await expect(page.getByRole('button', {name: 'Cash flow: Spending', exact: true})).toBeVisible();
});

test('explains missing history without inventing a range', async ({page}) => {
  await mockJson(page, '**/bank-transactions/summary**', firstMonthSummary);
  await page.goto('/?month=2026-09');
  const card = page.getByTestId('spending-summary');
  await expect(card).toContainText('No earlier months to compare with yet.');
  await expect(card.getByText('Lowest to highest')).toHaveCount(0);
});

test('splits spending into everyday and fixed costs, each against its usual amount', async ({
  page,
}) => {
  await mockJson(page, '**/bank-transactions/summary**', categorySummary);
  await page.goto('/?month=2026-09');
  const card = page.getByTestId('spending-summary');
  // €2,025 spent: €1,080 of housing and subscriptions, the rest everyday.
  await expect(card.getByText('Everyday', {exact: true}).locator('..')).toContainText(
    '€945.00 · usually €340.00',
  );
  await expect(card.getByText('Fixed', {exact: true}).locator('..')).toContainText('€1,080.00');
  const everyday = card.getByRole('link', {name: '€945.00', exact: true});
  const search = new URL((await everyday.getAttribute('href'))!, page.url()).searchParams;
  expect(JSON.parse(search.get('categories')!)).not.toContain('HOUSING_AND_UTILITIES');
});

test('projects the month end from whole earlier months', async ({page}) => {
  await mockJson(page, '**/bank-transactions/summary**', octoberFirstSummary);
  await page.goto('/');
  // €60 so far, plus the €1,305 earlier months still spent after the 1st.
  await expect(page.getByTestId('spending-summary')).toContainText(
    'On track for about €1,370 by month end',
  );
});
