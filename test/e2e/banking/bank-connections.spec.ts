import {expect, test} from '@playwright/test';

import type {BankConnection} from '../../../src/features/banking/types/bank-connection';
import {PW_CHANGE_USER_AUTH_FILE, VERIFIED_USER_AUTH_FILE} from '../../constants/auth.constants';

const DETAIL_TRANSACTION_ID = '00000000-0000-4000-8000-000000000014';

test.describe('bank connections', () => {
  test.use({storageState: VERIFIED_USER_AUTH_FILE});

  test('shows seeded connection data and callback success feedback', async ({page}) => {
    await page.goto('/bank-connections?result=connected');

    const card = page.locator('[data-testid^="bank-connection-"][data-testid$="-card"]').first();
    const toggle = card.getByTestId(/bank-connection-toggle-/);

    await expect(page.getByRole('heading', {name: 'Bank connections'})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'ABN AMRO'})).toBeVisible();
    await expect(card.getByText('Connected', {exact: true})).toBeVisible();
    await expect(card.getByTestId('bank-connection-freshness')).toContainText('Updated');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const status = card.getByTestId('bank-connection-status');
    const freshness = card.getByTestId('bank-connection-freshness');
    const toggleBox = toggle.boundingBox();
    const [statusBox, freshnessBox, toggleBoundingBox] = await Promise.all([
      status.boundingBox(),
      freshness.boundingBox(),
      toggleBox,
    ]);
    expect(statusBox).not.toBeNull();
    expect(freshnessBox).not.toBeNull();
    expect(toggleBoundingBox).not.toBeNull();
    const verticalCenters = [statusBox!, freshnessBox!].map((box) => box.y + box.height / 2);
    expect(Math.max(...verticalCenters) - Math.min(...verticalCenters)).toBeLessThan(14);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', {name: 'Accounts'})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Recent transactions'})).toBeVisible();
    await expect(page.getByTestId('bank-connection-freshness')).toContainText('Updated');
    await expect(page.getByText('Daily spending', {exact: true})).toBeVisible();
    await expect(page.getByText('available', {exact: true})).toBeVisible();
    await expect(page.getByText('Provider purchase')).toBeVisible();
    const transactionTrigger = page.getByRole('button', {
      name: 'View transaction details for Provider purchase',
    });
    await expect(transactionTrigger).toBeVisible();
    await expect(transactionTrigger.getByText('18 Aug', {exact: true})).toHaveText('18 Aug');
    await transactionTrigger.click();
    const inspector = page.getByTestId('bank-transaction-inspector');
    await expect(inspector).toBeVisible();
    expect(new URL(page.url()).searchParams.get('transactionId')).toBe(DETAIL_TRANSACTION_ID);
    await expect(inspector.getByRole('heading', {name: 'Provider purchase'})).toBeVisible();
    await expect(inspector.getByText('Bank transaction', {exact: true})).toBeVisible();
    await inspector.getByRole('button', {name: 'Close transaction details'}).click();
    await expect(inspector).toBeHidden();
    await expect(transactionTrigger).toBeFocused();
    expect(new URL(page.url()).searchParams.has('transactionId')).toBe(false);
    await expect(page.getByText('Bank connection added')).toBeVisible();
    await expect(page).toHaveURL(/\/bank-connections$/);
  });

  test('collapses and re-expands a connection card with footer actions', async ({page}) => {
    await page.goto('/bank-connections');

    const card = page.locator('[data-testid^="bank-connection-"][data-testid$="-card"]').first();
    const toggle = card.getByTestId(/bank-connection-toggle-/);
    const accounts = card.getByTestId(/bank-accounts-/);
    const transactions = card.getByTestId(/bank-transactions-/);
    const removeButton = card.getByTestId(/^remove-bank-/);
    const consentText = card.getByText(/Consent valid until/);

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(accounts).toBeHidden();
    await expect(transactions).toBeHidden();
    await expect(removeButton).toBeVisible();
    await expect(consentText).toBeVisible();

    // Footer row: consent text and remove button share one aligned row.
    const [consentBox, removeBox] = await Promise.all([
      consentText.boundingBox(),
      removeButton.boundingBox(),
    ]);
    expect(consentBox).not.toBeNull();
    expect(removeBox).not.toBeNull();
    const consentCenter = consentBox!.y + consentBox!.height / 2;
    const removeCenter = removeBox!.y + removeBox!.height / 2;
    expect(Math.abs(consentCenter - removeCenter)).toBeLessThan(8);
    expect(removeBox!.x).toBeGreaterThan(consentBox!.x + consentBox!.width - 8);

    await toggle.click();
    await expect(accounts).toBeVisible();
    await expect(transactions).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();
    await expect(accounts).toBeHidden();
    await expect(transactions).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('removes an incomplete bank connection', async ({page}) => {
    const pendingConnectionId = '00000000-0000-4000-8000-000000000098';
    let pendingConnectionVisible = true;
    const pendingConnection = {
      id: pendingConnectionId,
      provider: 'enable-banking',
      aspspName: 'ABN AMRO',
      aspspCountry: 'NL',
      status: 'PENDING_AUTHORIZATION',
      consentValidUntil: null,
      lastSyncedAt: null,
      bankAccounts: [],
    };

    await page.route('**/bank-connections', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.continue();
        return;
      }

      const response = await route.fetch();
      const connections = (await response.json()) as BankConnection[];
      await route.fulfill({
        response,
        json: pendingConnectionVisible ? [...connections, pendingConnection] : connections,
      });
    });
    await page.route(`**/bank-connections/${pendingConnectionId}`, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }

      pendingConnectionVisible = false;
      await route.fulfill({status: 204, body: ''});
    });

    await page.goto('/bank-connections');

    const pendingCard = page.getByTestId(`bank-connection-${pendingConnectionId}-card`);
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard.getByRole('button', {name: 'Remove'})).toBeVisible();
    await pendingCard.getByRole('button', {name: 'Remove'}).click();

    await expect(page.getByText('Bank connection removed', {exact: true})).toBeVisible();
    await expect(pendingCard).toHaveCount(0);
  });

  test('requires explicit confirmation before removing a connected bank connection', async ({
    page,
  }) => {
    const connectedConnectionId = '00000000-0000-4000-8000-000000000097';
    let connectedConnectionVisible = true;
    let deleteCalled = false;

    await page.route('**/bank-connections', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.continue();
        return;
      }

      const response = await route.fetch();
      const connections = (await response.json()) as BankConnection[];
      const connectedConnection = {
        ...connections[0],
        id: connectedConnectionId,
        status: 'AUTHORIZED',
        lastSyncedAt: null,
      };
      await route.fulfill({
        response,
        json: connectedConnectionVisible ? [connectedConnection] : [],
      });
    });
    await page.route(`**/bank-connections/${connectedConnectionId}`, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }

      deleteCalled = true;
      connectedConnectionVisible = false;
      expect(route.request().postDataJSON()).toEqual({confirmation: 'DELETE'});
      await route.fulfill({status: 204, body: ''});
    });

    await page.goto('/bank-connections');

    const connectedCard = page.getByTestId(`bank-connection-${connectedConnectionId}-card`);
    await expect(connectedCard).toBeVisible();
    await connectedCard.getByRole('button', {name: 'Remove'}).click();
    await expect(page.getByRole('heading', {name: 'Remove connected bank?'})).toBeVisible();
    await expect(page.getByText(/all linked bank accounts, and all transactions/)).toBeVisible();
    expect(deleteCalled).toBe(false);

    const confirmButton = page.getByTestId(`remove-bank-confirm-${connectedConnectionId}`);
    await expect(confirmButton).toBeDisabled();
    await page.getByTestId(`remove-bank-confirmation-${connectedConnectionId}`).fill('DELETE');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(page.getByText('Bank connection removed', {exact: true})).toBeVisible();
    expect(deleteCalled).toBe(true);
    await expect(connectedCard).toHaveCount(0);
  });

  test('reopens a connection transaction inspector from its shareable URL', async ({page}) => {
    await page.goto('/bank-connections');

    await page.locator('button[data-testid^="bank-connection-toggle-"]').first().click();

    const transactionTrigger = page.getByRole('button', {
      name: 'View transaction details for Provider purchase',
    });
    await transactionTrigger.click();

    const sharedUrl = page.url();
    expect(new URL(sharedUrl).searchParams.get('transactionId')).toBe(DETAIL_TRANSACTION_ID);

    await page.goto(sharedUrl);
    const inspector = page.getByTestId('bank-transaction-inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole('heading', {name: 'Provider purchase'})).toBeVisible();
    expect(new URL(page.url()).searchParams.get('transactionId')).toBe(DETAIL_TRANSACTION_ID);
  });

  test('returns to the installed app after bank authorization', async ({page, context}) => {
    await page.goto('/bank-connections');
    const authorizationUrl = 'https://bank.example.test/mock-bank-authorization';
    const callbackUrl = new URL('./bank-connections?result=connected', page.url()).toString();
    await page.route('**/bank-connections/authorize', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({authorizationUrl}),
      });
    });
    await context.route('**/mock-bank-authorization', async (route) => {
      await route.fulfill({status: 302, headers: {location: callbackUrl}});
    });

    let popupOpened = false;
    page.on('popup', () => {
      popupOpened = true;
    });

    await page.getByTestId('connect-abn-amro-button').click();

    await expect(page.getByText('Bank connection added')).toBeVisible();
    await expect(page).toHaveURL(/\/bank-connections$/);
    expect(popupOpened).toBe(false);
  });

  test('keeps the connection overview usable at phone widths', async ({page}) => {
    await page.setViewportSize({width: 393, height: 852});
    await page.goto('/bank-connections');

    const heading = page.getByRole('heading', {name: 'Bank connections'});
    const headingGroup = page.getByTestId('bank-connections-heading');
    const connectButton = page
      .getByRole('button', {name: /^Connect (ABN AMRO|Mock ASPSP)$/})
      .first();
    const removeButton = page.getByTestId(/^remove-bank-/);
    const status = page.getByTestId('bank-connection-status');
    const freshness = page.getByTestId('bank-connection-freshness');

    await expect(heading).toBeVisible();
    await expect(connectButton).toBeVisible();
    await expect(removeButton).toBeVisible();

    await page.locator('button[data-testid^="bank-connection-toggle-"]').first().click();
    await expect(page.getByText('Daily spending', {exact: true})).toBeVisible();

    const [headingBox, headingGroupBox, connectButtonBox, removeButtonBox, statusBox, freshnessBox] =
      await Promise.all([
        heading.boundingBox(),
        headingGroup.boundingBox(),
        connectButton.boundingBox(),
        removeButton.boundingBox(),
        status.boundingBox(),
        freshness.boundingBox(),
      ]);
    expect(headingBox).not.toBeNull();
    expect(headingGroupBox).not.toBeNull();
    expect(connectButtonBox).not.toBeNull();
    expect(removeButtonBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(freshnessBox).not.toBeNull();
    expect(headingBox!.height).toBe(32);
    expect(headingGroupBox!.height).toBeLessThan(120);
    expect(connectButtonBox!.x).toBe(16);
    expect(removeButtonBox!.height).toBeGreaterThanOrEqual(44);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);

    const sidebarTrigger = page.locator('[data-sidebar="trigger"]');
    await sidebarTrigger.click();
    const mobileSidebar = page.locator('[data-sidebar="sidebar"][data-mobile="true"]');
    await expect(mobileSidebar).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(mobileSidebar).toBeHidden();
    await expect(sidebarTrigger).toBeFocused();
  });

  test('keeps the connection overview within a narrow phone viewport', async ({page}) => {
    await page.setViewportSize({width: 320, height: 852});
    await page.goto('/bank-connections');

    const connectionCard = page
      .locator('[data-testid^="bank-connection-"][data-testid$="-card"]')
      .first();
    const removeButton = page.getByTestId(/^remove-bank-/);
    const sidebarTrigger = page.locator('[data-sidebar="trigger"]');

    await expect(removeButton).toBeVisible();
    await expect(sidebarTrigger).toBeVisible();

    const [connectionCardBox, removeButtonBox, sidebarTriggerBox] = await Promise.all([
      connectionCard.boundingBox(),
      removeButton.boundingBox(),
      sidebarTrigger.boundingBox(),
    ]);
    expect(connectionCardBox).not.toBeNull();
    expect(removeButtonBox).not.toBeNull();
    expect(sidebarTriggerBox).not.toBeNull();
    expect(connectionCardBox!.x + connectionCardBox!.width).toBeLessThanOrEqual(320);
    expect(removeButtonBox!.height).toBeGreaterThanOrEqual(44);
    expect(sidebarTriggerBox!.height).toBeGreaterThanOrEqual(44);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });

  test('supports enlarged text without horizontal overflow', async ({page}) => {
    await page.setViewportSize({width: 320, height: 852});
    await page.goto('/bank-connections');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });

    const connectButton = page
      .getByRole('button', {name: /^Connect (ABN AMRO|Mock ASPSP)$/})
      .first();
    const connectButtonBox = await connectButton.boundingBox();

    expect(connectButtonBox).not.toBeNull();
    expect(connectButtonBox!.x + connectButtonBox!.width).toBeLessThanOrEqual(320);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
});

