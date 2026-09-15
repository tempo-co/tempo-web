# Enable Banking sandbox E2E

The sandbox test exercises the real bank-connection lifecycle:

1. Log in to the seeded Tempo test user.
2. Load the real ASPSP catalog from the API.
3. Select `Netherlands` and `Mock ASPSP` in the real picker.
4. Start authorization through the Tempo API.
5. Complete the Enable Banking consent and mock-account authorization pages.
6. Return through `http://localhost:3020/bank-connections/callback`.
7. Verify that the authorized connection and at least one bank account are persisted and rendered by Tempo.

The ordinary Playwright suite ignores `*.sandbox.spec.ts`. The real-provider test runs through the protected **Enable Banking sandbox E2E** workflow, which is manually dispatched so provider uptime and credentials do not become a required PR check.

## One-time sandbox setup

Use a dedicated Enable Banking sandbox application and a dedicated Control Panel test account. Do not use a personal browser session or production application. The application must have:

- `http://localhost:3020/bank-connections/callback` registered as an allowed redirect URL.
- At least one account configured for `Mock ASPSP`.
- A private key matching the application certificate.

The callback uses `localhost` intentionally. In GitHub Actions, the browser, API container, and callback all run on the same runner, so the provider redirect reaches the API through the runner's port `3020`.

## Provider browser state

The mock authorization page requires an authenticated Enable Banking Control Panel session. The application ID and private key alone cannot complete that page. Capture the state from the dedicated test account locally:

```sh
npm run enable-banking:save-state -- playwright/.auth/enable-banking-provider.json
base64 -w 0 playwright/.auth/enable-banking-provider.json
```

The capture command opens a visible browser. Complete the provider sign-in there; the state is written locally with IndexedDB included. Store the resulting base64 value only as a protected GitHub environment secret. Never commit the JSON or paste its contents into logs.

## GitHub environment

Create a protected environment named `enable-banking-sandbox` and add these secrets:

- `ENABLE_BANKING_SANDBOX_APPLICATION_ID`
- `ENABLE_BANKING_SANDBOX_PRIVATE_KEY`
- `ENABLE_BANKING_PROVIDER_STORAGE_STATE_B64`

The workflow writes the private key and browser state only to the ephemeral runner, does not upload Playwright artifacts, and removes both files during cleanup.

Dispatch **Enable Banking sandbox E2E** with the API branch or commit that contains the matching banking API changes. The default input is `feat/enable-banking-aspsp-picker` while the API and web changes are under review.
