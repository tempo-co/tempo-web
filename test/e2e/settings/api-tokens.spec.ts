import {expect, test} from '../../fixtures';
import {createHookHarness} from '../../utils/hook-harness';
import {expectNoHorizontalOverflow} from '../../utils/layout';

const account = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Alex Example',
  email: 'alex@example.com',
  isEmailVerified: true,
};
const tokenMetadata = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Example integration',
  prefix: 'tempo_pat_example',
  scopes: ['read'],
  createdAt: '2026-01-02T12:00:00.000Z',
  lastUsedAt: null,
};
const secret = 'tempo_pat_example_synthetic_secret_not_a_real_token';

test('delivers the created secret only to the dialog, keeping query and mutation caches secret-free', async () => {
  const {client, renderHook} = createHookHarness({
    '@/utils/api': {api: {post: () => Promise.resolve({...tokenMetadata, token: secret})}},
    sonner: {toast: {}},
  });
  let shown: string | undefined;
  client.setQueryData(['personal-access-tokens'], []);
  try {
    const create = renderHook<{mutateAsync: (dto: {name: string}) => Promise<void>}>(
      'src/features/settings/api/use-personal-access-tokens.ts',
      'useCreatePersonalAccessToken',
      (value: string) => {
        shown = value;
      },
    );
    await create.mutateAsync({name: tokenMetadata.name});
    expect(shown).toBe(secret);
    expect(client.getQueryState(['personal-access-tokens'])?.isInvalidated).toBe(true);
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state),
      ),
    ).not.toContain(secret);
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state),
      ),
    ).not.toContain(secret);
  } finally {
    client.clear();
  }
});

test.use({storageState: {cookies: [], origins: []}});

test.beforeEach(async ({page}) => {
  await page.route('**/accounts/me', (route) => route.fulfill({json: account}));
});

