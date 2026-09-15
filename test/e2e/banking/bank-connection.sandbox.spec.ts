import {expect, test} from '@playwright/test';

type BankConnection = {
  id: string;
  aspspName: string;
  aspspCountry: string;
  status: string;
  bankAccounts: unknown[];
};

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:3020';
const TARGET_ASPSP = {name: 'Mock ASPSP', country: 'NL'};

test.describe('Enable Banking sandbox bank connection', () => {
  test.use({storageState: 'playwright/.auth/enable-banking-sandbox-user.json'});
  test.setTimeout(120000);

  test.beforeEach(async ({page}) => {
    await removeTargetConnections(page);
  });

  test.afterEach(async ({page}) => {
    await removeTargetConnections(page);
  });

  test('connects a mock account through the complete authorization callback', async ({page}) => {
    await page.goto('/bank-connections');
    await expect(page.getByRole('heading', {name: 'Bank connections'})).toBeVisible();

    await page.getByRole('button', {name: 'Connect a bank'}).click();
    const picker = page.getByTestId('bank-connection-picker');

    await picker.getByTestId('bank-connection-country-selector').click();
    await page.getByPlaceholder('Search countries...').fill(TARGET_ASPSP.country);
    await page.getByRole('option', {name: /Netherlands/}).click();

    await picker.getByTestId('bank-connection-bank-selector').click();
    await page.getByRole('option', {name: /Mock ASPSP/}).click();

    await page.waitForURL(/tilisy-sandbox\.enablebanking\.com/, {timeout: 60000});
    await expect(
      page.getByRole('button', {name: /Continue with authentication|Doorgaan met authenticatie/}),
    ).toBeVisible();
    await page
      .getByRole('button', {name: /Continue with authentication|Doorgaan met authenticatie/})
      .click();

    await page.waitForURL(/enablebanking\.com\/cp\/mock-aspsp\/auth/, {timeout: 60000});
    await expect(page.getByRole('heading', {name: /Please select the account/i})).toBeVisible();

    const accountCheckboxes = page.locator('input[type="checkbox"]');
    await expect(accountCheckboxes.first()).toBeVisible();
    await accountCheckboxes.first().check();
    await page.getByRole('button', {name: 'Authorize', exact: true}).click();

    await page.waitForURL((url) => url.pathname === '/bank-connections', {timeout: 120000});
    await expect(page.getByText('Bank connection added', {exact: true})).toBeVisible();

    await expect
      .poll(
        async () => {
          const connection = await findTargetConnection(page);
          return connection?.status ?? null;
        },
        {timeout: 60000},
      )
      .toBe('AUTHORIZED');

    const connection = await findTargetConnection(page);
    expect(connection).toMatchObject({
      aspspName: TARGET_ASPSP.name,
      aspspCountry: TARGET_ASPSP.country,
      status: 'AUTHORIZED',
    });
    expect(connection?.bankAccounts.length).toBeGreaterThan(0);

    await expect(page.getByRole('heading', {name: TARGET_ASPSP.name})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Accounts'})).toBeVisible();
    await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  });
});

async function findTargetConnection(page: import('@playwright/test').Page) {
  const response = await page.request.get(`${API_URL}/bank-connections`);
  if (!response.ok()) return undefined;

  const connections = (await response.json()) as BankConnection[];
  return connections.find(
    (connection) =>
      connection.aspspName === TARGET_ASPSP.name &&
      connection.aspspCountry === TARGET_ASPSP.country,
  );
}

async function removeTargetConnections(page: import('@playwright/test').Page) {
  const response = await page.request.get(`${API_URL}/bank-connections`);
  if (!response.ok()) return;

  const connections = (await response.json()) as BankConnection[];
  for (const connection of connections.filter(
    (candidate) =>
      candidate.aspspName === TARGET_ASPSP.name && candidate.aspspCountry === TARGET_ASPSP.country,
  )) {
    await page.request.delete(`${API_URL}/bank-connections/${connection.id}`, {
      data: {confirmation: 'DELETE'},
    });
  }
}