test.describe('bank connection loading errors', () => {
  test.use({storageState: VERIFIED_USER_AUTH_FILE});

  test('shows a retryable error when connections cannot load', async ({page}) => {
    let connectionRequests = 0;
    await page.route('**/bank-connections', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.continue();
        return;
      }

      connectionRequests += 1;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({message: 'Service unavailable'}),
      });
    });

    await page.goto('/bank-connections');

    await expect(page.getByRole('heading', {name: 'Bank connections', exact: true})).toBeVisible();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('heading', {name: 'Could not load bank connections'}),
    ).toBeVisible();
    const retryButton = page.getByTestId('bank-connections-retry');
    await expect(retryButton).toBeVisible();
    const retryButtonBox = await retryButton.boundingBox();
    expect(retryButtonBox).not.toBeNull();
    expect(retryButtonBox!.height).toBeGreaterThanOrEqual(44);
    expect(connectionRequests).toBe(1);
  });
});

test.describe('bank connections without bank connections', () => {
  test.use({storageState: PW_CHANGE_USER_AUTH_FILE});

  test('shows the connect prompt without bank connections', async ({page}) => {
    await page.goto('/bank-connections');

    await expect(page.getByRole('heading', {name: 'No bank connections'})).toBeVisible();
    await expect(page.getByRole('button', {name: /^Connect (ABN AMRO|Mock ASPSP)$/})).toHaveCount(
      1,
    );
  });
});
