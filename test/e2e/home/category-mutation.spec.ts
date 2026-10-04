import * as reactQuery from '@tanstack/react-query';
import {QueryClient, QueryClientProvider, QueryObserver} from '@tanstack/react-query';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInThisContext} from 'node:vm';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import ts from 'typescript';

import {bankQueryKeys} from '../../../src/features/banking/api/query-keys';
import type {BankTransactionFilterParams} from '../../../src/features/banking/types/bank-transaction';
import {dashboardQueryKeys} from '../../../src/features/dashboard/api/query-keys';
import {expect, test} from '../../fixtures';

// The public API cannot seed FAILED/PROCESSING categorization or arbitrary cash-flow transitions.
// Exercise the real mutation hooks and QueryClient in an isolated React harness instead of changing
// shared seeded transactions. Only the HTTP boundary and toast presentation are replaced.
function mutationHarness(response: Record<string, unknown>, reject = false) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
  const require = createRequire(resolve('package.json'));
  const modules = new Map<string, {exports: Record<string, unknown>}>();
  const request = () =>
    reject ? Promise.reject(new Error('Synthetic mutation failure')) : Promise.resolve(response);
  function load(path: string): Record<string, unknown> {
    const filename = resolve(path);
    const cached = modules.get(filename);
    if (cached) return cached.exports;
    const module = {exports: {}};
    modules.set(filename, module);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    }).outputText;
    const localRequire = (name: string): unknown => {
      if (name === '@tanstack/react-query') return reactQuery;
      if (name === '@/utils/api') return {api: {patch: request, delete: request}};
      if (name === 'sonner') return {toast: {promise: (promise: Promise<unknown>) => promise}};
      if (name.startsWith('@/')) return load(resolve('src', `${name.slice(2)}.ts`));
      if (name.startsWith('.')) return load(resolve(filename, '..', `${name}.ts`));
      return require(name);
    };
    const execute = runInThisContext(`(function(require, module, exports) {${code}\n})`, {
      filename,
    }) as (
      require: typeof localRequire,
      module: {exports: Record<string, unknown>},
      exports: Record<string, unknown>,
    ) => void;
    execute(localRequire, module, module.exports);
    return module.exports;
  }
  function hook<T>(filename: string, exportName: string): T {
    let result: T;
    const useHook = load(resolve('src/features/banking/api', filename))[exportName] as () => T;
    function Harness() {
      result = useHook();
      return null;
    }
    renderToString(createElement(QueryClientProvider, {client}, createElement(Harness)));
    return result!;
  }
  return {client, hook};
}

for (const filters of [
  {cashFlows: ['SPENDING']},
  {categoryStatuses: ['FAILED']},
  {categoryStatuses: ['CATEGORIZING']},
] satisfies BankTransactionFilterParams[]) {
  test(`category save refetches the ${JSON.stringify(filters)} drill`, async () => {
    const {client, hook} = mutationHarness({
      id: 'example-transaction',
      category: 'REFUND',
      categoryStatus: 'COMPLETED',
    });
    const key = bankQueryKeys.transactions({pageIndex: 0, pageSize: 10}, filters, undefined);
    let reads = 0;
    client.setQueryData(key, {
      transactions: [{id: 'example-transaction', category: null}],
      total: 1,
    });
    // The key represents the server filter; reads only counts fetches at the HTTP boundary.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: () => {
        reads++;
        return Promise.resolve({transactions: [], total: 0});
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      const mutation = hook<{
        updateBankTransactionCategory: (input: {id: string; category: string}) => Promise<unknown>;
      }>('use-update-bank-transaction-category.ts', 'useUpdateBankTransactionCategory');
      await mutation.updateBankTransactionCategory({id: 'example-transaction', category: 'REFUND'});
      await expect.poll(() => client.getQueryData(key)).toEqual({transactions: [], total: 0});
      expect(reads).toBe(1);
      expect(client.getQueryData(bankQueryKeys.transaction('example-transaction'))).toMatchObject({
        category: 'REFUND',
      });
    } finally {
      unsubscribe();
      client.clear();
    }
  });
}

