import { chromium } from './node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/ss_login.png' });
console.log('done');
await browser.close();
