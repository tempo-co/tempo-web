import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const outputPath = resolve(process.argv[2] ?? 'playwright/.auth/enable-banking-provider.json');

mkdirSync(dirname(outputPath), {recursive: true});

const browser = await chromium.launch({headless: false});
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://enablebanking.com/sign-in');
console.log('Complete Enable Banking sign-in in the opened browser.');
await page.waitForURL(
  (url) => url.hostname === 'enablebanking.com' && url.pathname.startsWith('/cp/'),
  {timeout: 300000},
);

await context.storageState({path: outputPath, indexedDB: true});
await browser.close();
console.log(`Provider browser state saved to ${outputPath}`);