test('category save refreshes a drill that did not previously contain the transaction', async () => {
  const updated = {id: 'example-transaction', category: 'OTHER', categoryStatus: 'COMPLETED'};
  const {client, hook} = mutationHarness(updated);
  const key = bankQueryKeys.transactions(
    {pageIndex: 0, pageSize: 10},
    {cashFlows: ['SPENDING']},
    undefined,
  );
  client.setQueryData(key, {transactions: [], total: 0});
  // The synthetic response changes without changing the server filter key.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: () => Promise.resolve({transactions: [updated], total: 1}),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const mutation = hook<{
      updateBankTransactionCategory: (input: {id: string; category: string}) => Promise<unknown>;
    }>('use-update-bank-transaction-category.ts', 'useUpdateBankTransactionCategory');
    await mutation.updateBankTransactionCategory({id: updated.id, category: updated.category});
    expect(client.getQueryData(key)).toEqual({transactions: [updated], total: 1});
  } finally {
    unsubscribe();
    client.clear();
  }
});

test('category-only and source-only lists retain immediate cache updates without refetching', async () => {
  const updated = {id: 'example-transaction', category: 'OTHER', categorySource: 'MANUAL'};
  const {client, hook} = mutationHarness(updated);
  const pagination = {pageIndex: 0, pageSize: 10};
  const removedKey = bankQueryKeys.transactions(
    pagination,
    {categories: ['FOOD_AND_DRINK']},
    undefined,
  );
  const retainedKey = bankQueryKeys.transactions(
    pagination,
    {categorySources: ['MANUAL']},
    undefined,
  );
  const original = {id: updated.id, category: 'FOOD_AND_DRINK', categorySource: 'MANUAL'};
  for (const key of [removedKey, retainedKey])
    client.setQueryData(key, {transactions: [original], total: 1});
  try {
    const mutation = hook<{
      updateBankTransactionCategory: (input: {id: string; category: string}) => Promise<unknown>;
    }>('use-update-bank-transaction-category.ts', 'useUpdateBankTransactionCategory');
    await mutation.updateBankTransactionCategory({id: updated.id, category: 'OTHER'});
    expect(client.getQueryData(removedKey)).toEqual({transactions: [], total: 0});
    expect(client.getQueryData(retainedKey)).toEqual({transactions: [updated], total: 1});
    expect(client.getQueryState(removedKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(retainedKey)?.isInvalidated).toBe(false);
  } finally {
    client.clear();
  }
});

for (const [filename, exportName, method, input] of [
  [
    'use-update-bank-transaction-category.ts',
    'useUpdateBankTransactionCategory',
    'updateBankTransactionCategory',
    {id: 'example-transaction', category: 'OTHER'},
  ],
  [
    'use-update-bank-transaction-own-transfer.ts',
    'useUpdateBankTransactionOwnTransfer',
    'updateBankTransactionOwnTransfer',
    {id: 'example-transaction', override: 'MARKED'},
  ],
  [
    'use-delete-bank-connection.ts',
    'useDeleteBankConnection',
    'deleteBankConnection',
    'example-connection',
  ],
] as const) {
  test(`${method} invalidates every cached dashboard period and review counts`, async () => {
    const {client, hook} = mutationHarness({id: 'example-transaction', category: 'OTHER'});
    const keys = [
      dashboardQueryKeys.summary('2026-09', '2026-10-04'),
      dashboardQueryKeys.summary('2026-08', '2026-10-04'),
      dashboardQueryKeys.reviewCounts,
    ];
    keys.forEach((key) => client.setQueryData(key, {cached: true}));
    try {
      const mutation = hook<Record<string, (input: unknown) => Promise<unknown>>>(
        filename,
        exportName,
      );
      await mutation[method](input);
      for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    } finally {
      client.clear();
    }
  });
  test(`${method} leaves dashboard caches fresh when the request fails`, async () => {
    const {client, hook} = mutationHarness({}, true);
    const key = dashboardQueryKeys.reviewCounts;
    client.setQueryData(key, {cached: true});
    try {
      const mutation = hook<Record<string, (input: unknown) => Promise<unknown>>>(
        filename,
        exportName,
      );
      await expect(mutation[method](input)).rejects.toThrow('Synthetic mutation failure');
      expect(client.getQueryData(key)).toEqual({cached: true});
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    } finally {
      client.clear();
    }
  });
}
