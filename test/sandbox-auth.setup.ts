import {test as setup} from '@playwright/test';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

import {SESSION_TEST_USER_AUTH_FILE} from './constants/auth.constants';

type Cookie = Record<string, unknown> & {name?: string; domain?: string; path?: string};
type LocalStorageEntry = {name: string; value: string};
type Origin = {
  origin: string;
  localStorage?: LocalStorageEntry[];
  indexedDB?: unknown[];
};
type StorageState = {cookies: Cookie[]; origins: Origin[]};

const PROVIDER_STATE_PATH = process.env.ENABLE_BANKING_PROVIDER_STORAGE_STATE;
const OUTPUT_PATH = 'playwright/.auth/enable-banking-sandbox-user.json';

setup('prepare the combined Tempo and Enable Banking browser state', () => {
  if (!PROVIDER_STATE_PATH) {
    throw new Error('ENABLE_BANKING_PROVIDER_STORAGE_STATE is required for sandbox E2E.');
  }

  const tempoState = readStorageState(SESSION_TEST_USER_AUTH_FILE);
  const providerState = readStorageState(PROVIDER_STATE_PATH);
  const mergedState = mergeStorageStates(tempoState, providerState);

  mkdirSync(dirname(OUTPUT_PATH), {recursive: true});
  writeFileSync(OUTPUT_PATH, JSON.stringify(mergedState));
});

function readStorageState(path: string): StorageState {
  const state = JSON.parse(readFileSync(path, 'utf8')) as Partial<StorageState>;
  if (!Array.isArray(state.cookies) || !Array.isArray(state.origins)) {
    throw new Error(`Invalid Playwright storage state: ${path}`);
  }

  return {cookies: state.cookies, origins: state.origins};
}

function mergeStorageStates(...states: StorageState[]): StorageState {
  const cookies = new Map<string, Cookie>();
  const origins = new Map<string, Origin>();

  for (const state of states) {
    for (const cookie of state.cookies) {
      const key = `${cookie.name ?? ''}:${cookie.domain ?? ''}:${cookie.path ?? ''}`;
      cookies.set(key, cookie);
    }

    for (const origin of state.origins) {
      const existing = origins.get(origin.origin);
      if (!existing) {
        origins.set(origin.origin, {...origin});
        continue;
      }

      const localStorage = new Map(
        (existing.localStorage ?? []).map((entry) => [entry.name, entry.value]),
      );
      for (const entry of origin.localStorage ?? []) localStorage.set(entry.name, entry.value);

      origins.set(origin.origin, {
        ...existing,
        ...origin,
        localStorage: [...localStorage.entries()].map(([name, value]) => ({name, value})),
      });
    }
  }

  return {cookies: [...cookies.values()], origins: [...origins.values()]};
}
