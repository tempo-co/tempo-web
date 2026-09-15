import {test as setup} from '@playwright/test';
import {chmodSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

import {
  EMAIL_CHANGE_USER_AUTH_FILE,
  ENABLE_BANKING_SANDBOX_USER_AUTH_FILE,
  PW_CHANGE_USER_AUTH_FILE,
  PW_RESET_USER_AUTH_FILE,
  SESSION_TEST_USER_AUTH_FILE,
  UNVERIFIED_USER_AUTH_FILE,
  VERIFIED_USER_AUTH_FILE,
} from './constants/auth.constants';
import {
  EMAIL_CHANGE_ACCOUNT_EMAIL,
  EMAIL_CHANGE_ACCOUNT_PASSWORD,
  PW_CHANGE_ACCOUNT_EMAIL,
  PW_CHANGE_ACCOUNT_PASSWORD,
  PW_RESET_ACCOUNT_EMAIL,
  PW_RESET_ACCOUNT_PASSWORD,
  SESSION_TEST_ACCOUNT_EMAIL,
  SESSION_TEST_ACCOUNT_PASSWORD,
  UNVERIFIED_ACCOUNT_EMAIL,
  UNVERIFIED_ACCOUNT_PASSWORD,
  VERIFIED_ACCOUNT_EMAIL,
  VERIFIED_ACCOUNT_PASSWORD,
} from './constants/seed.constants';
import {HomePage} from './pages/home.page';
import {LoginPage} from './pages/login.page';
import {VerifyEmailPage} from './pages/verify-email.page';

type LandingPage = 'home' | 'verify-email';

type UserConfig = {
  email: string;
  password: string;
  authFile: string;
  landsOn: LandingPage;
};

type Cookie = Record<string, unknown> & {name?: string; domain?: string; path?: string};
type LocalStorageEntry = {name: string; value: string};
type Origin = {
  origin: string;
  localStorage?: LocalStorageEntry[];
  indexedDB?: unknown[];
};
type StorageState = {cookies: Cookie[]; origins: Origin[]};

const userConfig: UserConfig[] = [
  {
    email: VERIFIED_ACCOUNT_EMAIL,
    password: VERIFIED_ACCOUNT_PASSWORD,
    authFile: VERIFIED_USER_AUTH_FILE,
    landsOn: 'home',
  },
  {
    email: UNVERIFIED_ACCOUNT_EMAIL,
    password: UNVERIFIED_ACCOUNT_PASSWORD,
    authFile: UNVERIFIED_USER_AUTH_FILE,
    landsOn: 'verify-email',
  },
  {
    email: PW_CHANGE_ACCOUNT_EMAIL,
    password: PW_CHANGE_ACCOUNT_PASSWORD,
    authFile: PW_CHANGE_USER_AUTH_FILE,
    landsOn: 'home',
  },
  {
    email: PW_RESET_ACCOUNT_EMAIL,
    password: PW_RESET_ACCOUNT_PASSWORD,
    authFile: PW_RESET_USER_AUTH_FILE,
    landsOn: 'home',
  },
  {
    email: SESSION_TEST_ACCOUNT_EMAIL,
    password: SESSION_TEST_ACCOUNT_PASSWORD,
    authFile: SESSION_TEST_USER_AUTH_FILE,
    landsOn: 'home',
  },
  {
    email: EMAIL_CHANGE_ACCOUNT_EMAIL,
    password: EMAIL_CHANGE_ACCOUNT_PASSWORD,
    authFile: EMAIL_CHANGE_USER_AUTH_FILE,
    landsOn: 'home',
  },
];

for (const {email, password, authFile, landsOn} of userConfig) {
  setup(`authenticate as ${email}`, async ({page}) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(email, password);

    switch (landsOn) {
      case 'home': {
        const homePage = new HomePage(page);
        await homePage.expectToBeOnPage();
        break;
      }
      case 'verify-email': {
        const verifyEmailPage = new VerifyEmailPage(page);
        await verifyEmailPage.expectToBeOnPage();
        break;
      }
    }
    await page.context().storageState({path: authFile});
  });
}

if (process.env.ENABLE_BANKING_E2E === 'true') {
  setup('prepare the combined Tempo and Enable Banking browser state', () => {
    const providerStatePath = process.env.ENABLE_BANKING_PROVIDER_STORAGE_STATE;
    if (!providerStatePath) {
      throw new Error(
        'ENABLE_BANKING_PROVIDER_STORAGE_STATE is required when ENABLE_BANKING_E2E=true.',
      );
    }

    const tempoState = readStorageState(SESSION_TEST_USER_AUTH_FILE);
    const providerState = readStorageState(providerStatePath);
    const mergedState = mergeStorageStates(tempoState, providerState);

    mkdirSync(dirname(ENABLE_BANKING_SANDBOX_USER_AUTH_FILE), {recursive: true});
    writeFileSync(ENABLE_BANKING_SANDBOX_USER_AUTH_FILE, JSON.stringify(mergedState));
    chmodSync(ENABLE_BANKING_SANDBOX_USER_AUTH_FILE, 0o600);
  });
}

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
