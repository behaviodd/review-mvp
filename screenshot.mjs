import { chromium } from './node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/ss_dashboard.png' });
console.log('dashboard done');

await page.goto('http://localhost:5173/reviews', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/ss_reviews.png' });
console.log('reviews done');

await page.goto('http://localhost:5173/cycles', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/ss_cycles.png' });
console.log('cycles done');

await page.goto('http://localhost:5173/team', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/ss_team.png' });
console.log('team done');

await browser.close();