for (const width of [1440, 320]) {
  test(`creates, copies and dismisses a one-time token, then revokes its access (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({width, height: 900});
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    let tokens: (typeof tokenMetadata)[] = [];
    let creates = 0;
    let revokes = 0;
    await page.route('**/personal-access-tokens', async (route) => {
      if (route.request().isNavigationRequest()) return route.fallback();
      if (route.request().method() === 'POST') {
        creates++;
        expect(route.request().postDataJSON()).toEqual({name: tokenMetadata.name});
        tokens = [tokenMetadata];
        return route.fulfill({status: 201, json: {...tokenMetadata, token: secret}});
      }
      return route.fulfill({json: tokens});
    });
    await page.route('**/personal-access-tokens/*', async (route) => {
      expect(route.request().method()).toBe('DELETE');
      expect(route.request().url()).toContain(tokenMetadata.id);
      revokes++;
      tokens = [];
      await route.fulfill({status: 204});
    });
    await page.goto('/settings/api-tokens');
    await expect(page.getByText('No API tokens yet.', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Create token', exact: true}).click();
    const dialog = page.getByRole('dialog');
    const expectPhoneActions = async () => {
      if (width >= 768) return;
      const heights = await dialog
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.map((button) => parseFloat(getComputedStyle(button).height)),
        );
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
    };
    await expectPhoneActions();
    await dialog.getByLabel('Name', {exact: true}).fill(`  ${tokenMetadata.name}  `);
    await dialog.getByRole('button', {name: 'Create token', exact: true}).click();
    await expect(dialog.getByLabel('API token', {exact: true})).toHaveValue(secret);
    await expectPhoneActions();
    await expect(dialog).toContainText('only shown once');
    await dialog.getByRole('button', {name: 'Copy token', exact: true}).click();
    await expect(dialog.getByRole('button', {name: 'Copied', exact: true})).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(secret);
    const storage = await page.evaluate(() => ({
      local: {...localStorage},
      session: {...sessionStorage},
      url: location.href,
    }));
    expect(JSON.stringify(storage)).not.toContain(secret);
    await expectNoHorizontalOverflow(page);
    await dialog.getByRole('button', {name: 'Done', exact: true}).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', {name: 'Create token', exact: true})).toBeFocused();
    const row = page.getByTestId('api-token-row');
    await expect(row).toContainText(tokenMetadata.name);
    await expect(row).toContainText(tokenMetadata.prefix);
    await expect(row).toContainText('Created');
    await expect(row).toContainText('Never used');
    await expect(page.locator('body')).not.toContainText(secret);
    await page.reload();
    await expect(row).toContainText(tokenMetadata.name);
    await expect(page.locator('body')).not.toContainText(secret);
    await expect(page.getByLabel('API token', {exact: true})).toHaveCount(0);
    await row.getByRole('button', {name: 'Revoke', exact: true}).click();
    await expect(dialog).toContainText(tokenMetadata.name);
    await expectPhoneActions();
    await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
    expect(revokes).toBe(0);
    await row.getByRole('button', {name: 'Revoke', exact: true}).click();
    await dialog.getByRole('button', {name: 'Revoke token', exact: true}).click();
    await expect(row).toHaveCount(0);
    await expect(page.getByText('No API tokens yet.', {exact: true})).toBeVisible();
    await page.reload();
    await expect(page.getByText('No API tokens yet.', {exact: true})).toBeVisible();
    expect(creates).toBe(1);
    expect(revokes).toBe(1);
    await expectNoHorizontalOverflow(page);
  });
}

test('validates names, keeps creation open while pending, and offers manual copy when the clipboard is unavailable', async ({
  page,
}) => {
  let creates = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let releaseRefresh!: () => void;
  const refreshing = new Promise<void>((resolve) => (releaseRefresh = resolve));
  await page.route('**/personal-access-tokens', async (route) => {
    if (route.request().method() !== 'POST') {
      if (creates > 0) await refreshing;
      return route.fulfill({json: creates > 0 ? [tokenMetadata] : []});
    }
    creates++;
    await held;
    return route.fulfill({status: 201, json: {...tokenMetadata, token: secret}});
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => Promise.reject(new Error('Synthetic clipboard refusal')),
      },
    });
  });
  await page.goto('/settings/api-tokens');
  const trigger = page.getByRole('button', {name: 'Create token', exact: true});
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByLabel('Name', {exact: true});
  const submit = dialog.getByRole('button', {name: 'Create token', exact: true});
  await name.fill('   ');
  await submit.click();
  await expect(dialog.getByText('Enter a token name.', {exact: true})).toBeVisible();
  await name.fill('x'.repeat(101));
  await submit.click();
  await expect(dialog.getByText('Use 100 characters or fewer.', {exact: true})).toBeVisible();
  expect(creates).toBe(0);
  await name.fill('x'.repeat(100));
  await submit.click();
  await expect(dialog.getByRole('button', {name: 'Creating…', exact: true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Cancel', exact: true})).toBeDisabled();
  release();
  await expect(dialog.getByLabel('API token', {exact: true})).toHaveValue(secret);
  await dialog.getByRole('button', {name: 'Copy token', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('copy it manually');
  await expect(dialog.getByLabel('API token', {exact: true})).toHaveValue(secret);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  releaseRefresh();
  await trigger.click();
  await expect(name).toHaveValue('');
  await expect(dialog.getByLabel('API token', {exact: true})).toHaveCount(0);
  await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
  expect(creates).toBe(1);
});

test('a failed creation preserves the name for retry and clears the error when dismissed', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/personal-access-tokens', (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({json: []});
    return fail
      ? route.fulfill({status: 400, json: {message: 'Synthetic failure'}})
      : route.fulfill({status: 201, json: {...tokenMetadata, token: secret}});
  });
  await page.goto('/settings/api-tokens');
  const trigger = page.getByRole('button', {name: 'Create token', exact: true});
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', {exact: true}).fill(tokenMetadata.name);
  await dialog.getByRole('button', {name: 'Create token', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be created');
  await expect(dialog.getByLabel('Name', {exact: true})).toHaveValue(tokenMetadata.name);
  await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
  await trigger.click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByLabel('Name', {exact: true})).toHaveValue('');
  fail = false;
  await dialog.getByLabel('Name', {exact: true}).fill(tokenMetadata.name);
  await dialog.getByRole('button', {name: 'Create token', exact: true}).click();
  await expect(dialog.getByLabel('API token', {exact: true})).toHaveValue(secret);
});

test('retries a failed list load and retains a token until revocation succeeds', async ({page}) => {
  let loadFails = true;
  let revokeFails = true;
  let tokens = [
    {
      ...tokenMetadata,
      name: 'An example integration with a deliberately long synthetic name '
        .repeat(2)
        .slice(0, 100),
      lastUsedAt: '2026-01-03T12:30:00.000Z',
    },
  ];
  await page.route('**/personal-access-tokens', (route) =>
    loadFails
      ? route.fulfill({status: 429, json: {message: 'Synthetic rate limit'}})
      : route.fulfill({json: tokens}),
  );
  await page.route('**/personal-access-tokens/*', (route) => {
    if (revokeFails) return route.fulfill({status: 409, json: {message: 'Synthetic conflict'}});
    tokens = [];
    return route.fulfill({status: 204});
  });
  await page.setViewportSize({width: 320, height: 900});
  await page.goto('/settings/api-tokens');
  await expect(page.getByText('API tokens could not be loaded.', {exact: true})).toBeVisible();
  loadFails = false;
  await page.getByRole('button', {name: 'Try again', exact: true}).click();
  const row = page.getByTestId('api-token-row');
  await expect(row).toContainText('Last used');
  await expectNoHorizontalOverflow(page);
  await row.getByRole('button', {name: 'Revoke', exact: true}).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: 'Revoke token', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be revoked');
  await expect(row).toHaveCount(1);
  revokeFails = false;
  await dialog.getByRole('button', {name: 'Revoke token', exact: true}).click();
  await expect(row).toHaveCount(0);
});

test('reports a revocation that fails after its confirmation was closed', async ({page}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/personal-access-tokens', (route) => route.fulfill({json: [tokenMetadata]}));
  await page.route('**/personal-access-tokens/*', async (route) => {
    await held;
    await route.fulfill({status: 409, json: {message: 'Synthetic failure'}});
  });
  await page.goto('/settings/api-tokens');
  const row = page.getByTestId('api-token-row');
  await row.getByRole('button', {name: 'Revoke', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: 'Revoke token', exact: true}).click();
  await expect(dialog.getByRole('button', {name: 'Revoking…', exact: true})).toBeDisabled();
  await dialog.getByRole('button', {name: 'Close', exact: true}).first().click();
  await expect(dialog).toBeHidden();
  release();
  await expect(page.getByText('The token could not be revoked.', {exact: true})).toBeVisible();
  await expect(row).toContainText(tokenMetadata.name);
});
