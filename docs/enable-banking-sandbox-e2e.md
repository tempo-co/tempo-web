# Enable Banking sandbox E2E

The real provider-backed test is part of the normal Playwright suite in:

```text
test/e2e/banking/bank-connections.spec.ts
```

It is skipped unless both of these are enabled:

```text
ENABLE_BANKING_E2E=true
ENABLE_BANKING_PROVIDER_STORAGE_STATE=/path/to/provider-state.json
```

The test covers the complete initial connection flow:

1. Log in to the seeded Tempo test user.
2. Load the real ASPSP catalog through Tempo.
3. Select `Netherlands` and `Mock ASPSP` in the real picker.
4. Start authorization through the Tempo API.
5. Complete the Enable Banking consent and mock-account authorization pages.
6. Return through Tempo's callback.
7. Verify the connected result, `AUTHORIZED` persistence, consent expiry, and at least one persisted account.
8. Verify the connection renders in the UI and is removed during cleanup.

Cancellation, callback replay, provider failure, reauthorization, synchronization, ownership, and destructive-removal behavior remain in the deterministic API and web tests. They do not need additional fragile real-provider journeys.

## Local execution

Use the sandbox application only. In the API repository's ignored local environment, configure the sandbox application and key path:

```text
ENABLE_BANKING_API_URL=https://api.enablebanking.com
ENABLE_BANKING_APPLICATION_ID=<sandbox application id>
ENABLE_BANKING_PRIVATE_KEY_PATH=/path/to/sandbox.key
ENABLE_BANKING_REDIRECT_URL=http://localhost:3020/bank-connections/callback
```

The key may be readable by authorized local development agents on the machine. It must remain outside Git, must not be printed, and must not be copied into reports or artifacts.

In the web repository's ignored local environment, enable the provider scenario and point to an authenticated Enable Banking Control Panel storage state:

```text
ENABLE_BANKING_E2E=true
ENABLE_BANKING_PROVIDER_STORAGE_STATE=/path/to/enable-banking-provider.json
VITE_API_URL=http://localhost:3020
VITE_APP_URL=http://localhost:5174
```

Then run the ordinary command:

```sh
npx playwright test
```

The provider browser state is more sensitive than the sandbox key because it represents an authenticated Control Panel session. Keep the local file outside Git at mode `0600`; never upload it as a repository file, workflow artifact, report, or trace. The protected GitHub environment stores an encrypted CI copy only. It must include the Control Panel session needed by the `Mock ASPSP` authorization page.

To refresh the state, use a one-off visible Playwright browser session with the dedicated sandbox Control Panel account, complete sign-in manually, and save `context.storageState({path, indexedDB: true})` to the path above. Do not add the state file or credentials to the repository.

The callback URL must remain registered in the sandbox application:

```text
http://localhost:3020/bank-connections/callback
```

Concurrent local instances should not share the same callback port and provider session. Use distinct registered callback URLs or serialize the runs.

## GitHub Actions

Ordinary pull-request E2E runs use the normal Playwright config without provider secrets. The provider test is included in the suite but skips because `ENABLE_BANKING_E2E` is unset. This applies to fork and same-repository pull requests.

The same `.github/workflows/ci.yml` contains a protected `Enable Banking sandbox E2E` job. It runs:

- automatically on pushes to `main`;
- manually when `workflow_dispatch` is started with `run_enable_banking_e2e=true`;
- only after the `enable-banking-sandbox` environment is approved.

The job uses the ordinary `npx playwright test` command and the ordinary `playwright.config.ts`. For a manual branch run, set `api_ref` to the API branch or commit that matches the web changes.

The protected environment contains these encrypted secrets:

- `ENABLE_BANKING_SANDBOX_APPLICATION_ID`
- `ENABLE_BANKING_SANDBOX_PRIVATE_KEY`
- `ENABLE_BANKING_PROVIDER_STORAGE_STATE_B64`

The workflow writes them only to temporary runner files, builds the selected API revision into an isolated test image, and removes the key, provider state, merged browser state, temporary API environment, reports, and disposable services in an `always()` cleanup step. It does not upload Playwright reports or traces from the provider job.

If the protected test fails on `main`, reproduce locally with the same sandbox application and provider state, fix the code on a branch, and use the manual workflow dispatch with that web branch and matching `api_ref` before merging. If the failure is provider configuration or an expired Control Panel session, refresh the protected state or application configuration without changing application code.
